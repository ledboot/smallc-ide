import axios, { AxiosInstance, AxiosHeaders } from 'axios';
import { ChainType } from '@/constants';
import { CHAIN_INFO } from '@/constants';


// Store client instances
const clientInstances: Record<ChainType, RPCClient> = {} as Record<ChainType, RPCClient>;

class RPCClient {
  private readonly client: AxiosInstance;
  private sessionId: number;
  private authToken: string | null;
  public readonly chainId: number;

  constructor(chainType: ChainType = ChainType.ZENT_TESTNET, authToken: string = '') {
    const config = CHAIN_INFO[chainType];
    
    this.client = axios.create({
      baseURL: config.endpoints[0],
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.chainId = config.chainId;
    this.sessionId = 1;
    this.authToken = authToken;

    // Add request interceptor for auth
    this.client.interceptors.request.use((config) => {
      const headers = new AxiosHeaders({
        ...config.headers,
        'Content-Type': 'application/json',
      });

      if (this.authToken) {
        headers.set('Authorization', `Basic ${this.authToken}`);
      }

      return {
        ...config,
        headers,
      };
    });
  }

    // Get or create client instance for a specific chain
  public static getClient(chainType: ChainType = ChainType.ZENT_TESTNET, authToken: string = ''): RPCClient {
    if (!clientInstances[chainType]) {
      clientInstances[chainType] = new RPCClient(chainType, authToken);
    } else if (authToken && clientInstances[chainType].authToken !== authToken) {
      // Update auth token if provided and different
      clientInstances[chainType].setAuthToken(authToken);
    }
    return clientInstances[chainType];
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.authToken = token;
  }

  // Generic RPC call
  async rpcCall(method: string, params: unknown[] = []) {
    try {
      const response = await this.client.post('', {
        jsonrpc: '1.0',
        method,
        params,
        id: this.sessionId++,
      });
      return response.data.result;
    } catch (error) {
      console.error(`RPC call failed for method ${method}:`, error);
      throw error;
    }
  }

  // fn: detach、attach、clearbreakpoint、breakpoint、
  async debugCall(fn: string) {
    return this.rpcCall('vmdebug', [fn]);
  }

  async signRawTransaction(hexString:string,params:unknown[],privkeys:string[],sighashtype:string = "ALL"){
    return this.rpcCall('signrawtransaction', [hexString, params, privkeys, sighashtype]);
  }

  // TODO true,15分别是什么意思？
  async sendRawTransaction(rawTx:string){
    return this.rpcCall('sendrawtransaction', [rawTx,true,15]);
  }

}

export const getRPCClient = (chainType: ChainType = ChainType.ZENT_TESTNET, authToken: string = '') => {
  return RPCClient.getClient(chainType, authToken);
};

export const rpcClient = RPCClient;