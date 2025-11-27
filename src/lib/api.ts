import axios, { AxiosInstance, AxiosHeaders } from "axios";
import { ChainType, DebugCallType, CHAIN_INFO } from "@/constants";

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
        "Content-Type": "application/json",
      },
    });

    this.chainId = config.chainId;
    this.sessionId = 1;
    const rpcUser = config.rpcUser;
    const rpcPassword = config.rpcPassword;

    // Add request interceptor for auth
    this.client.interceptors.request.use((config) => {
      const headers = new AxiosHeaders({
        ...config.headers,
        "Content-Type": "application/json",
      });

      headers.set(
        "Authorization",
        `Basic ${Buffer.from(`${rpcUser}:${rpcPassword}`).toString("base64")}`
      );

      return {
        ...config,
        headers,
      };
    });
  }

  // Get or create client instance for a specific chain
  public static getClient(
    chainType: ChainType = ChainType.ZENT_TESTNET
  ): RPCClient {
    if (!clientInstances[chainType]) {
      clientInstances[chainType] = new RPCClient(chainType);
    }
    return clientInstances[chainType];
  }

  // Generic RPC call
  async rpcCall(method: string, params: unknown[] = []) {
    try {
      const response = await this.client.post("", {
        jsonrpc: "1.0",
        method,
        params,
        id: this.sessionId++,
      });

      if (response.data.error) {
        // Handle JSON-RPC error
        const errorMessage = response.data.error.message || "Unknown RPC error";
        return [null, errorMessage];
      }
      return [response.data.result, null];
    } catch (error: any) {
      console.error(`RPC call failed for method ${method}:`, error);
      throw new Error(String(error));
    }
  }

  // fn: detach、attach、clearbreakpoint、breakpoint、
  async debugCall(fn: DebugCallType) {
    return this.rpcCall("vmdebug", [fn]);
  }

  async signRawTransaction(
    hexString: string,
    params: unknown[],
    privkeys: string[],
    ishash: boolean
  ) {
    return this.rpcCall("signrawtransaction", [
      hexString,
      params,
      privkeys,
      ishash,
    ]);
  }

  // TODO true,15分别是什么意思？
  async sendRawTransaction(hextx: string) {
    return this.rpcCall("sendrawtransaction", [hextx, true, 15]);
  }

  async contractCall(contractAddress: string, params: string) {
    return this.rpcCall("contractcall", [contractAddress, params]);
  }
}

export const getRPCClient = (chainType: ChainType = ChainType.ZENT_TESTNET) => {
  return RPCClient.getClient(chainType);
};

export const rpcClient = RPCClient;
