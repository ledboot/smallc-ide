import {NetworkType} from '@/constants';

export type ChainInfo = {
  label: string;
  iconLabel: string;
  chainId: number;
  endpoints: string[];
  wsEndpoints: string[];
  icon: string;
  unit: string;
  networkType: NetworkType;
  rpcUser: string;
  rpcPassword: string;
};

export interface FileType {
  id: string;
  name: string;
  content: string;
  lastModified: string;
  breakpoints?: Breakpoint[];
  isDirectory?: boolean;
  path?: string;
  children?: FileType[];
}

export interface Breakpoint {
  lineNumber: number;
  enabled: boolean;
}

export interface DebugInfo {
  isPaused: boolean;
  currentLine?: number;
  callStack: CallFrame[];
  variables: Variable[];
}

export interface CallFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
}

export interface Variable {
  name: string;
  value: string;
  type: string;
}

export interface CompiledResult {
  bytecode: string;
  abi: string;
  hash: string;
}

export interface DebugNode {
  code: string;
  begin: number;
  end: number;
  lines: [number, number][]; // [vmOffset, sourceLine]
  body?: number; // Constructor offset
  types?: {
    [typeName: string]: {
      __TYPE__: string;
      [fieldName: string]: any;
    };
  };
  vars?: {
    [name: string]: {
      loc: string;
      size: number;
      type: string;
    };
  }[];
}
