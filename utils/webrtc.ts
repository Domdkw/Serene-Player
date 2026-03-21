/**
 * WebRTC P2P 连接管理模块
 * 用于"一起听"功能的实时音频同步
 */

export interface SyncMessage {
  type: 'play' | 'pause' | 'seek' | 'track_change' | 'sync_all' | 'request_sync' | 'sync_state' | 'initial_sync';
  payload: {
    currentTime?: number;
    isPlaying?: boolean;
    neteaseId?: number;
    timestamp: number;
  };
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  errorMessage?: string;
}

export interface PeerConnectionCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onMessage: (message: SyncMessage) => void;
  onError: (error: string) => void;
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.nextcloud.com:3478' },
  { urls: 'stun:stun.google.com:19302' },
];


/**
 * WebRTC P2P 连接管理类
 */
export class PeerConnection {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private callbacks: PeerConnectionCallbacks;
  private isInitiator: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;

  constructor(callbacks: PeerConnectionCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * 创建新的 P2P 连接（作为发起方）
   * @returns SDP offer
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.isInitiator = true;
    this.cleanup();
    
    this.peerConnection = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    this.setupPeerConnectionHandlers();

    this.dataChannel = this.peerConnection.createDataChannel('sync', {
      ordered: true,
    });
    this.setupDataChannelHandlers();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    await this.waitForIceGathering();

    return this.peerConnection.localDescription!;
  }

  /**
   * 接收 offer 并创建 answer（作为接收方）
   * @param offer - 发起方的 SDP offer
   * @returns SDP answer
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.isInitiator = false;
    this.cleanup();

    this.peerConnection = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    this.setupPeerConnectionHandlers();

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await this.waitForIceGathering();

    return this.peerConnection.localDescription!;
  }

  /**
   * 接收 answer 并完成连接（作为发起方）
   * @param answer - 接收方的 SDP answer
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection exists');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * 添加 ICE candidate
   * @param candidate - ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection exists');
    }

    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * 发送同步消息
   * @param message - 同步消息
   */
  sendMessage(message: SyncMessage): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message));
    } else {
      console.warn('Data channel is not open');
    }
  }

  /**
   * 获取本地 ICE candidates
   */
  getLocalIceCandidates(): RTCIceCandidate[] {
    if (!this.peerConnection) return [];
    return Array.from(this.peerConnection.localDescription?.sdp?.match(/a=candidate:.*/g) || []).map((line, index) => {
      return {
        candidate: line.substring(2),
        sdpMid: '0',
        sdpMLineIndex: index,
      } as RTCIceCandidate;
    });
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    if (!this.peerConnection) {
      return { status: 'disconnected' };
    }

    const state = this.peerConnection.connectionState;
    switch (state) {
      case 'new':
      case 'connecting':
        return { status: 'connecting' };
      case 'connected':
        return { status: 'connected' };
      case 'disconnected':
      case 'closed':
        return { status: 'disconnected' };
      case 'failed':
        return { status: 'failed', errorMessage: '连接失败' };
      default:
        return { status: 'disconnected' };
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.cleanup();
    this.callbacks.onConnectionStateChange({ status: 'disconnected' });
  }

  /**
   * 设置 PeerConnection 事件处理器
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.getConnectionState();
      this.callbacks.onConnectionStateChange(state);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      if (iceState === 'failed') {
        this.callbacks.onConnectionStateChange({
          status: 'failed',
          errorMessage: 'ICE 连接失败，请检查网络环境',
        });
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('ICE candidate found:', event.candidate.type);
      }
    };
  }

  /**
   * 设置 DataChannel 事件处理器
   */
  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel opened');
      this.callbacks.onConnectionStateChange({ status: 'connected' });
      this.reconnectAttempts = 0;
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel closed');
      this.callbacks.onConnectionStateChange({ status: 'disconnected' });
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.callbacks.onError('数据通道错误');
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const message: SyncMessage = JSON.parse(event.data);
        this.callbacks.onMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };
  }

  /**
   * 等待 ICE gathering 完成
   */
  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve();
        return;
      }

      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      this.peerConnection.addEventListener('icegatheringstatechange', checkState);

      setTimeout(() => {
        this.peerConnection?.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 5000);
    });
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

/**
 * 将 SDP 和 ICE candidates 序列化为可传输的字符串
 */
export function serializeSignalData(sdp: RTCSessionDescriptionInit, candidates: RTCIceCandidateInit[]): string {
  return JSON.stringify({ sdp, candidates });
}

/**
 * 从字符串反序列化 SDP 和 ICE candidates
 */
export function deserializeSignalData(data: string): { sdp: RTCSessionDescriptionInit; candidates: RTCIceCandidateInit[] } {
  return JSON.parse(data);
}

/**
 * 压缩 SDP 数据（用于更短的传输字符串）
 */
export function compressSignalData(data: string): string {
  try {
    return btoa(encodeURIComponent(data));
  } catch {
    return data;
  }
}

/**
 * 解压 SDP 数据
 */
export function decompressSignalData(data: string): string {
  try {
    return decodeURIComponent(atob(data));
  } catch {
    return data;
  }
}
