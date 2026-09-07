'use client';

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {
  leaseRpcNode,
  releaseRpcNode,
  type ZentNodeInfo,
  type SignatureHeaders,
} from '@/lib/adminApi';
import {useWalletStore} from '@/state/useWallet';
import {ChainType, CHAIN_INFO} from '@/constants';
import {rpcClient} from '@/lib/api';
import {disconnectDebugWSClient} from '@/lib/debugWebSocket';
import {toast} from 'sonner';

interface NodeState {
  leasedNode: ZentNodeInfo | null;
  isLeasing: boolean;
  leaseError: string | null;
  timeRemaining: number; // in seconds
}

interface NodeActions {
  leaseNode: () => Promise<ZentNodeInfo | null>;
  releaseNode: () => Promise<void>;
  setTimeRemaining: (time: number) => void;
  decrementTime: () => void;
  restoreDefaultConfig: () => void;
}

let countdownInterval: NodeJS.Timeout | null = null;

export const useNodeStore = create(
  persist<NodeState & NodeActions>(
    (set, get) => ({
      leasedNode: null,
      isLeasing: false,
      leaseError: null,
      timeRemaining: 0,

      leaseNode: async () => {
        const {currentAccount, signMessage, isConnected} =
          useWalletStore.getState();
        if (!isConnected || !currentAccount) {
          toast.error('Wallet Disconnected', {
            description: 'Please connect your plugin wallet to lease a node.',
          });
          return null;
        }

        set({isLeasing: true, leaseError: null});
        try {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          // Message format: Lease Zent RPC\nAddress: <wallet_address>\nTimestamp: <unix_timestamp>
          const rawMessage = `Lease Zent RPC\nAddress: ${currentAccount}\nTimestamp: ${timestamp}`;

          // Trigger signature popup in wallet extension
          const signature = await signMessage(rawMessage);

          const sigHeaders: SignatureHeaders = {
            'X-Sign-PublicKey': currentAccount,
            'X-Sign-Timestamp': timestamp,
            'X-Sign-Signature': signature,
          };

          const node = await leaseRpcNode(currentAccount, sigHeaders);

          // Dynamically update CHAIN_INFO using the pre-configured endpoints
          CHAIN_INFO[ChainType.ZENT_TESTNET].endpoints = [node.httpsEndpoint];
          CHAIN_INFO[ChainType.ZENT_TESTNET].wsEndpoints = [node.wssEndpoint];
          CHAIN_INFO[ChainType.ZENT_TESTNET].rpcUser = node.rpcUser;
          CHAIN_INFO[ChainType.ZENT_TESTNET].rpcPassword = node.rpcPass;

          // Clear cached clients to force using new configuration
          rpcClient.resetClient(ChainType.ZENT_TESTNET);
          disconnectDebugWSClient(ChainType.ZENT_TESTNET);

          set({
            leasedNode: {
              ...node,
              name: node.name || 'Zent Dedicated RPC',
            },
            isLeasing: false,
            timeRemaining: 600, // 10 minutes default lease time
          });

          // Start the countdown timer
          if (countdownInterval) {
            clearInterval(countdownInterval);
          }
          countdownInterval = setInterval(() => {
            get().decrementTime();
          }, 1000);

          toast.success('Dedicated RPC Node Leased Successfully!', {
            description: `Leased node: ${node.name || 'Zent Dedicated RPC'}. Valid for 10 minutes.`,
          });

          return node;
        } catch (error: any) {
          const errMsg = error.message || 'Failed to lease node';
          set({isLeasing: false, leaseError: errMsg});
          toast.error('Lease RPC Node Failed', {description: errMsg});
          return null;
        }
      },

      releaseNode: async () => {
        const {leasedNode} = get();
        if (!leasedNode) return;

        const {currentAccount, signMessage, isConnected} =
          useWalletStore.getState();
        if (!isConnected || !currentAccount) {
          toast.error('Wallet Disconnected', {
            description:
              'Please connect your plugin wallet to release the leased node.',
          });
          return;
        }

        try {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          // Message format: Release Zent RPC\nAddress: <wallet_address>\nTimestamp: <unix_timestamp>
          const rawMessage = `Release Zent RPC\nAddress: ${currentAccount}\nTimestamp: ${timestamp}`;

          // Trigger signature popup in wallet extension
          const signature = await signMessage(rawMessage);

          const sigHeaders: SignatureHeaders = {
            'X-Sign-PublicKey': currentAccount,
            'X-Sign-Timestamp': timestamp,
            'X-Sign-Signature': signature,
          };

          await releaseRpcNode(leasedNode.id, currentAccount, sigHeaders);

          // Success: restore default settings locally and show success toast
          get().restoreDefaultConfig();
          toast.success('Dedicated RPC Node Released Successfully', {
            description: 'Returned to shared public testnet node.',
          });
        } catch (error: any) {
          console.error('Failed to release node on server:', error);
          const errMsg = error.message || 'Failed to release node';
          toast.error('Release RPC Node Failed', {
            description: errMsg,
          });
        }
      },

      setTimeRemaining: (time: number) => set({timeRemaining: time}),

      decrementTime: () => {
        const {timeRemaining} = get();
        if (timeRemaining <= 1) {
          if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
          }
          get().restoreDefaultConfig();
          toast.warning('RPC Node Lease Expired', {
            description:
              'Lease expired. Reverted to shared public testnet node.',
          });
        } else {
          set({timeRemaining: timeRemaining - 1});
        }
      },

      restoreDefaultConfig: () => {
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }

        // Revert CHAIN_INFO back to empty defaults
        CHAIN_INFO[ChainType.ZENT_TESTNET].endpoints = [];
        CHAIN_INFO[ChainType.ZENT_TESTNET].wsEndpoints = [];
        CHAIN_INFO[ChainType.ZENT_TESTNET].rpcUser = '';
        CHAIN_INFO[ChainType.ZENT_TESTNET].rpcPassword = '';

        // Reset client caches
        rpcClient.resetClient(ChainType.ZENT_TESTNET);
        disconnectDebugWSClient(ChainType.ZENT_TESTNET);

        set({
          leasedNode: null,
          timeRemaining: 0,
        });
      },
    }),
    {
      name: 'node-lease',
      storage: createJSONStorage(() => localStorage),
      partialize: state =>
        ({
          leasedNode: state.leasedNode,
        }) as any,
      // On rehydration, if we had a leased node, we must restore the configuration in CHAIN_INFO!
      onRehydrateStorage: () => state => {
        if (state && state.leasedNode) {
          const node = state.leasedNode;

          CHAIN_INFO[ChainType.ZENT_TESTNET].endpoints = [node.httpsEndpoint];
          CHAIN_INFO[ChainType.ZENT_TESTNET].wsEndpoints = [node.wssEndpoint];
          CHAIN_INFO[ChainType.ZENT_TESTNET].rpcUser = node.rpcUser;
          CHAIN_INFO[ChainType.ZENT_TESTNET].rpcPassword = node.rpcPass;

          rpcClient.resetClient(ChainType.ZENT_TESTNET);
          disconnectDebugWSClient(ChainType.ZENT_TESTNET);

          // We don't know exactly how much time is left, but we can set it to a conservative default or 0,
          // or we can calculate based on leasedAt timestamp if available.
          if (node.leasedAt) {
            const leasedTimeMs = new Date(node.leasedAt).getTime();
            const elapsedSeconds = Math.floor(
              (Date.now() - leasedTimeMs) / 1000,
            );
            const remaining = Math.max(0, 600 - elapsedSeconds);
            state.setTimeRemaining(remaining);
            if (remaining > 0) {
              if (countdownInterval) clearInterval(countdownInterval);
              countdownInterval = setInterval(() => {
                state.decrementTime();
              }, 1000);
            } else {
              state.restoreDefaultConfig();
            }
          } else {
            // No leasedAt means we cannot verify the lease is still valid — clear it.
            state.restoreDefaultConfig();
          }
        }
      },
    },
  ),
);
