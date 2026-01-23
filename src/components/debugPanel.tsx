'use client';

import {useState, useEffect} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {FileIcon, Bug, ChevronDown, ChevronUp} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {useSettingsStore} from '@/state/useSettings';
import {rpcClient} from '@/lib/api';
import {toast} from 'sonner';
import {runContractMethod} from '@/utils/contractRunner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  VscDebugStart,
  VscDebugPause,
  VscDebugStepOver,
  VscDebugStepInto,
  VscDebugStepOut,
  VscDebugRestart,
  VscDebugStop,
  VscDebugContinue,
  VscLayers,
} from 'react-icons/vsc';

import {DebugCallType, ChainType} from '@/constants';
import {useFileStore} from '@/state/useFile';
import {useConsoleStore, LogLevel} from '@/state/useConsole';
import {useDebugStore} from '@/state/useDebugStore';

import {useTabsStore} from '@/state/useTabs';

// Helper function to reverse hex string for little-endian conversion
const reverseHexString = (hexStr: string): string => {
  // Remove '0x' prefix if present
  const cleanHex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  // Reverse by pairs (bytes)
  const reversed =
    cleanHex
      .match(/.{1,2}/g)
      ?.reverse()
      .join('') || cleanHex;
  return reversed;
};

// Helper function to convert hex to appropriate type
const processBasicType = (hexValue: string, varType: string): string => {
  // If no type specified but we have data, it might be a raw buffer or hash
  if (!varType) return hexValue;

  try {
    const reversed = reverseHexString(hexValue);

    // Handle numeric types
    const numericTypes = [
      'int',
      'uint',
      'long',
      'ulong',
      'char',
      'uchar',
      'short',
      'ushort',
    ];
    if (numericTypes.includes(varType.toLowerCase())) {
      // Use BigInt for large 64-bit numbers (long)
      return BigInt('0x' + reversed).toString();
    }
  } catch (e) {
    console.warn(`Failed to process numeric type ${varType}`, e);
  }

  return hexValue;
};

// Helper function to process struct type variables
// Returns an object where each field has both type and value
const processStructType = async (
  hexValue: string,
  typeName: string,
  debugInfo: any[],
  chainType: ChainType,
  isRawData = false,
  varSize: number,
): Promise<{[key: string]: {type: string; value: any}}> => {
  const result: {[key: string]: {type: string; value: any}} = {};

  // Find the type definition in debugInfo
  let typeDefinition: any = null;
  for (const code of debugInfo) {
    if (code.types && code.types[typeName]) {
      typeDefinition = code.types[typeName];
      break;
    }
  }

  if (!typeDefinition || typeDefinition.__TYPE__ !== 'struct') {
    return {
      error: {
        type: 'error',
        value: `Type ${typeName} not found or not a struct`,
      },
    };
  }

  let fullStructData = '';

  if (isRawData) {
    fullStructData = hexValue;
  } else {
    // Call RPC evaluate with (hexValue, varSize)
    // Use hexValue directly as requested
    const evaluateResp = await rpcClient
      .getClient(chainType)
      .debugCall(DebugCallType.evaluate, [hexValue, varSize]);

    if (evaluateResp && evaluateResp.result !== undefined) {
      fullStructData = String(evaluateResp.result);
    } else {
      return {
        error: {type: 'error', value: `Evaluate failed for ${typeName}`},
      };
    }
  }

  // 3. Process each field from fullStructData
  for (const [fieldName, fieldInfo] of Object.entries(typeDefinition)) {
    if (fieldName === '__TYPE__') continue;

    const field = fieldInfo as any;
    const fieldType = field.type;
    const fieldSize = field.size;
    const fieldLoc = field.loc;

    try {
      // Extract field data from the full struct hex string
      // Each byte is 2 hex characters
      const start = fieldLoc * 2;
      const end = (fieldLoc + fieldSize) * 2;
      const fieldValue = fullStructData.substring(start, end);

      if (fieldType.startsWith('*')) {
        // Pointer type - return as-is with type info
        result[fieldName] = {type: fieldType, value: fieldValue};
      } else if (fieldType.startsWith('__') && fieldType.endsWith('__')) {
        // Custom struct type - recursively process using extracted data
        const nestedStruct = await processStructType(
          fieldValue,
          fieldType,
          debugInfo,
          chainType,
          true,
          fieldSize,
        );
        result[fieldName] = {type: fieldType, value: nestedStruct};
      } else {
        // Basic type - process the extracted hex
        result[fieldName] = {
          type: fieldType,
          value: processBasicType(fieldValue, fieldType),
        };
      }
    } catch (e) {
      console.error(`Failed to process field ${fieldName}`, e);
      result[fieldName] = {type: fieldType || 'unknown', value: 'Error'};
    }
  }

  return result;
};

