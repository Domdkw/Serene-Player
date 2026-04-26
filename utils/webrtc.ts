/**
 * WebRTC P2P 连接管理模块（基于 PeerJS）
 * 用于"一起听"功能的实时音频同步
 */

import { loadPeerJSLib } from './peerjsLoader';

export interface SyncMessage {
  type: 'play' | 'pause' | 'seek' | 'track_change' | 'sync_all' | 'request_sync' | 'sync_state' | 'initial_sync';
  payload: {
    currentTime?: number;
    isPlaying?: boolean;
    neteaseId?: number;
    timestamp?: number;
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

/**
 * 验证房间号是否有效
 * 规则：长度大于 8 位，字母数量大于 4 个，符合 PeerJS ID 格式要求
 * @param roomId 房间号
 * @returns 验证结果
 */
export function validateRoomId(roomId: string): { valid: boolean; error?: string } {
  if (!roomId || roomId.length === 0) {
    return { valid: false, error: '请输入房间号' };
  }

  if (roomId.length <= 8) {
    return { valid: false, error: '房间号长度必须大于 8 位' };
  }

  const letterCount = (roomId.match(/[a-zA-Z]/g) || []).length;
  if (letterCount <= 4) {
    return { valid: false, error: '房间号必须包含多于 4 个字母' };
  }

  // PeerJS ID 格式验证：必须以字母或数字开头和结尾，中间可以包含字母、数字、下划线、短横线
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$/.test(roomId) && roomId.length !== 1) {
    return { valid: false, error: '房间号只能包含字母、数字、下划线 (_) 和短横线 (-)' };
  }

  return { valid: true };
}

/**
 * 生成符合规则的房间号
 * 规则：长度大于 8 位，字母数量大于 4 个
 * @returns 生成的房间号
 */
export function generateRoomId(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  
  // 确保至少有 5 个字母
  let roomId = '';
  for (let i = 0; i < 5; i++) {
    roomId += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  // 添加随机字符使总长度达到 10 位
  const allChars = letters + numbers;
  for (let i = 0; i < 5; i++) {
    roomId += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // 打乱顺序
  return roomId.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * WebRTC P2P 连接管理类（基于 PeerJS）
 */
export class PeerConnection {
  private peer: any = null;
  private connection: any = null;
  private callbacks: PeerConnectionCallbacks;
  private isHost: boolean = false;
  private roomId: string | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(callbacks: PeerConnectionCallbacks) {
    this.callbacks = callbacks;
  }

  private log(type: ConnectionLog['type'], message: string, details?: string): void {
    if (this.callbacks.onLog) {
      this.callbacks.onLog({ type, message, details });
    }
  }

  /**
   * 初始化 PeerJS
   * @param forceId 是否强制使用指定的 roomId（主机模式）
   */
  private async initializePeer(forceId: boolean = false): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise<void>((resolve, reject) => {
      try {
        loadPeerJSLib().then((Peer) => {
          // 如果是主机模式，使用指定的 roomId；否则让 PeerJS 自动生成 ID
          const peerId = (forceId && this.roomId) ? this.roomId : undefined;
          
          this.peer = new Peer(peerId, {
            debug: 2,
          });

          const cleanup = () => {
            if (this.peer) {
              this.peer.off('open');
              this.peer.off('error');
            }
          };

          this.peer.on('open', (id: string) => {
            this.log('connection', `PeerJS 已初始化，ID: ${id}`);
            cleanup();
            resolve();
          });

          this.peer.on('error', (error: any) => {
            this.log('error', `PeerJS 错误：${error.type}`, error.message);
            cleanup();
            this.callbacks.onConnectionStateChange({
              status: 'failed',
              errorMessage: `连接错误：${error.type}`,
            });
            reject(error);
          });
        }).catch((error) => {
          this.log('error', 'PeerJS 加载失败', String(error));
          this.callbacks.onError('PeerJS 库加载失败');
          reject(error);
        });
      } catch (error) {
        this.log('error', 'PeerJS 初始化失败', String(error));
        this.callbacks.onError('PeerJS 库初始化失败');
        reject(error);
      }
    });

    return this.initPromise;
  }

  /**
   * 创建房间（作为主机）
   * @param customRoomId 自定义房间号（可选）
   * @returns 房间号
   */
  async createRoom(customRoomId?: string): Promise<string> {
    this.isHost = true;
    this.roomId = customRoomId || generateRoomId();
    
    await this.initializePeer(true);

    return this.roomId;
  }

  /**
   * 加入房间（作为客户端）
   * @param roomId 房间号
   */
  async joinRoom(roomId: string): Promise<void> {
    this.isHost = false;
    this.roomId = null; // 客户端不需要设置自己的 ID
    
    // 先初始化 peer（不指定 ID，让 PeerJS 自动生成）
    await this.initializePeer(false);

    // 等待 peer 完全初始化
    if (!this.peer || !this.peer.id) {
      throw new Error('PeerJS 初始化失败');
    }

    // 连接到主机
    await this.connectToPeer(roomId);
  }

  /**
   * 连接到指定的 Peer
   * @param peerId 目标 Peer ID
   */
  private async connectToPeer(peerId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.log('connection', `正在连接到 ${peerId}...`);
      this.callbacks.onConnectionStateChange({ status: 'connecting' });

      this.connection = this.peer.connect(peerId, {
        label: 'sync',
        reliable: true,
      });

      const cleanup = () => {
        if (this.connection) {
          this.connection.off('open');
          this.connection.off('error');
        }
      };

      this.connection.on('open', () => {
        this.log('datachannel', '数据通道已打开');
        cleanup();
        this.callbacks.onConnectionStateChange({ status: 'connected' });
        resolve();
      });

      this.connection.on('error', (error: any) => {
        this.log('error', '连接失败', String(error));
        cleanup();
        this.callbacks.onConnectionStateChange({
          status: 'failed',
          errorMessage: '无法连接到对方',
        });
        reject(error);
      });

      // 设置其他事件处理器
      this.setupConnectionHandlers();
    });
  }

  /**
   * 设置连接事件处理器
   */
  private setupConnectionHandlers(): void {
    if (!this.connection) return;

    this.connection.on('close', () => {
      this.log('datachannel', '数据通道已关闭');
      this.callbacks.onConnectionStateChange({ status: 'disconnected' });
    });

    this.connection.on('error', (error: any) => {
      this.log('error', '数据通道错误', String(error));
      this.callbacks.onError('数据通道错误');
    });

    this.connection.on('data', (data: any) => {
      try {
        const message: SyncMessage = JSON.parse(data);
        this.callbacks.onMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    });
  }

  /**
   * 监听传入的连接（主机使用）
   */
  listenForConnections(): void {
    if (!this.peer) return;

    this.peer.on('connection', (conn: any) => {
      this.log('connection', '接收到新的连接请求');
      this.connection = conn;
      
      // 设置连接事件处理器
      const cleanup = () => {
        if (this.connection) {
          this.connection.off('open');
          this.connection.off('error');
        }
      };

      this.connection.on('open', () => {
        this.log('datachannel', '数据通道已打开');
        cleanup();
        this.callbacks.onConnectionStateChange({ status: 'connected' });
      });

      this.connection.on('error', (error: any) => {
        this.log('error', '连接错误', String(error));
        cleanup();
        this.callbacks.onConnectionStateChange({
          status: 'failed',
          errorMessage: '连接错误',
        });
      });

      this.setupConnectionHandlers();
    });
  }

  /**
   * 发送同步消息
   */
  sendMessage(message: SyncMessage): void {
    if (this.connection && this.connection.open) {
      this.connection.send(JSON.stringify(message));
      this.log('datachannel', `发送消息：${message.type}`);
    } else {
      console.warn('Data channel is not open');
      this.log('error', '数据通道未打开，无法发送消息');
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionState {
    if (!this.peer) {
      return { status: 'disconnected' };
    }

    if (this.connection && this.connection.open) {
      return { status: 'connected' };
    }

    if (this.peer.disconnected) {
      return { status: 'disconnected' };
    }

    return { status: 'connecting' };
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connection?.open === true;
  }

  /**
   * 获取房间号
   */
  getRoomId(): string | null {
    return this.roomId;
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.log('connection', '关闭连接');
    
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.initPromise = null;
    this.callbacks.onConnectionStateChange({ status: 'disconnected' });
  }
}
