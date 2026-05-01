/**
 * "一起听"功能面板组件（基于 PeerJS）
 * 实现 P2P 连接和播放状态同步
 * 使用全局管理器保持连接在组件卸载后仍然存活
 */
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  X,
  Loader2,
  Wifi,
  WifiOff,
  AlertCircle,
  DoorOpen,
  UserPlus,
  Copy,
  Check,
} from 'lucide-react';
import {
  togetherListenManager,
  TogetherListenState,
} from '../utils/togetherListenManager';
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
  disconnect: () => void;
}

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
  const [state, setState] = useState<TogetherListenState>(togetherListenManager.getState());
  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const prevTrackIdRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = togetherListenManager.subscribe({
      onStateChange: (newState) => {
        setState(newState);
      },
      onMessage: () => {},
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    togetherListenManager.updatePropsCallbacks({
      onPlayPause,
      onSeek,
      onTrackChange,
      formatTime,
    });
  }, [onPlayPause, onSeek, onTrackChange, formatTime]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.logs]);

  /**
   * 监听歌曲变化，发送同步消息
   */
  useEffect(() => {
    const currentTrackId = currentTrack?.neteaseId ?? null;

    if (currentTrackId && currentTrackId !== prevTrackIdRef.current) {
      prevTrackIdRef.current = currentTrackId;
      togetherListenManager.sendTrackChange(currentTrackId, isPlaying, currentTime);
    }
  }, [currentTrack, isPlaying, currentTime]);

  /**
   * 监听播放/暂停状态变化
   * 管理器会判断是否真正需要发送消息
   */
  useEffect(() => {
    togetherListenManager.sendPlayPause(isPlaying, currentTime);
  }, [isPlaying, currentTime]);

  useImperativeHandle(ref, () => ({
    isConnected: () => togetherListenManager.isConnected(),
    getConnectionMode: () => togetherListenManager.getConnectionMode(),
    disconnect: () => togetherListenManager.disconnect(),
  }), []);

  const handleCreateRoom = async () => {
    try {
      await togetherListenManager.createRoom(inputRoomId);
    } catch (err) {
      console.error('Create room error:', err);
    }
  };

  const handleJoinRoom = async () => {
    try {
      await togetherListenManager.joinRoom(inputRoomId);
    } catch (err) {
      console.error('Join room error:', err);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDisconnect = () => {
    togetherListenManager.disconnect();
  };

  const renderConnectionStatus = () => {
    switch (state.connectionState.status) {
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
      <div className="mb-4 w-full px-4">
        <label className="block text-xs text-white/40 mb-1">房间号</label>
        <input
          type="text"
          value={inputRoomId}
          onChange={(e) => setInputRoomId(e.target.value)}
          placeholder="请输入房间号（长度大于 8 位，字母多于 4 个）"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 text-xs resize-none"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleCreateRoom}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all flex items-center gap-2"
        >
          <UserPlus size={16} />
          创建房间
        </button>
        <button
          onClick={handleJoinRoom}
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
        <label className="block text-xs text-white/40 mb-1">房间号</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={state.roomId}
            readOnly
            className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs truncate"
          />
          <button onClick={handleCopy} className="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all">
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-xs text-white/30 mt-1">请将此房间号分享给对方</p>
      </div>
      <button onClick={handleDisconnect} className="text-xs text-white/40 hover:text-white transition-colors">
        取消
      </button>
    </div>
  );

  const renderJoiningState = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-2 mb-4">
        <Loader2 size={16} className="animate-spin text-white/60" />
        <span className="text-sm text-white/80">正在连接...</span>
      </div>
      <div className="mb-3">
        <label className="block text-xs text-white/40 mb-1">房间号</label>
        <input
          type="text"
          value={inputRoomId}
          readOnly
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs truncate"
        />
      </div>
      <button onClick={handleDisconnect} className="text-xs text-white/40 hover:text-white transition-colors">
        取消
      </button>
    </div>
  );

  const renderConnectedState = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          {renderConnectionStatus()}
          <span className="text-xs text-white/60">
            {state.isHost ? '主机' : '客户端'}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          断开
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {state.logs.map((log, i) => (
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
      {state.error && (
        <div className="mx-3 mt-3 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-300 text-xs">
          <AlertCircle size={14} />
          <span className="flex-1">{state.error}</span>
          <button
            onClick={() => togetherListenManager.clearError()}
            className="hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {state.mode === 'idle' && renderIdleState()}
        {state.mode === 'hosting' && renderHostingState()}
        {state.mode === 'joining' && renderJoiningState()}
        {state.mode === 'connected' && renderConnectedState()}
      </div>
    </div>
  );
});

TogetherListenPanel.displayName = 'TogetherListenPanel';

export default TogetherListenPanel;
