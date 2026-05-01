/**
 * 全局"一起听"连接管理器
 * 用于在组件卸载后保持 WebRTC 连接
 */

import { PeerConnection, SyncMessage, ConnectionState, ConnectionLog } from './webrtc';

export interface TogetherListenState {
  mode: 'idle' | 'hosting' | 'joining' | 'connected';
  connectionState: ConnectionState;
  roomId: string;
  isHost: boolean;
  error: string | null;
  logs: Array<{
    time: string;
    message: string;
    details?: string;
    type: 'info' | 'sync' | 'error' | 'stun' | 'ice' | 'connection' | 'datachannel';
  }>;
}

export interface TogetherListenCallbacks {
  onStateChange: (state: TogetherListenState) => void;
  onMessage: (message: SyncMessage) => void;
}

/**
 * 全局"一起听"连接管理器类
 * 单例模式，确保连接在组件卸载后仍然保持
 */
class TogetherListenManager {
  private static instance: TogetherListenManager | null = null;

  private peerConnection: PeerConnection | null = null;
  private state: TogetherListenState = {
    mode: 'idle',
    connectionState: { status: 'disconnected' },
    roomId: '',
    isHost: false,
    error: null,
    logs: [],
  };

  private subscribers: Set<TogetherListenCallbacks> = new Set();
  private propsCallbacks: {
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onTrackChange: (neteaseId: number) => void;
    formatTime: (time: number) => string;
  } | null = null;

