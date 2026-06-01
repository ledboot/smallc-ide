'use client';

import {create} from 'zustand';
import type {ZentNetwork, ZentUtxo} from '@/types/zent';

interface WalletState {
  /** true when window.zent is present (extension is installed) */
  isExtensionAvailable: boolean;
  isConnected: boolean;
  accounts: string[];
  currentAccount: string | null;
  network: ZentNetwork | null;
  networks: ZentNetwork[];

  /** Check presence of window.zent and sync state */
  init(): Promise<void>;
  /** Request accounts — opens extension popup */
  connect(): Promise<void>;
  /** Disconnect from the current site */
  disconnect(): Promise<void>;
  /** Switch network */
  switchNetwork(chainId: number): Promise<void>;
  /**
   * Fetch UTXOs for the current account.
   * Compatible forms:
   * - getUtxos()
   * - getUtxos(minValue)
   */
  getCurrentAccountUtxos(value?: number | bigint): Promise<ZentUtxo[]>;
  /**
   * Sign a raw tx hex via wallet.
   * Returns the signed transaction hex string.
   */
  signTransaction(rawTxHex: string): Promise<string>;
  /**
   * Broadcast a signed tx hex via wallet.
   * Returns the tx hash string.
   */
  sendTransaction(signedHex: string): Promise<string>;
  /**
   * Simulate a contract transaction without broadcasting.
   */
  tryContract(rawTxHex: string): Promise<{id: string; error: any; result: any}>;
  /**
   * Call contract method with contract address + params.
   */
  contractCall(
    contractAddress: string,
    params: string,
  ): Promise<{id: string; error: any; result: any}>;
  /**
   * Sign a text message via wallet.
   * Returns hex-encoded signature.
   */
  signMessage(message: string): Promise<string>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isExtensionAvailable: false,
  isConnected: false,
  accounts: [],
  currentAccount: null,
  network: null,
  networks: [],

  init: async () => {
    // Extension injects window.zent on document_start; poll briefly if not yet ready
    let zent = window.zent;
    if (!zent) {
      await new Promise<void>(resolve => {
        window.addEventListener('zent#initialized', () => resolve(), {
          once: true,
        });
        setTimeout(resolve, 1500); // give up after 1.5 s
      });
      zent = window.zent;
    }

    if (!zent) {
      set({isExtensionAvailable: false});
      return;
    }

    set({isExtensionAvailable: true});

    // Register event listeners safely
    if (typeof zent.on === 'function') {
      zent.on('accountsChanged', (accounts: string[]) => {
        console.log(
          '[useWalletStore] zent.on("accountsChanged") received accounts:',
          accounts,
        );
        const nextAccount = accounts?.[0] ?? null;
        console.log('[useWalletStore] setting currentAccount to:', nextAccount);
        set({
          accounts: accounts || [],
          currentAccount: nextAccount,
          isConnected: (accounts || []).length > 0,
        });
      });

      zent.on('networkChanged', async () => {
        const network = await window.zent?.getNetwork().catch(() => null);
        set({network: network ?? null});
      });
    }

    // Sync current state (non-blocking — extension may not be unlocked yet)
    try {
      const [accounts, network, networksMap] = await Promise.all([
        zent.getAccounts(),
        zent.getNetwork(),
        zent.getNetworks().catch(() => ({})),
      ]);
      set({
        accounts,
        currentAccount: accounts[0] ?? null,
        isConnected: accounts.length > 0,
        network,
        networks: Object.values(networksMap),
      });
    } catch {
      // wallet locked or not yet approved — that's fine
    }
  },

  connect: async () => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    const accounts = await zent.requestAccounts();
    const network = await zent.getNetwork().catch(() => null);
    const networksMap = await zent.getNetworks().catch(() => ({}));
    set({
      accounts,
      currentAccount: accounts[0] ?? null,
      isConnected: accounts.length > 0,
      network: network ?? null,
      networks: Object.values(networksMap),
    });
  },

  disconnect: async () => {
    await window.zent?.disconnect().catch(() => undefined);
    set({isConnected: false, accounts: [], currentAccount: null});
  },

  switchNetwork: async (chainId: number) => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    await zent.switchNetwork(chainId);
    const network = await zent.getNetwork().catch(() => null);
    set({network});
  },

  getCurrentAccountUtxos: async (value?: number | bigint) => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    if (!get().currentAccount) throw new Error('No account connected');
    const currentAccount = await zent.getCurrentAccount();
    console.log('[getCurrentAccountUtxos] Current account:', currentAccount);

    const utxos = await zent.getCurrentAccountUtxos();
    console.log('[getCurrentAccountUtxos] Raw UTXOs:', utxos);

    if (value === undefined) return utxos;

    const minValueBigInt = BigInt(value);
    console.log(
      '[getCurrentAccountUtxos] Required min value (satoshis):',
      minValueBigInt.toString(),
    );

    // Filter only native ZENT UTXOs (type is '0', '0000...', empty or missing)
    const nativeUtxos = utxos.filter(utxo => {
      const type = String(utxo.tokenType || '').trim();
      return (
        type === '0' ||
        type === '' ||
        type ===
          '0000000000000000000000000000000000000000000000000000000000000000'
      );
    });
    console.log('[getCurrentAccountUtxos] Native ZENT UTXOs:', nativeUtxos);

    const matched = nativeUtxos.filter(
      utxo => BigInt(utxo.value) >= minValueBigInt,
    );
    console.log('[getCurrentAccountUtxos] Matched UTXOs (>= min):', matched);

    return matched.slice(0, 1);
  },

  signTransaction: async (rawTxHex: string) => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    const result = await zent.signTransaction(rawTxHex);
    return result.signedTransaction;
  },

  sendTransaction: async (signedHex: string) => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    const result = await zent.sendTransaction(signedHex);
    return result.txHash;
  },

  tryContract: async (rawTxHex: string) => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    return zent.tryContract(rawTxHex);
  },

  contractCall: async (contractAddress: string, params: string) => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    return zent.contractCall(contractAddress, params);
  },

  signMessage: async (message: string) => {
    const zent = window.zent;
    if (!zent) throw new Error('Zent wallet extension not found');
    return zent.signMessage(message);
  },
}));
