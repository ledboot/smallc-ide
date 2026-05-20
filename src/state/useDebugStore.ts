import {create} from 'zustand';
import type {DebugNode} from '@/types';
import {rpcClient, RPCClient} from '@/lib/api';
import {DebugCallType} from '@/constants';
import {useSettingsStore} from './useSettings';
import {getFile} from '@/lib/db';
import {toast} from 'sonner';
import {useFileStore} from './useFile';
import {useTabsStore} from './useTabs';
import {
  getDebugWSClient,
  disconnectDebugWSClient,
  type DebugWebSocketClient,
} from '@/lib/debugWebSocket';
import {processVariableValue} from '@/lib/debugUtils';
import {useConsoleStore, LogLevel} from './useConsole';
import {useNodeStore} from './useNodeStore';

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
  debugVariables: {name: string; value: any; type?: string}[];
  debugCallStack: {name: string; address: string}[];
  // Preparsed variable metadata (structure info without actual values)
  preparsedVariables: {
    name: string;
    type: string;
    loc: string;
    size: number;
    structure?: any; // For struct types, contains field definitions
  }[];
  // WebSocket connection state
  wsClient: DebugWebSocketClient | null;
  wsConnected: boolean;
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
  setDebugVariables: (
    variables: {name: string; value: any; type?: string; size?: number}[],
  ) => void;
  setDebugCallStack: (callStack: {name: string; address: string}[]) => void;
  setPreparsedVariables: (
    variables: {
      name: string;
      type: string;
      loc: string;
      size: number;
      structure?: any;
    }[],
  ) => void;
  preparseVariablesForMethod: (vmLine: number) => void;
  // WebSocket connection management
  connectDebugWS: () => Promise<void>;
  disconnectDebugWS: () => void;
  finishDebug: () => void;
  getDebugClient: () => DebugWebSocketClient | RPCClient;
  fetchDebugState: (vmLine: number) => Promise<void>;
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
  debugVariables: [],
  debugCallStack: [],
  preparsedVariables: [],
  wsClient: null,
  wsConnected: false,

  setIsDebugging: isDebugging => set({isDebugging}),
  setIsPaused: isPaused => set({isPaused}),
  setDebugSession: debugSession => set({debugSession}),
  setBplist: bplist => set({bplist}),
  setDebugInfo: debugInfo => set({debugInfo}),
  setCurrentDebugFileId: currentDebugFileId => set({currentDebugFileId}),
  setCurrentLine: currentLine => set({currentLine}),
  setIsContractCall: isContractCall => set({isContractCall}),
  setDebugVariables: debugVariables => set({debugVariables}),
  setDebugCallStack: debugCallStack => set({debugCallStack}),
  setPreparsedVariables: preparsedVariables => set({preparsedVariables}),

  // WebSocket connection management
  connectDebugWS: async () => {
    // Automatically lease a dedicated high-performance RPC node for debugging if not already leased.
    const {leasedNode, leaseNode} = useNodeStore.getState();
    if (!leasedNode) {
      toast.info(
        'Starting debug session: leasing a dedicated high-performance RPC node...',
        {
          duration: 3000,
        },
      );
      const node = await leaseNode();
      if (!node) {
        throw new Error('Failed to lease a dedicated RPC node for debugging.');
      }
    }

    const {chainType} = useSettingsStore.getState();
    const wsClient = getDebugWSClient(chainType);
    try {
      await wsClient.connect();

      // Setup event listeners
      wsClient.onDebugEvent((event: any) => {
        const {isDebugging, fetchDebugState, finishDebug} = get();
        if (!isDebugging) return;

        console.log('[DebugStore] Received VM event:', event);

        const vmLine = event?.Line ?? event?.line;
        const result = event?.Result ?? event?.result;

        if (result === 'Terminated') {
          // VM Terminated
          finishDebug();
        } else if (vmLine !== undefined) {
          // VM Breaked
          fetchDebugState(vmLine);
        } else if (typeof event === 'string' && event.startsWith('C')) {
          // New contract event
          console.log('[DebugStore] Debugging contract:', event);
          toast.info(`Debugging contract: ${event.substring(2)}`);
        }
      });

      set({wsClient, wsConnected: true});
    } catch (error) {
      console.error('Failed to connect debug WebSocket:', error);
      set({wsClient: null, wsConnected: false});
      throw error;
    }
  },

  disconnectDebugWS: () => {
    const {chainType} = useSettingsStore.getState();
    disconnectDebugWSClient(chainType);
    set({wsClient: null, wsConnected: false});
  },

  finishDebug: () => {
    const {disconnectDebugWS, setIsDebugging} = get();
    set({
      isDebugging: false,
      isPaused: false,
      currentLine: null,
      debugSession: null,
      debugVariables: [],
      debugCallStack: [],
      preparsedVariables: [],
    });
    disconnectDebugWS();
    setIsDebugging(false);

    // Automatically release the leased node when debugging is finished to free up resources.
    const {leasedNode, releaseNode} = useNodeStore.getState();
    if (leasedNode) {
      releaseNode();
    }
  },

  getDebugClient: () => {
    const {wsClient, wsConnected} = get();
    if (wsClient && wsConnected && wsClient.isReady()) {
      return wsClient;
    }
    const {chainType} = useSettingsStore.getState();
    return rpcClient.getClient(chainType);
  },

  // Preparse variables for a given VM line (method)
  preparseVariablesForMethod: (vmLine: number) => {
    const {debugInfo} = get();
    const preparsed: {
      name: string;
      type: string;
      loc: string;
      size: number;
      structure?: any;
    }[] = [];

    console.log('Preparsing variables for VM line:', vmLine, debugInfo);

    // Find the code segment containing this VM line
    for (const code of debugInfo) {
      console.log('Checking code segment:', code);
      if (code.code != '' && vmLine >= code.begin && vmLine <= code.end) {
        console.log('Found code segment:', code);
        if (code.vars) {
          for (const varEntry of code.vars) {
            const varName = Object.keys(varEntry)[0];
            if (!varName) continue;
            const varInfo = (varEntry as any)[varName];

            // Extract variable metadata
            const varMeta = {
              name: varName,
              type: varInfo.type || '',
              loc: varInfo.loc || '',
              size: varInfo.size || 0,
              structure: undefined as any,
            };

            // If it's a struct type, resolve its structure
            if (
              varInfo.type &&
              varInfo.type.startsWith('__') &&
              varInfo.type.endsWith('__')
            ) {
              // Find the type definition
              for (const codeNode of debugInfo) {
                if (codeNode.types && codeNode.types[varInfo.type]) {
                  varMeta.structure = codeNode.types[varInfo.type];
                  break;
                }
              }
            }

            preparsed.push(varMeta);
          }
        }
        break;
      }
    }

    set({preparsedVariables: preparsed});
  },

  loadDebugInfo: async (fileName: string) => {
    const baseName = fileName.split('.')[0];
    const dbgPath = `/${baseName}.dbg`;
    try {
      const file = await getFile(dbgPath);
      if (file) {
        const content = JSON.parse(file.content) as DebugNode[];
        console.log('Loaded debug info:', content);
        set({debugInfo: content});

        // Flatten bplist
        const list: [number, number][] = [];
        content.forEach(node => {
          node.lines.forEach(([offset, line]) => {
            list.push([offset, line]);
          });
        });
        set({bplist: list});
        console.log('Loaded debug bplist:', list);
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
      const debugClient = get().getDebugClient();
      if (exists) {
        debugClient
          .debugCall(DebugCallType.clearbreakpoint, ['', vmOffset])
          .catch(e => console.error(e));
      } else {
        debugClient
          .debugCall(DebugCallType.breakpoint, ['', vmOffset])
          .catch(e => console.error(e));
      }
    }

    return true;
  },

  fetchDebugState: async (vmLine: number) => {
    const {
      getDebugClient,
      debugInfo,
      mapVmToSource,
      preparseVariablesForMethod,
      setDebugVariables,
      setDebugCallStack,
    } = get();
    const debugClient = getDebugClient();
    const {chainType} = useSettingsStore.getState();
    const {addLog} = useConsoleStore.getState();

    try {
      // 1. Update line and pause status
      const sourceLine = mapVmToSource(vmLine);
      set({isPaused: true, currentLine: sourceLine});

      // 2. Pre-parse variable metadata immediately
      preparseVariablesForMethod(vmLine);
      const preparsed = get().preparsedVariables;
      console.log('Preparsed variables:', preparsed);

      // 3. Fetch variables
      const vars: {
        name: string;
        value: any;
        type?: string;
        size?: number;
      }[] = [];

      for (const varInfo of preparsed) {
        try {
          const dataResp = await debugClient.debugCall(DebugCallType.getdata, [
            varInfo.loc,
            varInfo.size,
          ]);
          if (dataResp && dataResp.result !== undefined) {
            const rawValue = String(dataResp.result);
            const varType = varInfo.type || '';
            const varSize = varInfo.size || 0;

            const processedValue = await processVariableValue(
              rawValue,
              varType,
              debugInfo,
              chainType,
              debugClient,
              varSize,
              varInfo.structure,
            );

            vars.push({
              name: varInfo.name,
              value: processedValue,
              type: varType,
              size: varSize,
            });
          }
        } catch (e) {
          console.error(`Failed to fetch variable ${varInfo.name}`, e);
        }
      }
      setDebugVariables(vars);

      // 4. Fetch stack
      try {
        const stackResp = await debugClient.debugCall(DebugCallType.getstack);
        if (stackResp && stackResp.result) {
          const stackFrames: {name: string; address: string}[] = [];
          for (const addr of stackResp.result) {
            const codeSegment = debugInfo.find(
              c => addr >= c.begin && addr <= c.end,
            );
            if (codeSegment) {
              stackFrames.push({
                name: codeSegment.code,
                address: `0x${addr.toString(16)}`,
              });
            } else {
              stackFrames.push({
                name: 'Unknown',
                address: `0x${addr.toString(16)}`,
              });
            }
          }
          setDebugCallStack(stackFrames);
        }
      } catch (e) {
        console.error('Failed to fetch stack', e);
      }

      addLog(
        `Paused at VM line ${vmLine} (Source: ${sourceLine})`,
        vars,
        LogLevel.INFO,
      );
    } catch (err) {
      console.error('Error fetching debug state:', err);
    }
  },
}));
