import type {ChainInfo} from '@/types';
import type {FileType} from '@/types';

export enum ChainType {
  //   ZENT_MAINNET = 'ZENT_MAINNET',
  ZENT_TESTNET = 'ZENT_TESTNET',
  ZENT_LOCAL = 'ZENT_LOCAL',
  //   HOVM_MAINNET = 'HOVM_MAINNET',
  //   GCT_TESTNET = 'GCT_TESTNET',
}

export enum NetworkType {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

export const CHAIN_INFO: {[key in ChainType]: ChainInfo} = {
  [ChainType.ZENT_TESTNET]: {
    label: 'ZENT Testnet',
    iconLabel: 'ZENT',
    chainId: 0x1,
    endpoints: ['http://omegasuite.org:7789'],
    wsEndpoints: ['ws://omegasuite.org:7789/ws'],
    icon: './images/artifacts/bitcoin-mainnet.svg',
    unit: 'ZENT',
    rpcUser: 'admin',
    rpcPassword: 'FFh5rL',
    networkType: NetworkType.TESTNET,
  },
  [ChainType.ZENT_LOCAL]: {
    label: 'ZENT Local',
    iconLabel: 'ZENT',
    chainId: 0x1,
    endpoints: ['http://127.0.0.1:7700'],
    wsEndpoints: ['ws://127.0.0.1:7700/ws'],
    icon: './images/artifacts/bitcoin-mainnet.svg',
    unit: 'ZENT',
    rpcUser: 'admin',
    rpcPassword: 'FFh5rL',
    networkType: NetworkType.TESTNET,
  },
};

export enum DebugCallType {
  attach = 'attach',
  detach = 'detach',
  clearbreakpoint = 'clearbreakpoint',
  breakpoint = 'breakpoint',
  stop = 'stop',
  go = 'go',
  step = 'step',
  up = 'up',
  getstack = 'getstack',
  getdata = 'getdata',
  evaluate = 'evaluate',
}

export const HOME_CONTENT = `
 ____   __  __     _     _      _      ____      ___  ____   _____ 
/ ___| |  \\/  |   / \\   | |    | |    / ___|    |_ _||  _ \\ | ____|
\\___ \\ | |\\/| |  / _ \\  | |    | |   | |         | | | | | ||  _|  
 ___) || |  | | / ___ \\ | |___ | |___| |___      | | | |_| || |___ 
|____/ |_|  |_|/_/   \\_\\|_____||_____|\\____|    |___||____/ |_____|

A powerful, web-based development environment for the SmallC language.

Welcome to SmallC IDE Web! Select a file from the explorer to start coding.
`;

export const HOME_TAB: FileType = {
  id: 'home',
  name: 'Home',
  content: HOME_CONTENT,
  lastModified: new Date().toISOString(),
  isDirectory: false,
};
