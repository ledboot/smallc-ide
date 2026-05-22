import type {ChainInfo} from '@/types';
import type {FileType} from '@/types';

export enum ChainType {
  ZENT_TESTNET = 'ZENT_TESTNET',
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
    endpoints: [],
    wsEndpoints: [],
    icon: './images/artifacts/bitcoin-mainnet.svg',
    unit: 'ZENT',
    rpcUser: '',
    rpcPassword: '',
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
