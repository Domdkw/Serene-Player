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
  Joystick,
  DoorOpen,
  UserPlus,
} from 'lucide-react';
import {
  PeerConnection,
  SyncMessage,
  ConnectionState,
  ConnectionLog,
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

interface LogEntry {
  time: string;
  message: string;
  details?: string;
  type: 'info' | 'sync' | 'error' | 'stun' | 'ice' | 'connection' | 'datachannel';
}

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reconnectHint, setReconnectHint] = useState<{ wasHost: boolean; lastSignalData: string } | null>(null);

  const peerConnectionRef = useRef<PeerConnection | null>(null);
  const isRemoteControlRef = useRef<boolean>(false);
  const remoteControlCounterRef = useRef<number>(0);
  const isHostRef = useRef<boolean>(false);
  const prevTrackIdRef = useRef<number | null>(null);
  const prevIsPlayingRef = useRef<boolean>(isPlaying);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef({
    isPlaying,
    currentTime,
    currentTrack,
    onPlayPause,
    onSeek,
    onTrackChange,
  });

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info', details?: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev.slice(-100), { time, message, type, details }]);
  }, []);

  const handleConnectionLog = useCallback((log: ConnectionLog) => {
    addLog(log.message, log.type, log.details);
  }, [addLog]);

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

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useImperativeHandle(ref, () => ({
    isConnected: () => peerConnectionRef.current?.isConnected() ?? false,
    getConnectionMode: () => isHostRef.current ? 'host' : 'client',
  }), []);

  const cleanup = useCallback((preserveReconnectHint = false) => {
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
    setLogs([]);
    if (!preserveReconnectHint) {
      setReconnectHint(null);
    }
  }, []);

  const sendMessage = useCallback((type: SyncMessage['type'], payload: SyncMessage['payload']) => {
    if (peerConnectionRef.current?.isConnected()) {
      peerConnectionRef.current.sendMessage({
        type,
        payload: { ...payload, timestamp: Date.now() },
      });
      addLog(`发送: ${type}`, 'sync');
    }
  }, [addLog]);

  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    if (state.status === 'connected') {
      setMode('connected');
      setError(null);
      setReconnectHint(null);
      addLog('连接成功', 'connection');
      if (isHostRef.current && propsRef.current.currentTrack?.neteaseId) {
        setTimeout(() => {
          sendMessage('sync_all', {
            neteaseId: propsRef.current.currentTrack?.neteaseId,
            isPlaying: propsRef.current.isPlaying,
            currentTime: propsRef.current.currentTime,
          });
        }, 200);
      }
    } else if (state.status === 'disconnected') {
      if (mode === 'connected') {
        addLog('连接已断开', 'error');
        setReconnectHint({
          wasHost: isHostRef.current,
          lastSignalData: signalData,
        });
        setError('连接已断开，请重新建立连接');
      }
    } else if (state.status === 'failed') {
      addLog('连接失败: ' + (state.errorMessage || '未知错误'), 'error');
      setError(state.errorMessage || '连接失败');
      cleanup();
    }
  }, [cleanup, sendMessage, addLog, mode, signalData]);

  const handleMessage = useCallback((message: SyncMessage) => {
    isRemoteControlRef.current = true;

    const props = propsRef.current;

    switch (message.type) {
      case 'sync_all':
      case 'track_change':
        if (message.payload.neteaseId) {
          props.onTrackChange(message.payload.neteaseId);
          prevTrackIdRef.current = message.payload.neteaseId;
          addLog(`切换歌曲 ID: ${message.payload.neteaseId}`, 'sync');
        }
        if (message.payload.isPlaying !== undefined) {
          if (props.isPlaying !== message.payload.isPlaying) {
            props.onPlayPause();
            addLog(`同步播放状态: ${message.payload.isPlaying ? '播放' : '暂停'}`, 'sync');
          }
        }
        break;

      case 'play':
        if (!props.isPlaying) {
          props.onPlayPause();
          addLog('同步: 开始播放', 'sync');
        }
        break;

      case 'pause':
        if (props.isPlaying) {
          props.onPlayPause();
          addLog('同步: 暂停播放', 'sync');
        }
        break;

      case 'seek':
        if (message.payload.currentTime !== undefined) {
          props.onSeek(message.payload.currentTime);
          addLog(`同步: 跳转到 ${formatTime(message.payload.currentTime)}`, 'sync');
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

    const currentCounter = ++remoteControlCounterRef.current;
    setTimeout(() => {
      if (currentCounter === remoteControlCounterRef.current) {
        isRemoteControlRef.current = false;
      }
    }, 200);
  }, [sendMessage, addLog, formatTime]);

  const handleCreateRoom = async () => {
    try {
      setError(null);
      setMode('hosting');
      isHostRef.current = true;
      addLog('创建房间中...', 'connection');

      const peerConnection = new PeerConnection({
        onConnectionStateChange: handleConnectionStateChange,
        onMessage: handleMessage,
        onError: (err) => {
          addLog('错误: ' + err, 'error');
          setError(err);
        },
        onLog: handleConnectionLog,
      });
      peerConnectionRef.current = peerConnection;

      const offer = await peerConnection.createOffer();
      const candidates = peerConnection.getLocalIceCandidates();
      const data = serializeSignalData(offer, candidates);
      setSignalData(compressSignalData(data));
      addLog('房间已创建，等待对方加入', 'connection');
    } catch (err) {
      console.error('Failed to create room:', err);
      addLog('创建房间失败', 'error');
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
      addLog('加入房间中...', 'connection');

      const peerConnection = new PeerConnection({
        onConnectionStateChange: handleConnectionStateChange,
        onMessage: handleMessage,
        onError: (err) => {
          addLog('错误: ' + err, 'error');
          setError(err);
        },
        onLog: handleConnectionLog,
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
      addLog('已生成回复码，请发送给对方', 'connection');

      setTimeout(() => {
        sendMessage('request_sync', {});
      }, 500);
    } catch (err) {
      console.error('Failed to join room:', err);
      addLog('加入房间失败', 'error');
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
        addLog('已接收对方回复，正在建立连接...', 'connection');
      }
    } catch (err) {
      console.error('Failed to handle answer:', err);
      addLog('连接失败', 'error');
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
        return <Wifi size={14} className="text-green-400" />;
      case 'connecting':
        return <Loader2 size={14} className="text-yellow-400 animate-spin" />;
      case 'failed':
        return <AlertCircle size={14} className="text-red-400" />;
      default:
        return <WifiOff size={14} className="text-white/40" />;
    }
  };

  const getLogColor = (type: LogEntry['type']): string => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'sync': return 'text-green-400';
      case 'stun': return 'text-purple-400';
      case 'ice': return 'text-cyan-400';
      case 'connection': return 'text-yellow-400';
      case 'datachannel': return 'text-blue-400';
      default: return 'text-white/50';
    }
  };

  const getLogPrefix = (type: LogEntry['type']): string => {
    switch (type) {
      case 'stun': return '[STUN]';
      case 'ice': return '[ICE]';
      case 'connection': return '[CONN]';
      case 'datachannel': return '[DATA]';
      case 'sync': return '[SYNC]';
      case 'error': return '[ERR]';
      default: return '[INFO]';
    }
  };

  const renderIdleState = () => (
    <div className="flex flex-col items-center justify-center h-full text-white/60">
      <div className="flex gap-3">
        <button
          onClick={handleCreateRoom}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all flex items-center gap-2"
        >
          <UserPlus size={16} />
          创建房间
        </button>
        <button
          onClick={() => setMode('joining')}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-sm font-medium transition-all flex items-center gap-2 border border-white/10"
        >
          <DoorOpen size={16} />
          加入房间
        </button>
      </div>
    </div>
  );

  const renderHostingState = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 size={16} className="animate-spin text-white/60" />
        <span className="text-sm text-white/80">等待对方加入...</span>
      </div>
      <div className="mb-3">
        <label className="block text-xs text-white/40 mb-1">连接码</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={signalData}
            readOnly
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs truncate"
          />
          <button onClick={handleCopy} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-xs text-white/40 mb-1">对方回复码</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputSignalData}
            onChange={(e) => setInputSignalData(e.target.value)}
            placeholder="粘贴对方回复码..."
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-xs"
          />
          <button
            onClick={handleReceiveAnswer}
            disabled={!inputSignalData.trim()}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all text-xs"
          >
            连接
          </button>
        </div>
      </div>
      <button onClick={() => cleanup()} className="text-xs text-white/40 hover:text-white transition-colors">
        取消
      </button>
    </div>
  );

  const renderJoiningState = () => (
    <div className="flex flex-col h-full p-4">
      <div className="mb-3">
        <label className="block text-xs text-white/40 mb-1">对方连接码</label>
        <textarea
          value={inputSignalData}
          onChange={(e) => setInputSignalData(e.target.value)}
          placeholder="粘贴连接码..."
          rows={3}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-xs resize-none"
        />
      </div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleJoinRoom}
          disabled={!inputSignalData.trim()}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-all flex items-center gap-2"
        >
          <Link2 size={14} />
          加入
        </button>
        <button onClick={() => cleanup()} className="px-4 py-2 text-white/40 hover:text-white text-xs transition-colors">
          取消
        </button>
      </div>
      {signalData && (
        <div>
          <label className="block text-xs text-white/40 mb-1">你的回复码</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={signalData}
              readOnly
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs truncate"
            />
            <button onClick={handleCopy} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderConnectedState = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          {renderConnectionStatus()}
          <span className="text-xs text-white/60">
            {isHostRef.current ? '主机' : '客户端'}
          </span>
        </div>
        <button
          onClick={() => cleanup()}
          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          断开
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className={`mb-1 ${getLogColor(log.type)}`}>
            <span className="text-white/30">[{log.time}]</span>
            <span className="text-white/50">{getLogPrefix(log.type)}</span>{' '}
            <span className={getLogColor(log.type)}>{log.message}</span>
            {log.details && (
              <div className="ml-4 text-white/30 text-[10px] whitespace-pre-wrap break-all">
                {log.details}
              </div>
            )}
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-transparent">
      {error && (
        <div className="mx-3 mt-3 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-xs">
          <AlertCircle size={14} />
          <span className="flex-1">{error}</span>
          {reconnectHint && (
            <button
              onClick={() => {
                const hint = reconnectHint;
                cleanup(true);
                if (hint.wasHost) {
                  setSignalData(hint.lastSignalData);
                  setMode('hosting');
                  isHostRef.current = true;
                } else {
                  setMode('joining');
                  isHostRef.current = false;
                }
                setError(null);
                addLog('准备重新连接...', 'connection');
              }}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white transition-colors whitespace-nowrap"
            >
              重新连接
            </button>
          )}
          <button onClick={() => { setError(null); setReconnectHint(null); }} className="hover:text-white transition-colors">
            <X size={14} />
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
