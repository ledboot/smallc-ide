import {ChainType, DebugCallType, CHAIN_INFO} from '@/constants';
import {toast} from 'sonner';

interface DebugRPCRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

interface DebugRPCResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

export class DebugWebSocketClient {
  private ws: WebSocket | null = null;
  private chainType: ChainType;
  private sessionId = 1;
  private authenticated = false;
  private eventListeners: ((event: any) => void)[] = [];

  private pendingRequests = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      method: string;
    }
  >();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(chainType: ChainType = ChainType.ZENT_TESTNET) {
    this.chainType = chainType;
  }

  /**
   * Connect to WebSocket and authenticate
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN && this.authenticated) {
      console.log('WebSocket already connected and authenticated');
      return;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    this.isConnecting = true;
    this.connectionPromise = (async () => {
      try {
        const config = CHAIN_INFO[this.chainType];
        const wsUrl = config.wsEndpoints[0] || '';

        console.log(`Connecting to Native WebSocket: ${wsUrl}`);

        this.ws = new WebSocket(wsUrl);

        // Wait for connection to open
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.cleanup();
            reject(new Error('Connection timeout'));
          }, 10000);

          this.ws!.onopen = () => {
            clearTimeout(timeout);
            console.log('WebSocket connection opened');
            resolve();
          };

          this.ws!.onerror = err => {
            clearTimeout(timeout);
            reject(err);
          };

          this.ws!.onclose = () => {
            clearTimeout(timeout);
            reject(new Error('Connection closed during handshake'));
          };
        });

        // Set up main event handlers after connection is open
        this.setupEventHandlers();

        // Authenticate immediately as the first message
        await this.authenticate();

        this.reconnectAttempts = 0;
        toast.success('Debug session connected');
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
        this.cleanup();
        throw err;
      } finally {
        this.isConnecting = false;
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Authenticate using the authenticate RPC command
   */
  private async authenticate(): Promise<void> {
    const config = CHAIN_INFO[this.chainType];
    const {rpcUser, rpcPassword} = config;

    try {
      // Send authenticate command as first message
      console.log(`Authenticating as: ${rpcUser}`);
      const authRequest: DebugRPCRequest = {
        jsonrpc: '1.0',
        method: 'authenticate',
        params: [rpcUser, rpcPassword],
        id: this.sessionId++,
      };

      const response = await this.sendRequest(authRequest);

      if (response.error) {
        throw new Error(`Authentication failed: ${response.error.message}`);
      }

      this.authenticated = true;
      console.log('WebSocket authenticated successfully');
    } catch (err) {
      console.error('Authentication error:', err);
      throw err;
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id === null || data.id === undefined) {
          this.handleNotification(data);
        } else {
          this.handleResponse(data);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err, event.data);
      }
    };

    this.ws.onclose = event => {
      console.log('WebSocket closed:', event.code, event.reason);
      const wasAuthenticated = this.authenticated;
      this.authenticated = false;

      // Reject all pending requests
      this.pendingRequests.forEach(({reject, method}) => {
        reject(new Error(`WebSocket disconnected during ${method}`));
      });
      this.pendingRequests.clear();

      // Attempt to reconnect if not intentional disconnect and was previously authenticated
      if (!event.wasClean && wasAuthenticated) {
        this.handleReconnect();
      }
    };

    this.ws.onerror = err => {
      console.error('WebSocket error:', err);
    };
  }

  /**
   * Handle automatic reconnection
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      toast.error('Debug session disconnected. Please restart debugging.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`,
    );

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (err) {
        console.error('Reconnection failed:', err);
      }
    }, delay);
  }

  /**
   * Send RPC request over WebSocket
   */
  private sendRequest(request: DebugRPCRequest): Promise<DebugRPCResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      // Store pending request
      this.pendingRequests.set(request.id, {
        resolve,
        reject,
        method: request.method,
      });

      // Set timeout for request
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(request.id)) {
          this.pendingRequests.delete(request.id);
          reject(new Error(`Request timeout for ${request.method}`));
        }
      }, 30000);

      // Send request
      try {
        this.ws.send(JSON.stringify(request));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingRequests.delete(request.id);
        reject(err);
      }
    });
  }

  /**
   * Handle RPC response
   */
  private handleResponse(response: DebugRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      // Could be a notification if result/id matches certain patterns,
      // but standard JSON-RPC 1.0/2.0 responses should have an ID.
      return;
    }

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response);
    }
  }

  /**
   * Handle RPC notification (no ID)
   */
  private handleNotification(notification: any): void {
    if (notification.method === 'vmdebug.event') {
      const event = notification.params?.[0];
      console.log('[DebugWS] Received debug event:', event);
      this.eventListeners.forEach(listener => listener(event));
    } else {
      console.log('[DebugWS] Received other notification:', notification);
    }
  }

  /**
   * Add listener for debug events
   */
  onDebugEvent(listener: (event: any) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter(l => l !== listener);
    };
  }

  /**
   * Make a debug call (vmdebug RPC method)
   */
  async debugCall(fn: DebugCallType, params: any[] = []): Promise<any> {
    if (!this.authenticated) {
      // Try to connect/authenticate if not already
      await this.connect();
    }

    const request: DebugRPCRequest = {
      jsonrpc: '1.0',
      method: 'vmdebug',
      params: [fn, ...params],
      id: this.sessionId++,
    };

    console.log('[debugCall] fn:', fn, 'params:', params);

    const response = await this.sendRequest(request);

    console.log('[debugCall] response:', response);

    if (response.error) {
      console.error('Debug call error:', response.error);
      throw new Error(response.error.message);
    }

    return response;
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    console.log('Disconnecting debug WebSocket');
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.ws) {
      // Clear handlers to avoid trigger reconnection/errors during intentional close
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.authenticated = false;
    this.pendingRequests.forEach(({reject, method}) => {
      reject(new Error(`Connection cleaned up during ${method}`));
    });
    this.pendingRequests.clear();
    this.isConnecting = false;
    this.connectionPromise = null;
  }

  /**
   * Check if connected and authenticated
   */
  isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    authenticated: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      authenticated: this.authenticated,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Singleton instance manager
const debugWSClients: Map<ChainType, DebugWebSocketClient> = new Map();

/**
 * Get or create debug WebSocket client for a chain
 */
export function getDebugWSClient(
  chainType: ChainType = ChainType.ZENT_TESTNET,
): DebugWebSocketClient {
  if (!debugWSClients.has(chainType)) {
    debugWSClients.set(chainType, new DebugWebSocketClient(chainType));
  }
  return debugWSClients.get(chainType)!;
}

/**
 * Disconnect and remove debug WebSocket client
 */
export function disconnectDebugWSClient(
  chainType: ChainType = ChainType.ZENT_TESTNET,
): void {
  const client = debugWSClients.get(chainType);
  if (client) {
    client.disconnect();
    debugWSClients.delete(chainType);
  }
}

/**
 * Disconnect all debug WebSocket clients
 */
export function disconnectAllDebugWSClients(): void {
  debugWSClients.forEach(client => client.disconnect());
  debugWSClients.clear();
}
