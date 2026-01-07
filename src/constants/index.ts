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
    icon: './images/artifacts/bitcoin-mainnet.svg',
    unit: 'ZENT',
    rpcUser: '',
    rpcPassword: '',
    networkType: NetworkType.TESTNET,
  },
  [ChainType.ZENT_LOCAL]: {
    label: 'ZENT Local',
    iconLabel: 'ZENT',
    chainId: 0x1,
    endpoints: ['http://localhost:7700'],
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
  breakpoints = 'breakpoints',
  start = 'start',
  stop = 'stop',
  continue = 'continue',
  pause = 'pause',
  stepOver = 'stepOver',
  stepInto = 'stepInto',
  stepOut = 'stepOut',
}

export const HOME_CONTENT = `
 ____   __  __     _     _      _      ____      ___  ____   _____ 
/ ___| |  \\/  |   / \\   | |    | |    / ___|    |_ _||  _ \\ | ____|
\\___ \\ | |\\/| |  / _ \\  | |    | |   | |         | | | | | ||  _|  
 ___) || |  | | / ___ \\ | |___ | |___| |___      | | | |_| || |___ 
|____/ |_|  |_|/_/   \\_\\|_____||_____|\\____|    |___||____/ |_____|

A powerful, web-based development environment for the SmallC language.

[ Keyboard Shortcuts ]
  Compile           : Ctrl + S
  Search            : Ctrl + Shift + F
  Format Code       : Ctrl + Alt + F

[ Important Links ]
  GitHub            : https://github.com/ledboot/smallc-ide
  Discord           : https://discord.gg/your-invitation
  Twitter           : https://x.com/your-handle

Welcome to SmallC IDE Web! Select a file from the explorer to start coding.
`;

export const HOME_TAB: FileType = {
  id: 'home',
  name: 'Home',
  content: HOME_CONTENT,
  lastModified: new Date().toISOString(),
  isDirectory: false,
};
