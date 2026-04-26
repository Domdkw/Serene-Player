/**
 * 一起听后台连接管理器 Hook
 * 用于在移动端保持 P2P 连接，即使用户退出一起听界面
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { PeerConnection, SyncMessage, ConnectionState, ConnectionLog } from '../utils/webrtc';
import { PlaylistItem } from '../types';

export interface TogetherListenManagerState {
  isConnected: boolean;
  isHost: boolean;
  roomId: string | null;
  connectionState: ConnectionState;
  error: string | null;
}

export interface TogetherListenManagerCallbacks {
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onTrackChange?: (neteaseId: number) => void;
  onError?: (error: string) => void;
}

interface UseTogetherListenManagerReturn extends TogetherListenManagerState {
  createRoom: (roomId: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  disconnect: () => void;
  sendMessage: (type: SyncMessage['type'], payload: SyncMessage['payload']) => void;
  setCallbacks: (callbacks: TogetherListenManagerCallbacks) => void;
  getLogs: () => ConnectionLog[];
}

/**
 * 一起听后台连接管理器 Hook
 * 在后台保持 P2P 连接，不随组件卸载而关闭
 */
export const useTogetherListenManager = (
  getCurrentTrack: () => PlaylistItem | null,
  getCurrentTime: () => number,
  getIsPlaying: () => boolean
): UseTogetherListenManagerReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'disconnected' });
  const [error, setError] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<PeerConnection | null>(null);
  const callbacksRef = useRef<TogetherListenManagerCallbacks>({});
  const logsRef = useRef<ConnectionLog[]>([]);
  const isRemoteControlRef = useRef<boolean>(false);
  const remoteControlCounterRef = useRef<number>(0);

  const addLog = useCallback((log: ConnectionLog) => {
    logsRef.current = [...logsRef.current.slice(-100), log];
  }, []);

  const handleConnectionStateChange = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    
    if (state.status === 'connected') {
      setIsConnected(true);
      setError(null);
      addLog({
        type: 'connection',
        message: '连接成功',
        details: undefined,
      });
      
      // 连接成功后，如果是主机，发送当前播放状态
      if (isHost && peerConnectionRef.current) {
        setTimeout(() => {
          const currentTrack = getCurrentTrack();
          if (currentTrack?.neteaseId) {
            peerConnectionRef.current?.sendMessage({
              type: 'sync_all',
              payload: {
                neteaseId: currentTrack.neteaseId,
                isPlaying: getIsPlaying(),
                currentTime: getCurrentTime(),
                timestamp: Date.now(),
              },
            });
          }
        }, 200);
      }
    } else if (state.status === 'disconnected') {
      setIsConnected(false);
      addLog({
        type: 'error',
        message: '连接已断开',
        details: undefined,
      });
    } else if (state.status === 'failed') {
      setIsConnected(false);
      const errorMsg = state.errorMessage || '连接失败';
      setError(errorMsg);
      addLog({
        type: 'error',
        message: errorMsg,
        details: undefined,
      });
    }
  }, [isHost, getCurrentTrack, getIsPlaying, getCurrentTime, addLog]);

  const handleMessage = useCallback((message: SyncMessage) => {
    isRemoteControlRef.current = true;
    
    const callbacks = callbacksRef.current;
    const currentTrack = getCurrentTrack();
    const isPlaying = getIsPlaying();
    const currentTime = getCurrentTime();

    switch (message.type) {
      case 'sync_all':
      case 'track_change':
        if (message.payload.neteaseId) {
          callbacks.onTrackChange?.(message.payload.neteaseId);
          addLog({
            type: 'sync',
            message: `切换歌曲 ID: ${message.payload.neteaseId}`,
            details: undefined,
          });
        }
        if (message.payload.isPlaying !== undefined) {
          if (isPlaying !== message.payload.isPlaying) {
            callbacks.onPlayPause?.();
            addLog({
              type: 'sync',
              message: `同步播放状态：${message.payload.isPlaying ? '播放' : '暂停'}`,
              details: undefined,
            });
          }
        }
        break;

      case 'play':
        if (!isPlaying) {
          callbacks.onPlayPause?.();
          addLog({
            type: 'sync',
            message: '同步：开始播放',
            details: undefined,
          });
        }
        break;

      case 'pause':
        if (isPlaying) {
          callbacks.onPlayPause?.();
          addLog({
            type: 'sync',
            message: '同步：暂停播放',
            details: undefined,
          });
        }
        break;

      case 'seek':
        if (message.payload.currentTime !== undefined) {
          callbacks.onSeek?.(message.payload.currentTime);
          addLog({
            type: 'sync',
            message: `同步：跳转到 ${formatTime(message.payload.currentTime)}`,
            details: undefined,
          });
        }
        break;

      case 'request_sync':
        if (currentTrack?.neteaseId) {
          peerConnectionRef.current?.sendMessage({
            type: 'sync_all',
            payload: {
              neteaseId: currentTrack.neteaseId,
              isPlaying,
              currentTime,
              timestamp: Date.now(),
            },
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
  }, [getCurrentTrack, getIsPlaying, getCurrentTime, addLog]);

  const formatTime = (time: number): string => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const createRoom = useCallback(async (customRoomId: string) => {
    setError(null);
    setIsHost(true);
    
    const peerConnection = new PeerConnection({
      onConnectionStateChange: handleConnectionStateChange,
      onMessage: handleMessage,
      onError: (err) => {
        setError(err);
        callbacksRef.current.onError?.(err);
        addLog({
          type: 'error',
          message: err,
          details: undefined,
        });
      },
      onLog: addLog,
    });
    
    peerConnectionRef.current = peerConnection;
    
    try {
      const createdRoomId = await peerConnection.createRoom(customRoomId);
      setRoomId(createdRoomId);
      peerConnection.listenForConnections();
      addLog({
        type: 'connection',
        message: '房间已创建，等待对方加入',
        details: undefined,
      });
    } catch (err) {
      setError('创建房间失败');
      peerConnectionRef.current = null;
      setIsHost(false);
      throw err;
    }
  }, [handleConnectionStateChange, handleMessage, addLog]);

  const joinRoom = useCallback(async (customRoomId: string) => {
    setError(null);
    setIsHost(false);
    
    const peerConnection = new PeerConnection({
      onConnectionStateChange: handleConnectionStateChange,
      onMessage: handleMessage,
      onError: (err) => {
        setError(err);
        callbacksRef.current.onError?.(err);
        addLog({
          type: 'error',
          message: err,
          details: undefined,
        });
      },
      onLog: addLog,
    });
    
    peerConnectionRef.current = peerConnection;
    
    try {
      await peerConnection.joinRoom(customRoomId);
      addLog({
        type: 'connection',
        message: '正在加入房间',
        details: undefined,
      });
    } catch (err) {
      setError('加入房间失败');
      peerConnectionRef.current = null;
      throw err;
    }
  }, [handleConnectionStateChange, handleMessage, addLog]);

  const disconnect = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setIsConnected(false);
    setIsHost(false);
    setRoomId(null);
    setConnectionState({ status: 'disconnected' });
    setError(null);
    logsRef.current = [];
    addLog({
      type: 'connection',
      message: '连接已断开',
      details: undefined,
    });
  }, [addLog]);

  const sendMessage = useCallback((type: SyncMessage['type'], payload: SyncMessage['payload']) => {
    if (peerConnectionRef.current?.isConnected()) {
      peerConnectionRef.current.sendMessage({
        type,
        payload: { ...payload, timestamp: Date.now() },
      });
      addLog({
        type: 'sync',
        message: `发送：${type}`,
        details: undefined,
      });
    }
  }, [addLog]);

  const setCallbacks = useCallback((callbacks: TogetherListenManagerCallbacks) => {
    callbacksRef.current = callbacks;
  }, []);

  const getLogs = useCallback(() => {
    return logsRef.current;
  }, []);

  // 页面卸载时不断开连接
  useEffect(() => {
    return () => {
      // 不在这里关闭连接，让连接在后台继续保持
      console.log('TogetherListenManager: 组件卸载，保持连接');
    };
  }, []);

  // 页面关闭时关闭连接
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return {
    isConnected,
    isHost,
    roomId,
    connectionState,
    error,
    createRoom,
    joinRoom,
    disconnect,
    sendMessage,
    setCallbacks,
    getLogs,
  };
};
