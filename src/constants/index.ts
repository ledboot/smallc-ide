import { ChainInfo } from "@/types";

export enum ChainType {
//   ZENT_MAINNET = 'ZENT_MAINNET',
  ZENT_TESTNET = 'ZENT_TESTNET',
//   HOVM_MAINNET = 'HOVM_MAINNET',
//   GCT_TESTNET = 'GCT_TESTNET',
}

export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}


export const CHAIN_INFO: { [key in ChainType]: ChainInfo } = {
  [ChainType.ZENT_TESTNET]: {
    label: 'ZENT Testnet',
    iconLabel: 'ZENT',
    chainId: 0x1,
    endpoints: ['http://omegasuite.org:7789'],
    icon: './images/artifacts/bitcoin-mainnet.svg',
    unit: 'ZENT',
    rpcUser: '',
    rpcPassword: '',
    networkType: NetworkType.TESTNET,
  },
};

export enum DebugCallType {
  attach = "attach",
  detach = "detach",
  clearbreakpoint = "clearbreakpoint",
  breakpoint = "breakpoint",
}