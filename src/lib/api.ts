import axios, {type AxiosInstance, AxiosHeaders} from 'axios';
import {ChainType, DebugCallType, CHAIN_INFO} from '@/constants';

// Store client instances
const clientInstances: Record<ChainType, RPCClient> = {} as Record<
  ChainType,
  RPCClient
>;

class RPCClient {
  private readonly client: AxiosInstance;
  private sessionId: number;
  public readonly chainId: number;

  constructor(chainType: ChainType = ChainType.ZENT_TESTNET) {
    const config = CHAIN_INFO[chainType];

    this.client = axios.create({
      baseURL: config.endpoints[0],
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.chainId = config.chainId;
    this.sessionId = 1;
    const rpcUser = config.rpcUser;
    const rpcPassword = config.rpcPassword;

    // Add request interceptor for auth
    this.client.interceptors.request.use(config => {
      const headers = new AxiosHeaders({
        ...config.headers,
        'Content-Type': 'application/json',
      });

      headers.set(
        'Authorization',
        `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString('base64')}`,
      );

      return {
        ...config,
        headers,
      };
    });
  }

  // Get or create client instance for a specific chain
  public static getClient(
    chainType: ChainType = ChainType.ZENT_TESTNET,
  ): RPCClient {
    if (!clientInstances[chainType]) {
      clientInstances[chainType] = new RPCClient(chainType);
    }
    return clientInstances[chainType];
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
      console.log('response', response);
      console.log(
        '[rpcCall] method:',
        method,
        ' params:',
        params,
        ' response:',
        response,
      );
      if (response.data && response.data.error) {
        console.error('RPC error:', response.data.error);
        throw new Error(response.data.error.message || 'RPC call failed');
      }
      return response.data;
    } catch (error: any) {
      console.error(`RPC call failed for method ${method}:`, error);
      throw new Error(String(error));
    }
  }

  // fn: detach、attach、clearbreakpoint、breakpoint、
  async debugCall(fn: DebugCallType) {
    return this.rpcCall('vmdebug', [fn]);
  }

  async signRawTransaction(
    hexString: string,
    params: unknown[],
    privkeys: string[],
    ishash: boolean,
  ) {
    const res = await this.rpcCall('signrawtransaction', [
      hexString,
      params,
      privkeys,
      ishash,
    ]);
    return res.result;
  }

  // TODO true,15秒内确认
  async sendRawTransaction(hextx: string) {
    return this.rpcCall('sendrawtransaction', [hextx, true, 15]);
  }

  async contractCall(contractAddress: string, params: string) {
    return this.rpcCall('contractcall', [contractAddress, params]);
  }
}

export const getRPCClient = (chainType: ChainType = ChainType.ZENT_TESTNET) => {
  return RPCClient.getClient(chainType);
};

export const rpcClient = RPCClient;