// Main function to process variable value based on type
const processVariableValue = async (
  hexValue: string,
  varType: string,
  debugInfo: any[],
  chainType: ChainType,
  varSize: number,
): Promise<any> => {
  // 1. Check if it's a pointer type
  if (varType.startsWith('*')) {
    // Pointer type - return as-is
    return hexValue;
  }

  // 2. Check if it's a custom struct type
  if (varType.startsWith('__') && varType.endsWith('__')) {
    // Custom struct type - need to expand
    const structData = await processStructType(
      hexValue,
      varType,
      debugInfo,
      chainType,
      false,
      varSize,
    );
    return structData;
  }

  // 3. Basic type - reverse and convert
  return processBasicType(hexValue, varType);
};

export default function DebugPanel() {
  const chainType = useSettingsStore(state => state.chainType);
  const handleOpenFile = useTabsStore(state => state.handleOpenFile);
  const {
    isDebugging,
    debugSession,
    debugInfo,
    setIsDebugging,
    setDebugSession,
    loadDebugInfo,
    toggleBreakpoint,
    setCurrentDebugFileId,
    currentDebugFileId,
    mapVmToSource,
    setIsContractCall,
    setDebugVariables,
    setDebugCallStack,
    setCurrentLine,
    setPreparsedVariables,
    isPaused,
  } = useDebugStore(
    useShallow(state => ({
      isDebugging: state.isDebugging,
      isPaused: state.isPaused,
      debugSession: state.debugSession,
      debugInfo: state.debugInfo,
      setIsDebugging: state.setIsDebugging,
      setDebugSession: state.setDebugSession,
      loadDebugInfo: state.loadDebugInfo,
      toggleBreakpoint: state.toggleBreakpoint,
      setCurrentDebugFileId: state.setCurrentDebugFileId,
      currentDebugFileId: state.currentDebugFileId,
      mapVmToSource: state.mapVmToSource,
      setIsContractCall: state.setIsContractCall,
      setDebugVariables: state.setDebugVariables,
      setDebugCallStack: state.setDebugCallStack,
      setCurrentLine: state.setCurrentLine,
      setPreparsedVariables: state.setPreparsedVariables,
    })),
  );

  // Let's use local variables state for now to minimize friction, as the main task is about breakpoints.
  const debugFile = useFileStore(state =>
    state.files.find(f => f.id === currentDebugFileId),
  );

  // Filter C files for debugging
  const files = useFileStore(
    useShallow(state =>
      state.files.filter(file => file.name.endsWith('.c') && !file.isDirectory),
    ),
  );

  const [runDataList, setRunDataList] = useState<any[]>([]);
  const {addLog} = useConsoleStore();

  useEffect(() => {
    const fetchRunData = async () => {
      if (!debugFile) {
        setRunDataList([]);
        return;
      }
      try {
        loadDebugInfo(debugFile.name);
        const broadcastDir = `/.broadcast/${debugFile.name}/`;
        const broadcastFiles = useFileStore
          .getState()
          .files.filter(file => file.path?.startsWith(broadcastDir));

        // Filter for JSON files and exclude 'run-latest.json' to avoid duplicates
        const jsonFiles = broadcastFiles.filter(
          f => f.name.endsWith('.json') && f.name !== 'run-latest.json',
        );

        const dataPromises = jsonFiles.map(async f => {
          try {
            const content = f.content;
            const data = JSON.parse(content);
            return {...data, fileName: f.name, lastModified: f.lastModified};
          } catch (e) {
            console.error(`Failed to parse ${f.name}`, e);
            return null;
          }
        });

        const dataList = (await Promise.all(dataPromises)).filter(
          d => d !== null,
        );

        // Sort by lastModified descending
        dataList.sort((a, b) => {
          return (
            new Date(b.lastModified).getTime() -
            new Date(a.lastModified).getTime()
          );
        });

        setRunDataList(dataList);
      } catch (e) {
        console.error('Failed to load run data', e);
        setRunDataList([]);
      }
    };
    fetchRunData();
  }, [currentDebugFileId, loadDebugInfo]);

  const handleMethodCall = async (
    methodSignature: string,
    tsFilePath: string,
    apiType: 'sendRawTransaction' | 'tryContract' | 'contractcall',
  ) => {
    if (!tsFilePath) return;

    // Extract method name: "void setTotal(long total)" -> "setTotal"
    const match = methodSignature.match(/\s*(\w+)\s*\(/);
    const methodName = match ? match[1] : null;

    if (!methodName) {
      toast.error('Invalid method signature');
      return;
    }

    try {
      const tsFile = useFileStore
        .getState()
        .files.find(file => file.id === tsFilePath);
      if (!tsFile) {
        toast.error('TS execution file not found');
        return;
      }

      // Step 1: Get rawTx from runContractMethod
      const rawTx = await runContractMethod(tsFile.content, methodName);
      if (!rawTx) {
        toast.error('Method execution failed');
        return;
      }

      // Step 2: Call different API methods based on apiType
      let result;
      const client = rpcClient.getClient(chainType);

      switch (apiType) {
        case 'sendRawTransaction': {
          const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
          if (!privateKey) {
            toast.error('Private key not found in environment variables');
            return;
          }

          // Sign the transaction first
          const signedTx = await client.signRawTransaction(
            rawTx,
            [],
            [privateKey],
            false,
          );
          if (signedTx.error) {
            toast.error('Sign raw transaction failed');
            addLog('Sign Error:', signedTx.error, LogLevel.ERROR);
            return;
          }

          // Send the signed transaction
          result = await client.sendRawTransaction(signedTx.result.hex);
          if (result.error) {
            toast.error('Send raw transaction failed');
            addLog('Send Error:', result.error, LogLevel.ERROR);
            return;
          }
          addLog('sendRawTransaction executed successfully', result);
          toast.success('Transaction sent successfully');
          break;
        }

        case 'tryContract': {
          result = await client.tryContract(rawTx);
          if (result.error) {
            toast.error('Try contract failed');
            addLog('tryContract Error:', result.error, LogLevel.ERROR);
            return;
          }
          addLog('tryContract executed successfully', result);
          toast.success('Contract tried successfully');
          break;
        }

        case 'contractcall': {
          // For contractcall, we need contract address and params
          // Extract from the runData or tsFile content
          // This is a simplified version - you may need to adjust based on your data structure
          const runData = runDataList.find(rd => rd.tsFile === tsFilePath);
          if (!runData || !runData.contractAddress) {
            toast.error('Contract address not found');
            return;
          }

          result = await client.contractCall(runData.contractAddress, rawTx);
          if (result.error) {
            toast.error('Contract call failed');
            addLog('contractcall Error:', result.error, LogLevel.ERROR);
            return;
          }
          addLog('contractcall executed successfully', result);
          toast.success('Contract called successfully');
          break;
        }
      }
    } catch (e) {
      console.error('Method execution failed', e);
      toast.error('Method execution failed');
      addLog('Execution Error:', e, LogLevel.ERROR);
    }
  };

  const attachDebugSession = async () => {
    if (!debugFile) {
      toast.error('Please select a file to debug');
      return;
    }

    // 1. Prepare Environment (Set info)
    handleOpenFile(debugFile);
    await loadDebugInfo(debugFile.name);

    try {
      // 2. Attach RPC
      if ((debugFile.breakpoints?.length || 0) < 1) {
        toast.warning('set breakpoints first to attach debug session');
        return;
      }
      rpcClient.getClient(chainType).debugCall(DebugCallType.attach);

      await new Promise(resolve => setTimeout(resolve, 500));
      // console.log('attach result:', attachResult);

      // 3. Sync all breakpoints to VM
      const sortedBreakpoints = [...(debugFile.breakpoints || [])].sort(
        (a, b) => a.lineNumber - b.lineNumber,
      );
      for (const bp of sortedBreakpoints) {
        const vmOffset = useDebugStore.getState().mapSourceToVm(bp.lineNumber);
        if (vmOffset !== null) {
          try {
            await rpcClient
              .getClient(chainType)
              .debugCall(DebugCallType.breakpoint, ['', vmOffset]);
          } catch (e) {
            console.error(
              `Failed to sync breakpoint at line ${bp.lineNumber}`,
              e,
            );
            toast.error(`Failed to sync breakpoint at line ${bp.lineNumber}`);
            return;
          }
        }
      }

      // // 4. Enter debug mode and highlight first breakpoint
      setIsDebugging(true);
      setDebugSession({
        sessionId: 'default',
        breakpoints: sortedBreakpoints.map(bp => ({
          line: bp.lineNumber,
          file: debugFile.name,
        })),
      });

      toast.success(
        'Debug session attached, waiting for transaction to be debugged',
      );
    } catch (error) {
      console.error('Attach failed:', error);
      toast.error('Failed to attach debug session');
    }
  };

  const handleTerminateDebugging = async () => {
    try {
      if (debugSession) {
        const [, err] = await rpcClient
          .getClient(chainType)
          .debugCall(DebugCallType.stop);
        if (err) throw new Error(err);
      }
    } catch (error) {
      console.error('Error stopping debug session:', error);
    } finally {
      setIsDebugging(false);
      setDebugSession(null);
      setCurrentLine(null);
      setDebugVariables([]);
      setPreparsedVariables([]);
    }
  };

  const handleDebugAction = async (action: DebugCallType) => {
    if (!debugSession) return;

    setCurrentLine(null);
    addLog(`debug action: ${action}`);

    try {
      const response = await rpcClient.getClient(chainType).debugCall(action);
      if (response.error) {
        toast.error(`${action} failed: ${response.error}`);
        return;
      }

      const res = response.result;
      if (!res) {
        toast.error(`Unexpected response from ${action}`);
        return;
      }

      // Log the message from result
      if (res.result && !res.result.includes('Break at inst')) {
        addLog(res.result);
      }

      if (res.result === 'Terminated') {
        handleTerminateDebugging();
        return;
      }

      // Update current line
      if (res.line !== undefined) {
        // Pre-parse variable metadata immediately
        useDebugStore.getState().preparseVariablesForMethod(res.line);

        const sourceLine = useDebugStore.getState().mapVmToSource(res.line);
        if (sourceLine !== null) {
          setCurrentLine(sourceLine);
        }

        // Fetch variables
        const vars: {
          name: string;
          value: string;
          type?: string;
          size?: number;
        }[] = [];
        for (const code of debugInfo) {
          if (res.line >= code.begin && res.line <= code.end) {
            if (code.vars) {
              for (const varEntry of code.vars) {
                const varName = Object.keys(varEntry)[0];
                if (!varName) continue;
                const varInfo = (varEntry as any)[varName];
                try {
                  const dataResp = await rpcClient
                    .getClient(chainType)
                    .debugCall(DebugCallType.getdata, [
                      varInfo.loc,
                      varInfo.size,
                    ]);
                  if (dataResp && dataResp.result !== undefined) {
                    addLog(`${varName}: ${dataResp.result}`);
                    const rawValue = String(dataResp.result);
                    const varType = varInfo.type || '';
                    const varSize = varInfo.size || 0;

                    // Process the value based on type
                    const processedValue = await processVariableValue(
                      rawValue,
                      varType,
                      debugInfo,
                      chainType,
                      varSize,
                    );

                    vars.push({
                      name: varName,
                      value: processedValue,
                      type: varType,
                      size: varSize,
                    });
                    addLog(`${varName} (${varType}): ${processedValue}`);
                  }
                } catch (e) {
                  console.error(`Failed to fetch variable ${varName}`, e);
                }
              }
            }
          }
        }
        setDebugVariables(vars);
      }

      // Fetch stack
      try {
        const stackResp = await rpcClient
          .getClient(chainType)
          .debugCall(DebugCallType.getstack);
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
          addLog('Call Stack:', stackFrames.map(f => f.name).join(' -> '));
        }
      } catch (e) {
        console.error('Failed to fetch stack', e);
      }
    } catch (error) {
      console.error(`${action} failed:`, error);
      toast.error(`${action} failed`);
    }
  };

  const handleGo = () => handleDebugAction(DebugCallType.go);
  const handleStep = () => handleDebugAction(DebugCallType.step);
  const handleUp = () => handleDebugAction(DebugCallType.up);

  const handleGetStack = async () => {
    if (!debugSession) {
      toast.error('No active debug session');
      return;
    }
    try {
      const response = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.getstack);

      if (response && response.error) {
        addLog('Get Stack Error:', response.error, LogLevel.ERROR);
      } else {
        const stackData =
          response.result !== undefined ? response.result : response;
        addLog('Debug Stack Info:', stackData);
      }
      toast.success('Stack info logged to console');
    } catch (error) {
      console.error('Get stack failed:', error);
      addLog('Get stack failed:', error, LogLevel.ERROR);
      toast.error('Failed to get stack info');
    }
  };

  return (
    <div className="flex h-full flex-col p-2 pt-4 space-y-10">
      {/* Integrated Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Bug className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Debugger</h2>
        </div>
      </div>

      <div className="flex-1 space-y-10 pr-1">
        {/* Session Discovery - Flat */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="debug-file" className="text-xs font-semibold">
              TARGET SOURCE
            </Label>
            <Select
              value={currentDebugFileId || ''}
              onValueChange={setCurrentDebugFileId}
              disabled={isDebugging}
            >
              <SelectTrigger
                id="debug-file"
                className="h-12 w-full max-w-50 px-2 hover:bg-muted/40 focus:ring-0 focus:ring-offset-0"
              >
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent className="border-none shadow-xl bg-background/95 backdrop-blur-md">
                {files.map(file => (
                  <SelectItem key={file.id} value={file.id}>
                    <div className="flex items-center gap-3 py-1">
                      <FileIcon className="h-4 w-4 opacity-50" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Execution Pipeline - Flat */}
        <div className="space-y-6">
          <div className="flex items-center px-1 border-b pb-2 mb-2">
            <span className="text-sm font-semibold">Execution Control</span>
          </div>

          <div className="flex items-center justify-start">
            <TooltipProvider>
              <div className="flex items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={attachDebugSession}
                      disabled={isDebugging}
                      className="h-8 w-8 p-0 rounded-xl transition-all hover:scale-105 shadow-md shadow-primary/5"
                    >
                      <VscDebugStart className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleTerminateDebugging}
                      disabled={!isDebugging}
                      className="h-8 w-8 p-0 rounded-xl text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                    >
                      <VscDebugStop className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Terminate</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGo}
                      disabled={!isDebugging}
                      className="h-8 w-8 p-0 rounded-xl text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-20"
                    >
                      <VscDebugContinue className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Go</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStep}
                      disabled={!isDebugging}
                      className="h-8 w-8 p-0 rounded-xl text-blue-600 hover:bg-blue-500/10 disabled:opacity-20"
                    >
                      <VscDebugStepInto className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleUp}
                      disabled={!isDebugging}
                      className="h-8 w-8 p-0 rounded-xl text-foreground/70 hover:bg-foreground/5 disabled:opacity-20"
                    >
                      <VscDebugStepOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Up</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGetStack}
                      disabled={!isDebugging}
                      className="h-8 w-8 p-0 rounded-xl text-foreground/70 hover:bg-foreground/5 disabled:opacity-20"
                    >
                      <VscLayers className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Get Stack</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>

        {/* Breakpoints - Flat */}
        <div className="space-y-6">
          <div className="flex items-center px-1 border-b pb-2 mb-2">
            <span className="text-sm font-semibold">Breakpoints</span>
          </div>

          <div className="space-y-2 px-2">
            {(() => {
              // Get breakpoints from the selected file or current debug context
              // Since this panel is often context-specific, maybe we show breakpoints of the `selectedFile` if it matches C file?
              // The `selectedFile` state seems to be the one we are "debugging" or "about to debug".
              const breakpoints = debugFile?.breakpoints || [];

              return breakpoints.length > 0 ? (
                breakpoints.map((bp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md bg-muted/40 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      <span className="font-mono">Line {bp.lineNumber}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() =>
                        debugFile &&
                        toggleBreakpoint(bp.lineNumber, debugFile.id)
                      }
                    >
                      <span className="sr-only">Remove</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3 w-3"
                      >
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </Button>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground px-2">
                  No breakpoints set
                </div>
              );
            })()}
          </div>
        </div>

        {/* Executable Methods - Cards */}
        <div className="space-y-4">
          <div className="flex items-center px-1 border-b pb-2 mb-2">
            <span className="text-sm font-semibold">Executable Methods</span>
          </div>
          {runDataList.map((runData, index) => (
            <RunCard
              key={index}
              data={runData}
              onMethodCall={handleMethodCall}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const RunCard = ({
  data,
  onMethodCall,
}: {
  data: any;
  onMethodCall: (
    sig: string,
    file: string,
    apiType: 'sendRawTransaction' | 'tryContract' | 'contractcall',
  ) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const truncatedAddress =
    data.contractAddress && data.contractAddress.length > 10
      ? `${data.contractAddress.slice(0, 10)}...${data.contractAddress.slice(
          -8,
        )}`
      : data.contractAddress || 'Unknown';

  const dateStr = data.lastModified
    ? new Date(data.lastModified).toLocaleString()
    : '';

  const fileName = data.fileName || 'unknown';

  return (
    <div className="mb-3 p-1 rounded-lg border hover:bg-muted/10 transition-colors">
      {/* Contract Address */}
      <div className="flex gap-1 mb-2 items-center">
        <span className="text-xs uppercase font-semibold">Contract:</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs font-mono text-foreground cursor-default break-all">
                {truncatedAddress}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-mono text-xs">{data.contractAddress}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Timestamp */}
      <div className="flex gap-1 mb-2 items-center">
        <span className="text-xs uppercase font-semibold">Time:</span>
        <span className="text-xs text-foreground">{dateStr}</span>
      </div>

      {/* Broadcast File */}
      <div className="flex gap-1 mb-3 items-center">
        <span className="text-xs uppercase font-semibold">File:</span>
        <span className="text-xs font-mono text-foreground break-all">
          {fileName}
        </span>
      </div>

      {/* Methods Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between rounded hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-semibold uppercase">
          Methods ({Object.keys(data.methodIdentifiers || {}).length})
        </span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 hover:cursor-pointer" />
        ) : (
          <ChevronDown className="h-5 w-5 hover:cursor-pointer" />
        )}
      </button>

      {/* Methods List */}
      {isOpen && (
        <div className="mt-2 space-y-1">
          {data.methodIdentifiers &&
          Object.keys(data.methodIdentifiers).length > 0 ? (
            Object.keys(data.methodIdentifiers).map(sig => (
              <div
                key={sig}
                className="flex items-center px-1 gap-2 rounded-md hover:bg-muted/20 transition-colors"
              >
                <span className="text-xs font-mono text-foreground/80 flex-1 truncate p-1 bg-orange-100 rounded-xl">
                  {sig.match(/\s*(\w+)\s*\(/)?.[1] || sig}
                </span>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] hover:bg-blue-500/10 hover:text-blue-600 cursor-pointer"
                          onClick={e => {
                            e.stopPropagation();
                            onMethodCall(
                              sig,
                              data.tsFile,
                              'sendRawTransaction',
                            );
                          }}
                        >
                          Send
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>sendRawTransaction</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] hover:bg-emerald-500/10 hover:text-emerald-600 cursor-pointer"
                          onClick={e => {
                            e.stopPropagation();
                            onMethodCall(sig, data.tsFile, 'tryContract');
                          }}
                        >
                          Try
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>tryContract</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] hover:bg-purple-500/10 hover:text-purple-600 cursor-pointer"
                          onClick={e => {
                            e.stopPropagation();
                            onMethodCall(sig, data.tsFile, 'contractcall');
                          }}
                        >
                          Call
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>contractcall</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground p-2 text-center">
              No methods available
            </div>
          )}
        </div>
      )}
    </div>
  );
};
