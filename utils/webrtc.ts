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

export interface ConnectionLog {
  type: 'stun' | 'ice' | 'connection' | 'datachannel' | 'error';
  message: string;
  details?: string;
}

export interface PeerConnectionCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onMessage: (message: SyncMessage) => void;
  onError: (error: string) => void;
  onLog?: (log: ConnectionLog) => void;
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.miwifi.com:3478' },
  { urls: 'stun:stun.chat.bilibili.com:3478' },
  { urls: 'stun:stun.qq.com:3478' },
  { urls: 'stun:stun.nextcloud.com:3478' },
  { urls: 'stun:stun.google.com:19302' },
];

/**
 * 解析 ICE candidate 类型
 */
function parseCandidateType(candidate: string): { type: string; protocol: string; ip: string; port: string } | null {
  const parts = candidate.split(' ');
  let type = 'unknown';
  let protocol = 'unknown';
  let ip = 'unknown';
  let port = 'unknown';

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'typ' && parts[i + 1]) {
      type = parts[i + 1];
    }
    if (parts[i] === 'protocol' && parts[i + 1]) {
      protocol = parts[i + 1].toUpperCase();
    }
    if (parts[i] === 'udp' || parts[i] === 'tcp') {
      protocol = parts[i].toUpperCase();
    }
    if (parts[i] && parts[i].match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      ip = parts[i];
    }
    if (parts[i] && parts[i].match(/^\d+$/) && parts[i - 1] && parts[i - 1].match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
      port = parts[i];
    }
  }

  return { type, protocol, ip, port };
}

/**
 * 获取候选类型的中文描述
 */
function getCandidateTypeDesc(type: string): string {
  switch (type) {
    case 'host': return '本地地址';
    case 'srflx': return '服务器反射';
    case 'prflx': return '对等反射';
    case 'relay': return '中继';
    default: return type;
  }
}

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
  private stunServerIndex: number = 0;

  constructor(callbacks: PeerConnectionCallbacks) {
    this.callbacks = callbacks;
  }

  private log(type: ConnectionLog['type'], message: string, details?: string): void {
    if (this.callbacks.onLog) {
      this.callbacks.onLog({ type, message, details });
    }
  }

  /**
   * 创建新的 P2P 连接（作为发起方）
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.isInitiator = true;
    this.cleanup();

    this.log('stun', '初始化 STUN 服务器', STUN_SERVERS.map(s => s.urls).join('\n'));

    this.peerConnection = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    this.setupPeerConnectionHandlers();

    this.dataChannel = this.peerConnection.createDataChannel('sync', {
      ordered: true,
    });
    this.setupDataChannelHandlers();

    this.log('connection', '创建 Offer...');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.log('ice', '开始收集 ICE 候选...');
    await this.waitForIceGathering();

    return this.peerConnection.localDescription!;
  }

  /**
   * 接收 offer 并创建 answer（作为接收方）
   */
  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    this.isInitiator = false;
    this.cleanup();

    this.log('stun', '初始化 STUN 服务器', STUN_SERVERS.map(s => s.urls).join('\n'));

    this.peerConnection = new RTCPeerConnection({
      iceServers: STUN_SERVERS,
    });

    this.setupPeerConnectionHandlers();

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers();
    };

    this.log('connection', '接收远程 Offer');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    this.log('connection', '创建 Answer...');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.log('ice', '开始收集 ICE 候选...');
    await this.waitForIceGathering();

    return this.peerConnection.localDescription!;
  }

  /**
   * 接收 answer 并完成连接（作为发起方）
   */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection exists');
    }

    this.log('connection', '接收远程 Answer');
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * 添加 ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No peer connection exists');
    }

    const parsed = parseCandidateType(candidate.candidate || '');
    if (parsed) {
      this.log('ice', `添加远程候选 [${parsed.type}]`, `${parsed.ip}:${parsed.port} (${parsed.protocol})`);
    }
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * 发送同步消息
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
    this.log('connection', '关闭连接');
    this.cleanup();
    this.callbacks.onConnectionStateChange({ status: 'disconnected' });
  }

  /**
   * 设置 PeerConnection 事件处理器
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.log('connection', `连接状态: ${state}`);
      const connState = this.getConnectionState();
      this.callbacks.onConnectionStateChange(connState);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      this.log('ice', `ICE 状态: ${iceState}`);
      if (iceState === 'failed') {
        this.callbacks.onConnectionStateChange({
          status: 'failed',
          errorMessage: 'ICE 连接失败，请检查网络环境',
        });
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      const state = this.peerConnection?.iceGatheringState;
      this.log('ice', `ICE 收集状态: ${state}`);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const parsed = parseCandidateType(event.candidate.candidate);
        if (parsed) {
          const typeDesc = getCandidateTypeDesc(parsed.type);
          this.log('ice', `发现本地候选 [${typeDesc}]`, `${parsed.ip}:${parsed.port} (${parsed.protocol})`);
        }
      } else {
        this.log('ice', 'ICE 候选收集完成');
      }
    };

    this.peerConnection.onicecandidateerror = (event) => {
      const errorEvent = event as RTCPeerConnectionIceErrorEvent;
      this.log('error', `ICE 候选错误`, `URL: ${errorEvent.url}, Code: ${errorEvent.errorCode}, Text: ${errorEvent.errorText}`);
    };
  }

  /**
   * 设置 DataChannel 事件处理器
   */
  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.log('datachannel', '数据通道已打开');
      this.callbacks.onConnectionStateChange({ status: 'connected' });
      this.reconnectAttempts = 0;
    };

    this.dataChannel.onclose = () => {
      this.log('datachannel', '数据通道已关闭');
      this.callbacks.onConnectionStateChange({ status: 'disconnected' });
    };

    this.dataChannel.onerror = (error) => {
      this.log('error', '数据通道错误', String(error));
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
        this.log('ice', 'ICE 收集超时 (5s)，使用已有候选');
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
