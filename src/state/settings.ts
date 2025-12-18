import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {ChainType, NetworkType} from '../constants';

export interface SettingsState {
  locale: string;
  networkType: NetworkType;
  chainType: ChainType;
}

const initialState: SettingsState = {
  locale: 'en',
  networkType: NetworkType.TESTNET,
  chainType: ChainType.ZENT_TESTNET,
};

export const settingsStore = create(
  persist<SettingsState>(
    set => ({
      ...initialState,
      setLocale: (locale: string) => set({locale}),
      setNetworkType: (networkType: NetworkType) => set({networkType}),
      setChainType: (chainType: ChainType) => set({chainType}),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
