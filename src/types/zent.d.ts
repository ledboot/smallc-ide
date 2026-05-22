/**
 * Global type declaration for the `window.zent` wallet provider.
 * Injected by the Zentrophy wallet extension (world:"MAIN").
 */

export interface ZentUtxo {
  txid: string;
  index: number;
  value: number; // satoshis
  tokenType: string;
  address?: string;
  scriptPubKey?: string;
}

export interface ZentNetwork {
  id: string;
  chainId: number;
  name: string;
  rpcUrl?: string;
  icon: string;
}

export interface ZentBalance {
  balance: number;
  decimals: number;
  symbol: string;
}

export interface ZentProvider {
  /** Connect wallet — opens extension popup. Returns connected accounts. */
  requestAccounts(): Promise<string[]>;
  /** Disconnect from the current site. */
  disconnect(): Promise<void>;
  /** Get already-connected accounts (no popup). */
  getAccounts(): Promise<string[]>;
  /** Get the currently active account object. */
  getCurrentAccount(): Promise<{address: string} | null>;
  /** Get the active network. */
  getNetwork(): Promise<ZentNetwork>;
  /** Get all available networks. */
  getNetworks(): Promise<{[key: string]: ZentNetwork}>;
  /** Switch to a different network by chainId. */
  switchNetwork(chainId: number): Promise<void>;
  /** Get balance for an address. */
  getBalance(address: string, chainId?: number): Promise<ZentBalance>;

  getCurrentAccountUtxos(): Promise<ZentUtxo[]>;
  /**
   * Sign a raw transaction hex.
   * The extension will prompt the user for approval.
   */
  signTransaction(rawTxHex: string): Promise<{signedTransaction: string}>;
  /**
   * Sign a text message.
   * The extension will prompt the user for approval.
   */
  signMessage(message: string): Promise<string>;
  /**
   * Broadcast a signed raw transaction hex.
   */
  sendTransaction(signedTxHex: string): Promise<{txHash: string}>;
  /**
   * Simulate a contract transaction hex without broadcasting.
   */
  tryContract(rawTxHex: string): Promise<{id: string; error: any; result: any}>;
  /**
   * Call a contract method with prepared params.
   */
  contractCall(
    contractAddress: string,
    params: string,
  ): Promise<{id: string; error: any; result: any}>;

  // EventEmitter API
  on(event: 'connect', listener: (data: unknown) => void): this;
  on(event: 'disconnect', listener: (data: unknown) => void): this;
  on(event: 'accountsChanged', listener: (accounts: string[]) => void): this;
  on(event: 'networkChanged', listener: (networkId: string) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
}

declare global {
  interface Window {
    zent?: ZentProvider;
  }
}
