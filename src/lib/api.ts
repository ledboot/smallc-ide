import axios, {type AxiosInstance, AxiosHeaders} from 'axios';
import {ChainType, DebugCallType, CHAIN_INFO} from '@/constants';

// Store client instances
const clientInstances: Record<ChainType, RPCClient> = {} as Record<
  ChainType,
  RPCClient
>;

export class RPCClient {
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

  // Reset/delete the cached client instance to force re-instantiation
  public static resetClient(
    chainType: ChainType = ChainType.ZENT_TESTNET,
  ): void {
    delete clientInstances[chainType];
  }

  // Generic RPC call
  async rpcCall(method: string, params: unknown[] = []) {
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
    }
    return response.data;
  }

  // fn: detach、attach、clearbreakpoint、breakpoint、
  async debugCall(fn: DebugCallType, params: any[] = []) {
    return this.rpcCall('vmdebug', [fn, ...params]);
  }

  async signRawTransaction(
    hexString: string,
    params: unknown[],
    privkeys: string[],
    ishash: boolean,
  ) {
    return await this.rpcCall('signrawtransaction', [
      hexString,
      params,
      privkeys,
      ishash,
    ]);
  }

  // TODO true,15秒内确认
  async sendRawTransaction(hextx: string) {
    return this.rpcCall('sendrawtransaction', [hextx, true, 15]);
  }

  async contractCall(contractAddress: string, params: string) {
    return this.rpcCall('contractcall', [contractAddress, params]);
  }

  async tryContract(hex: string) {
    return this.rpcCall('trycontract', [hex]);
  }
}

export const getRPCClient = (chainType: ChainType = ChainType.ZENT_TESTNET) => {
  return RPCClient.getClient(chainType);
};

export const rpcClient = RPCClient;
