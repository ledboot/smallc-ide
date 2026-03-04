import {create} from 'zustand';
import type {CompiledResult} from '@/types';

interface CompilerState {
  compiledResultMap: Map<string, CompiledResult>;
  setCompiledResult: (fileName: string, result: CompiledResult) => void;
  removeCompiledResult: (fileName: string) => void;
  clearAll: () => void;
}

export const useCompilerStore = create<CompilerState>(set => ({
  compiledResultMap: new Map(),
  setCompiledResult: (fileName, result) =>
    set(state => {
      const newMap = new Map(state.compiledResultMap);
      newMap.set(fileName, result);
      return {compiledResultMap: newMap};
    }),
  removeCompiledResult: fileName =>
    set(state => {
      const newMap = new Map(state.compiledResultMap);
      newMap.delete(fileName);
      return {compiledResultMap: newMap};
    }),
  clearAll: () => set({compiledResultMap: new Map()}),
}));
