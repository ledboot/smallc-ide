import {create} from 'zustand';
import type {DebugNode} from '@/types';
import {rpcClient} from '@/lib/api';
import {DebugCallType} from '@/constants';
import {useSettingsStore} from './useSettings';
import {getFile} from '@/lib/db';
import {toast} from 'sonner';
import {useFileStore} from './useFile';
import {useTabsStore} from './useTabs';

interface DebugSession {
  sessionId: string;
  breakpoints: {line: number; file: string}[];
}

interface DebugState {
  isDebugging: boolean;
  isPaused: boolean;
  debugSession: DebugSession | null;
  bplist: [number, number][];
  debugInfo: DebugNode[];
  currentDebugFileId: string | null;
  currentLine: number | null;
  isContractCall: boolean;
}

interface DebugActions {
  setIsDebugging: (isDebugging: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setDebugSession: (session: DebugSession | null) => void;
  setBplist: (bplist: [number, number][]) => void;
  setDebugInfo: (debugInfo: DebugNode[]) => void;
  setCurrentDebugFileId: (fileId: string | null) => void;
  setCurrentLine: (line: number | null) => void;
  loadDebugInfo: (fileName: string) => Promise<void>;
  toggleBreakpoint: (line: number, fileName: string) => boolean;
  mapSourceToVm: (line: number) => number | null;
  mapVmToSource: (vmOffset: number) => number | null;
  setIsContractCall: (isContractCall: boolean) => void;
}

export const useDebugStore = create<DebugState & DebugActions>((set, get) => ({
  isDebugging: false,
  isPaused: false,
  debugSession: null,
  bplist: [],
  debugInfo: [],
  isContractCall: false,
  currentDebugFileId: null,
  currentLine: null,

  setIsDebugging: isDebugging => set({isDebugging}),
  setIsPaused: isPaused => set({isPaused}),
  setDebugSession: debugSession => set({debugSession}),
  setBplist: bplist => set({bplist}),
  setDebugInfo: debugInfo => set({debugInfo}),
  setCurrentDebugFileId: currentDebugFileId => set({currentDebugFileId}),
  setCurrentLine: currentLine => set({currentLine}),
  setIsContractCall: isContractCall => set({isContractCall}),

  loadDebugInfo: async (fileName: string) => {
    const baseName = fileName.split('.')[0];
    const dbgPath = `/${baseName}.dbg`;
    try {
      const file = await getFile(dbgPath);
      if (file) {
        const content = JSON.parse(file.content) as DebugNode[];
        set({debugInfo: content});

        // Flatten bplist
        const list: [number, number][] = [];
        content.forEach(node => {
          node.lines.forEach(([offset, line]) => {
            list.push([offset, line]);
          });
        });
        set({bplist: list});
        console.log('Loaded debug info:', list);
      } else {
        set({debugInfo: [], bplist: []});
      }
    } catch (e) {
      console.warn('Debug info not found or invalid:', e);
      set({debugInfo: [], bplist: []});
    }
  },

  mapSourceToVm: (line: number) => {
    const {bplist, debugInfo, isContractCall} = get();
    if (!bplist || !debugInfo) return null;

    // Determine offset based on whether we are in contract call (body)
    const offset =
      isContractCall && debugInfo.length > 0 && debugInfo[0]?.body
        ? debugInfo[0].body
        : 0;

    for (const [vmOffset, srcLine] of bplist) {
      if (srcLine === line) {
        return vmOffset + offset;
      }
    }
    return null;
  },

  mapVmToSource: (vmOffset: number) => {
    const {bplist} = get();
    if (!bplist) return null;

    // PHP logic for linemapping doesn't seem to subtract offset,
    // so we assume VM returns addresses that match bplist entries.
    for (const [offset, line] of bplist) {
      if (offset === vmOffset) return line;
    }
    return null;
  },

  toggleBreakpoint: (line: number, fileId: string) => {
    const {mapSourceToVm} = get();
    // Validate mapping first
    const vmOffset = mapSourceToVm(line);
    if (vmOffset === null) {
      toast.error(`Cannot map line ${line} to VM instruction`);
      return false;
    }

    // Update FileStore and TabsStore (persistence + UI)
    const {files, updateFile} = useFileStore.getState();
    const {currentFile, setCurrentFile, openTabs, setOpenTabs} =
      useTabsStore.getState();
    const {isDebugging} = get();
    console.log('currentFile', currentFile);

    // Find the file. Use currentFile if it matches, otherwise find in store
    let targetFile = files.find(f => f.id === fileId);
    if (!targetFile && currentFile?.id === fileId) {
      targetFile = currentFile;
    }

    if (!targetFile) {
      toast.error(`File ${fileId} not found`);
      return false;
    }

    // Toggle logic on targetFile.breakpoints
    const existingBreakpoints = targetFile.breakpoints || [];
    const exists = existingBreakpoints.some(bp => bp.lineNumber === line);

    let newBreakpoints: any[]; // Use any or Breakpoint type if imported
    if (exists) {
      newBreakpoints = existingBreakpoints.filter(bp => bp.lineNumber !== line);
      toast.success(`Breakpoint removed at line ${line}`);
    } else {
      newBreakpoints = [
        ...existingBreakpoints,
        {lineNumber: line, enabled: true},
      ];
      toast.success(`Breakpoint set at line ${line}`);
    }

    const updatedFile = {...targetFile, breakpoints: newBreakpoints};

    // Update Stores
    updateFile(updatedFile); // Persistent store

    // Update Tabs Store if applicable
    if (currentFile?.id === updatedFile.id) {
      setCurrentFile(updatedFile);
    }
    const updatedTabs = openTabs.map(t =>
      t.id === updatedFile.id ? updatedFile : t,
    );
    setOpenTabs(updatedTabs);

    const {currentDebugFileId} = get();
    if (isDebugging && currentDebugFileId === fileId) {
      // We can optimistically call RPC for single breakpoint toggle
      // Or re-run full sync. Full sync is safer but maybe heavier?
      // Let's do single RPC call for efficiency and better feedback?
      // Actually, previous implementation did single call.
      // Let's replicate single call logic here but using the new offset map?
      // Wait, mapSourceToVm uses `bplist`.

      // Single call logic:
      if (exists) {
        const {chainType} = useSettingsStore.getState();
        rpcClient
          .getClient(chainType)
          .debugCall(DebugCallType.clearbreakpoint, [vmOffset])
          .catch(e => console.error(e));
      } else {
        const {chainType} = useSettingsStore.getState();
        rpcClient
          .getClient(chainType)
          .debugCall(DebugCallType.breakpoint, [vmOffset])
          .catch(e => console.error(e));
      }
    }

    return true;
  },
}));
