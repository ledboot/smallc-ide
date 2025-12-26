import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {ChainType, NetworkType} from '../constants';

export interface SettingsState {
  locale: string;
  networkType: NetworkType;
  chainType: ChainType;
}

export interface SettingsActions {
  setLocale: (locale: string) => void;
  setNetworkType: (networkType: NetworkType) => void;
  setChainType: (chainType: ChainType) => void;
}

const initialState: SettingsState = {
  locale: 'en',
  networkType: NetworkType.TESTNET,
  chainType: ChainType.ZENT_TESTNET,
};

export const useSettingsStore = create(
  persist<SettingsState & SettingsActions>(
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
