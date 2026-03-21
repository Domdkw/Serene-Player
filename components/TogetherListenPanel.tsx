/**
 * "一起听"功能面板组件
 * 实现 P2P 连接和播放状态同步
 * 简化同步策略：切换音乐直接发送ID，对方直接切换
 */
import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Users,
  Link2,
  Copy,
  Check,
  X,
  Loader2,
  Wifi,
  WifiOff,
  AlertCircle,
  Music,
  Play,
  Pause,
} from 'lucide-react';
import {
  PeerConnection,
  SyncMessage,
  ConnectionState,
  serializeSignalData,
  deserializeSignalData,
  compressSignalData,
  decompressSignalData,
} from '../utils/webrtc';
import { PlaylistItem } from '../types';

interface TogetherListenPanelProps {
  isPlaying: boolean;
  currentTime: number;
  currentTrack: PlaylistItem | null;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onTrackChange: (neteaseId: number) => void;
  formatTime: (time: number) => string;
}

export interface TogetherListenPanelRef {
  isConnected: () => boolean;
  getConnectionMode: () => 'host' | 'client' | null;
}

type ConnectionMode = 'idle' | 'hosting' | 'joining' | 'connected';

const TogetherListenPanel = forwardRef<TogetherListenPanelRef, TogetherListenPanelProps>(({
  isPlaying,
  currentTime,
  currentTrack,
  onPlayPause,
  onSeek,
  onTrackChange,
  formatTime,
}, ref) => {
  const [mode, setMode] = useState<ConnectionMode>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'disconnected' });
  const [signalData, setSignalData] = useState<string>('');
  const [inputSignalData, setInputSignalData] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<PeerConnection | null>(null);
  const isRemoteControlRef = useRef<boolean>(false);
  const isHostRef = useRef<boolean>(false);
  const prevTrackIdRef = useRef<number | null>(null);
  const prevIsPlayingRef = useRef<boolean>(isPlaying);

  const propsRef = useRef({
    isPlaying,
    currentTime,
    currentTrack,
    onPlayPause,
    onSeek,
    onTrackChange,
  });

  useEffect(() => {
    propsRef.current = {
      isPlaying,
      currentTime,
      currentTrack,
      onPlayPause,
      onSeek,
      onTrackChange,
    };
  }, [isPlaying, currentTime, currentTrack, onPlayPause, onSeek, onTrackChange]);

  useImperativeHandle(ref, () => ({
    isConnected: () => peerConnectionRef.current?.isConnected() ?? false,
    getConnectionMode: () => isHostRef.current ? 'host' : 'client',
  }), []);

  const cleanup = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    isHostRef.current = false;
    isRemoteControlRef.current = false;
    prevTrackIdRef.current = null;
    setMode('idle');
    setSignalData('');
    setInputSignalData('');
    setError(null);
  }, []);

  const sendMessage = useCallback((type: SyncMessage['type'], payload: SyncMessage['payload']) => {
    if (peerConnectionRef.current?.isConnected()) {
      peerConnectionRef.current.sendMessage({
        type,
        payload: { ...payload, timestamp: Date.now() },
      });
    }
  }, []);

  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    if (state.status === 'connected') {
      setMode('connected');
      setError(null);
      if (isHostRef.current && propsRef.current.currentTrack?.neteaseId) {
        setTimeout(() => {
          sendMessage('sync_all', {
            neteaseId: propsRef.current.currentTrack?.neteaseId,
            isPlaying: propsRef.current.isPlaying,
            currentTime: propsRef.current.currentTime,
          });
        }, 200);
      }
    } else if (state.status === 'failed') {
      setError(state.errorMessage || '连接失败');
      cleanup();
    }
  }, [cleanup, sendMessage]);

  const handleMessage = useCallback((message: SyncMessage) => {
    isRemoteControlRef.current = true;

    const props = propsRef.current;

    switch (message.type) {
      case 'sync_all':
      case 'track_change':
        if (message.payload.neteaseId) {
          props.onTrackChange(message.payload.neteaseId);
          prevTrackIdRef.current = message.payload.neteaseId;
        }
        if (message.payload.isPlaying !== undefined) {
          if (props.isPlaying !== message.payload.isPlaying) {
            props.onPlayPause();
          }
        }
        break;

      case 'play':
        if (!props.isPlaying) {
          props.onPlayPause();
        }
        break;

      case 'pause':
        if (props.isPlaying) {
          props.onPlayPause();
        }
        break;

      case 'seek':
        if (message.payload.currentTime !== undefined) {
          props.onSeek(message.payload.currentTime);
        }
        break;

      case 'request_sync':
        if (props.currentTrack?.neteaseId) {
          sendMessage('sync_all', {
            neteaseId: props.currentTrack.neteaseId,
            isPlaying: props.isPlaying,
            currentTime: props.currentTime,
          });
        }
        break;
    }

    setTimeout(() => {
      isRemoteControlRef.current = false;
    }, 200);
  }, [sendMessage]);

  const handleCreateRoom = async () => {
    try {
      setError(null);
      setMode('hosting');
      isHostRef.current = true;

      const peerConnection = new PeerConnection({
        onConnectionStateChange: handleConnectionStateChange,
        onMessage: handleMessage,
        onError: (err) => setError(err),
      });
      peerConnectionRef.current = peerConnection;

      const offer = await peerConnection.createOffer();
      const candidates = peerConnection.getLocalIceCandidates();
      const data = serializeSignalData(offer, candidates);
      setSignalData(compressSignalData(data));
    } catch (err) {
      console.error('Failed to create room:', err);
      setError('创建房间失败');
      cleanup();
    }
  };

  const handleJoinRoom = async () => {
    try {
      if (!inputSignalData.trim()) {
        setError('请输入连接码');
        return;
      }

      setError(null);
      setMode('joining');
      isHostRef.current = false;

      const peerConnection = new PeerConnection({
        onConnectionStateChange: handleConnectionStateChange,
        onMessage: handleMessage,
        onError: (err) => setError(err),
      });
      peerConnectionRef.current = peerConnection;

      const decompressed = decompressSignalData(inputSignalData.trim());
      const { sdp, candidates } = deserializeSignalData(decompressed);

      const answer = await peerConnection.handleOffer(sdp);
      for (const candidate of candidates) {
        await peerConnection.addIceCandidate(candidate);
      }

      const answerCandidates = peerConnection.getLocalIceCandidates();
      const data = serializeSignalData(answer, answerCandidates);
      setSignalData(compressSignalData(data));

      setTimeout(() => {
        sendMessage('request_sync', {});
      }, 500);
    } catch (err) {
      console.error('Failed to join room:', err);
      setError('加入房间失败，请检查连接码是否正确');
      cleanup();
    }
  };

  const handleReceiveAnswer = async () => {
    try {
      if (!inputSignalData.trim()) {
        setError('请输入对方的连接码');
        return;
      }

      const decompressed = decompressSignalData(inputSignalData.trim());
      const { sdp, candidates } = deserializeSignalData(decompressed);

      if (peerConnectionRef.current) {
        await peerConnectionRef.current.handleAnswer(sdp);
        for (const candidate of candidates) {
          await peerConnectionRef.current.addIceCandidate(candidate);
        }
        setInputSignalData('');
      }
    } catch (err) {
      console.error('Failed to handle answer:', err);
      setError('连接失败，请重试');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signalData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('复制失败');
    }
  };

  useEffect(() => {
    if (mode !== 'connected' || !peerConnectionRef.current?.isConnected()) return;
    if (isRemoteControlRef.current) return;

    const currentTrackId = currentTrack?.neteaseId ?? null;

    if (currentTrackId && currentTrackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = currentTrackId;
      sendMessage('track_change', {
        neteaseId: currentTrackId,
        isPlaying,
        currentTime,
      });
    }
  }, [currentTrack, isPlaying, currentTime, mode, sendMessage]);

  useEffect(() => {
    if (mode !== 'connected' || !peerConnectionRef.current?.isConnected()) return;
    if (isRemoteControlRef.current) return;

    if (prevIsPlayingRef.current !== isPlaying) {
      prevIsPlayingRef.current = isPlaying;
      sendMessage(isPlaying ? 'play' : 'pause', {
        isPlaying,
        currentTime,
      });
    }
  }, [isPlaying, currentTime, mode, sendMessage]);

  useEffect(() => {
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    prevTrackIdRef.current = currentTrack?.neteaseId ?? null;
  }, [currentTrack]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const renderConnectionStatus = () => {
    switch (connectionState.status) {
      case 'connected':
        return <Wifi size={16} className="text-green-400" />;
      case 'connecting':
        return <Loader2 size={16} className="text-yellow-400 animate-spin" />;
      case 'failed':
        return <AlertCircle size={16} className="text-red-400" />;
      default:
        return <WifiOff size={16} className="text-white/40" />;
    }
  };

  const renderIdleState = () => (
    <div className="flex flex-col items-center justify-center h-full text-white/60">
      <Users size={64} className="mb-6 opacity-30" />
      <h3 className="text-xl font-semibold mb-2 text-white/80">一起听</h3>
      <p className="text-sm text-center mb-8 max-w-xs">
        邀请好友一起听歌，实时同步播放状态
      </p>
      <div className="flex gap-4">
        <button
          onClick={handleCreateRoom}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all flex items-center gap-2"
        >
          <Link2 size={18} />
          创建房间
        </button>
        <button
          onClick={() => setMode('joining')}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/80 font-medium transition-all flex items-center gap-2 border border-white/10"
        >
          <Users size={18} />
          加入房间
        </button>
      </div>
    </div>
  );

  const renderHostingState = () => (
    <div className="flex flex-col items-center justify-center h-full text-white">
      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
        <Loader2 size={32} className="animate-spin text-white/60" />
      </div>
      <h3 className="text-xl font-semibold mb-6">房间已创建</h3>
      <div className="w-full max-w-md mb-6">
        <label className="block text-sm text-white/60 mb-2">连接码（发送给好友）</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={signalData}
            readOnly
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm truncate"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
          >
            {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
          </button>
        </div>
      </div>
      <div className="w-full max-w-md mb-6">
        <label className="block text-sm text-white/60 mb-2">好友的连接码</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputSignalData}
            onChange={(e) => setInputSignalData(e.target.value)}
            placeholder="粘贴好友的连接码..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm"
          />
          <button
            onClick={handleReceiveAnswer}
            disabled={!inputSignalData.trim()}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
          >
            连接
          </button>
        </div>
      </div>
      <button
        onClick={cleanup}
        className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm"
      >
        取消
      </button>
    </div>
  );

  const renderJoiningState = () => (
    <div className="flex flex-col items-center justify-center h-full text-white">
      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
        <Users size={32} className="text-white/60" />
      </div>
      <h3 className="text-xl font-semibold mb-2">加入房间</h3>
      <p className="text-sm text-white/60 mb-6">请粘贴好友发送的连接码</p>
      <div className="w-full max-w-md mb-6">
        <textarea
          value={inputSignalData}
          onChange={(e) => setInputSignalData(e.target.value)}
          placeholder="粘贴连接码..."
          rows={4}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 text-sm resize-none"
        />
      </div>
      <div className="flex gap-4">
        <button
          onClick={handleJoinRoom}
          disabled={!inputSignalData.trim()}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-all flex items-center gap-2"
        >
          <Link2 size={18} />
          加入
        </button>
        <button
          onClick={cleanup}
          className="px-6 py-3 text-white/60 hover:text-white transition-colors"
        >
          取消
        </button>
      </div>
      {signalData && (
        <div className="w-full max-w-md mt-6">
          <label className="block text-sm text-white/60 mb-2">你的连接码（发送给好友）</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={signalData}
              readOnly
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm truncate"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderConnectedState = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          {renderConnectionStatus()}
          <div>
            <p className="text-sm font-medium text-white">
              {connectionState.status === 'connected' ? '已连接' : '连接中...'}
            </p>
          </div>
        </div>
        <button
          onClick={cleanup}
          className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all text-sm flex items-center gap-2"
        >
          <X size={16} />
          断开连接
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-32 h-32 rounded-2xl bg-white/10 flex items-center justify-center mb-6 overflow-hidden">
          {currentTrack?.coverUrl ? (
            <img src={currentTrack.coverUrl} alt="封面" className="w-full h-full object-cover" />
          ) : (
            <Music size={48} className="text-white/40" />
          )}
        </div>

        <h3 className="text-xl font-semibold text-white mb-1 truncate max-w-xs">
          {currentTrack?.name || '未在播放'}
        </h3>
        <p className="text-sm text-white/60 mb-6 truncate max-w-xs">
          {currentTrack?.artist || ''}
        </p>

        <div className="flex items-center justify-center mb-6">
          <button
            onClick={() => {
              onPlayPause();
              sendMessage(isPlaying ? 'pause' : 'play', { isPlaying: !isPlaying, currentTime });
            }}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center transition-all hover:scale-105"
          >
            {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
          </button>
        </div>

        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(currentTrack?.duration || 0)}</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-100"
              style={{ width: `${((currentTime / (currentTrack?.duration || 1)) * 100) || 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-white/[0.05]">
        <div className="flex items-center justify-center gap-2 text-sm text-white/40">
          <Users size={14} />
          <span>正在一起听歌</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-transparent">
      {error && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-sm">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {mode === 'idle' && renderIdleState()}
        {mode === 'hosting' && renderHostingState()}
        {mode === 'joining' && renderJoiningState()}
        {mode === 'connected' && renderConnectedState()}
      </div>
    </div>
  );
});

TogetherListenPanel.displayName = 'TogetherListenPanel';

export default TogetherListenPanel;
