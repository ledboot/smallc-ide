'use client';

import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import {leaseRpcNode, releaseRpcNode, type ZentNodeInfo} from '@/lib/adminApi';
import {ChainType, CHAIN_INFO} from '@/constants';
import {rpcClient} from '@/lib/api';
import {disconnectDebugWSClient} from '@/lib/debugWebSocket';
import {toast} from 'sonner';

// Keep a copy of original Testnet configuration to restore when lease expires or is released.
const ORIGINAL_TESTNET_CONFIG = {
  endpoints: ['http://omegasuite.org:7789'],
  wsEndpoints: ['ws://omegasuite.org:7789/ws'],
  rpcUser: 'admin',
  rpcPassword: 'FFh5rL',
};

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
        set({isLeasing: true, leaseError: null});
        try {
          const node = await leaseRpcNode();

          // Re-format host if needed (strip protocol if any exists, but usually it's just hostname or IP)
          const cleanHost = node.host.replace(
            /^(hw|http|https|ws|wss):\/\//,
            '',
          );
          const nodeHttpEndpoint = `http://${cleanHost}:${node.port}`;
          const nodeWsEndpoint = `ws://${cleanHost}:${node.port}/ws`;

          // Dynamically update CHAIN_INFO
          CHAIN_INFO[ChainType.ZENT_TESTNET].endpoints = [nodeHttpEndpoint];
          CHAIN_INFO[ChainType.ZENT_TESTNET].wsEndpoints = [nodeWsEndpoint];
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

        try {
          await releaseRpcNode(leasedNode.id);
        } catch (error) {
          console.error('Failed to release node on server:', error);
        } finally {
          // Always restore default settings locally even if release request failed
          get().restoreDefaultConfig();
          toast.info('Dedicated RPC Node Released', {
            description: 'Returned to shared public testnet node.',
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

        // Revert CHAIN_INFO back to original defaults
        CHAIN_INFO[ChainType.ZENT_TESTNET].endpoints = [
          ...ORIGINAL_TESTNET_CONFIG.endpoints,
        ];
        CHAIN_INFO[ChainType.ZENT_TESTNET].wsEndpoints = [
          ...ORIGINAL_TESTNET_CONFIG.wsEndpoints,
        ];
        CHAIN_INFO[ChainType.ZENT_TESTNET].rpcUser =
          ORIGINAL_TESTNET_CONFIG.rpcUser;
        CHAIN_INFO[ChainType.ZENT_TESTNET].rpcPassword =
          ORIGINAL_TESTNET_CONFIG.rpcPassword;

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
          const cleanHost = node.host.replace(
            /^(hw|http|https|ws|wss):\/\//,
            '',
          );
          const nodeHttpEndpoint = `http://${cleanHost}:${node.port}`;
          const nodeWsEndpoint = `ws://${cleanHost}:${node.port}/ws`;

          CHAIN_INFO[ChainType.ZENT_TESTNET].endpoints = [nodeHttpEndpoint];
          CHAIN_INFO[ChainType.ZENT_TESTNET].wsEndpoints = [nodeWsEndpoint];
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
            state.setTimeRemaining(0);
          }
        }
      },
    },
  ),
);