  private isRemoteControl: boolean = false;
  private remoteControlCounter: number = 0;
  private prevIsPlaying: boolean = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): TogetherListenManager {
    if (!TogetherListenManager.instance) {
      TogetherListenManager.instance = new TogetherListenManager();
    }
    return TogetherListenManager.instance;
  }

  /**
   * 订阅状态变化
   */
  subscribe(callbacks: TogetherListenCallbacks): () => void {
    this.subscribers.add(callbacks);
    callbacks.onStateChange(this.state);
    return () => {
      this.subscribers.delete(callbacks);
    };
  }

  /**
   * 更新 props 回调
   */
  updatePropsCallbacks(callbacks: {
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onTrackChange: (neteaseId: number) => void;
    formatTime: (time: number) => string;
  }): void {
    this.propsCallbacks = callbacks;
  }

  /**
   * 发送歌曲变化消息
   */
  sendTrackChange(neteaseId: number, isPlaying: boolean, currentTime: number): void {
    if (!this.peerConnection?.isConnected() || this.isRemoteControl) return;

    this.prevIsPlaying = isPlaying;
    this.sendMessage('track_change', {
      neteaseId,
      isPlaying,
      currentTime,
    });
  }

  /**
   * 发送播放/暂停消息
   * 只有状态真正变化时才发送
   */
  sendPlayPause(isPlaying: boolean, currentTime: number): void {
    if (!this.peerConnection?.isConnected() || this.isRemoteControl) return;

    if (this.prevIsPlaying !== isPlaying) {
      this.prevIsPlaying = isPlaying;
      this.sendMessage(isPlaying ? 'play' : 'pause', {
        isPlaying,
        currentTime,
      });
    }
  }

  /**
   * 获取当前状态
   */
  getState(): TogetherListenState {
    return { ...this.state };
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.peerConnection?.isConnected() ?? false;
  }

  /**
   * 获取连接模式
   */
  getConnectionMode(): 'host' | 'client' | null {
    return this.state.isHost ? 'host' : (this.state.mode === 'connected' ? 'client' : null);
  }

  /**
   * 添加日志
   */
  private addLog(message: string, type: TogetherListenState['logs'][0]['type'] = 'info', details?: string): void {
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.state = {
      ...this.state,
      logs: [...this.state.logs.slice(-100), { time, message, type, details }],
    };
    this.notifyStateChange();
  }

  /**
   * 通知所有订阅者状态变化
   */
  private notifyStateChange(): void {
    this.subscribers.forEach(cb => cb.onStateChange(this.state));
  }

  /**
   * 发送消息
   */
  private sendMessage(type: SyncMessage['type'], payload: SyncMessage['payload']): void {
    if (this.peerConnection?.isConnected()) {
      this.peerConnection.sendMessage({
        type,
        payload: { ...payload, timestamp: Date.now() },
      });
      this.addLog(`发送：${type}`, 'sync');
    }
  }

  /**
   * 处理连接状态变化
   */
  private handleConnectionStateChange = (connectionState: ConnectionState): void => {
    this.state = { ...this.state, connectionState };

    if (connectionState.status === 'connected') {
      this.state = { ...this.state, mode: 'connected', error: null };
      this.addLog('连接成功', 'connection');
    } else if (connectionState.status === 'disconnected') {
      if (this.state.mode === 'connected') {
        this.addLog('连接已断开', 'error');
        this.state = { ...this.state, error: '连接已断开，请重新建立连接' };
      }
    } else if (connectionState.status === 'failed') {
      this.addLog('连接失败：' + (connectionState.errorMessage || '未知错误'), 'error');
      this.state = { ...this.state, error: connectionState.errorMessage || '连接失败' };
      this.cleanup();
    }

    this.notifyStateChange();
  };

  /**
   * 处理接收到的消息
   */
  private handleMessage = (message: SyncMessage): void => {
    this.isRemoteControl = true;

    if (!this.propsCallbacks) return;

    const { onPlayPause, onSeek, onTrackChange, formatTime } = this.propsCallbacks;

    switch (message.type) {
      case 'sync_all':
      case 'track_change':
        if (message.payload.neteaseId) {
          onTrackChange(message.payload.neteaseId);
          this.addLog(`切换歌曲 ID: ${message.payload.neteaseId}`, 'sync');
        }
        if (message.payload.isPlaying !== undefined) {
          this.prevIsPlaying = message.payload.isPlaying;
          onPlayPause();
          this.addLog(`同步播放状态：${message.payload.isPlaying ? '播放' : '暂停'}`, 'sync');
        }
        break;

      case 'play':
        this.prevIsPlaying = true;
        onPlayPause();
        this.addLog('同步：开始播放', 'sync');
        break;

      case 'pause':
        this.prevIsPlaying = false;
        onPlayPause();
        this.addLog('同步：暂停播放', 'sync');
        break;

      case 'seek':
        if (message.payload.currentTime !== undefined) {
          onSeek(message.payload.currentTime);
          this.addLog(`同步：跳转到 ${formatTime(message.payload.currentTime)}`, 'sync');
        }
        break;

      case 'request_sync':
        break;
    }

    const currentCounter = ++this.remoteControlCounter;
    setTimeout(() => {
      if (currentCounter === this.remoteControlCounter) {
        this.isRemoteControl = false;
      }
    }, 200);
  };

  /**
   * 处理连接日志
   */
  private handleConnectionLog = (log: ConnectionLog): void => {
    this.addLog(log.message, log.type, log.details);
  };

  /**
   * 创建房间
   */
  async createRoom(roomId: string): Promise<string> {
    const { validateRoomId, generateRoomId } = await import('./webrtc');

    const validation = validateRoomId(roomId.trim());
    if (!validation.valid) {
      this.state = { ...this.state, error: validation.error || '房间号无效' };
      this.notifyStateChange();
      throw new Error(validation.error);
    }

    this.state = { ...this.state, mode: 'hosting', isHost: true, error: null };
    this.notifyStateChange();
    this.addLog('创建房间中...', 'connection');

    this.peerConnection = new PeerConnection({
      onConnectionStateChange: this.handleConnectionStateChange,
      onMessage: this.handleMessage,
      onError: (err) => {
        this.addLog('错误：' + err, 'error');
        this.state = { ...this.state, error: err };
        this.notifyStateChange();
      },
      onLog: this.handleConnectionLog,
    });

    try {
      const createdRoomId = await this.peerConnection.createRoom(roomId.trim());
      this.state = { ...this.state, roomId: createdRoomId };
      this.notifyStateChange();

      this.peerConnection.listenForConnections();
      this.addLog('房间已创建，等待对方加入', 'connection');

      return createdRoomId;
    } catch (err) {
      console.error('Failed to create room:', err);
      this.addLog('创建房间失败', 'error');
      this.state = { ...this.state, error: '创建房间失败' };
      this.notifyStateChange();
      this.cleanup();
      throw err;
    }
  }

  /**
   * 加入房间
   */
  async joinRoom(roomId: string): Promise<void> {
    const { validateRoomId } = await import('./webrtc');

    const validation = validateRoomId(roomId.trim());
    if (!validation.valid) {
      this.state = { ...this.state, error: validation.error || '房间号无效' };
      this.notifyStateChange();
      throw new Error(validation.error);
    }

    this.state = { ...this.state, mode: 'joining', isHost: false, error: null };
    this.notifyStateChange();
    this.addLog('加入房间中...', 'connection');

    this.peerConnection = new PeerConnection({
      onConnectionStateChange: this.handleConnectionStateChange,
      onMessage: this.handleMessage,
      onError: (err) => {
        this.addLog('错误：' + err, 'error');
        this.state = { ...this.state, error: err };
        this.notifyStateChange();
      },
      onLog: this.handleConnectionLog,
    });

    try {
      await this.peerConnection.joinRoom(roomId.trim());
    } catch (err) {
      console.error('Failed to join room:', err);
      this.addLog('加入房间失败', 'error');
      this.state = { ...this.state, error: '加入房间失败，请检查房间号是否正确' };
      this.notifyStateChange();
      this.cleanup();
      throw err;
    }
  }

  /**
   * 清理连接
   */
  cleanup(): void {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.isRemoteControl = false;
    this.prevIsPlaying = false;
    this.state = {
      mode: 'idle',
      connectionState: { status: 'disconnected' },
      roomId: '',
      isHost: false,
      error: null,
      logs: [],
    };
    this.notifyStateChange();
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.cleanup();
  }

  /**
   * 清除错误
   */
  clearError(): void {
    this.state = { ...this.state, error: null };
    this.notifyStateChange();
  }
}

export const togetherListenManager = TogetherListenManager.getInstance();
