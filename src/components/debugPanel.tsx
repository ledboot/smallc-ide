'use client';

import {DebugCallType} from '@/constants';
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
  VscDebugStepInto,
  VscDebugStepOut,
  VscDebugStop,
  VscDebugContinue,
  VscLayers,
} from 'react-icons/vsc';

import {useFileStore} from '@/state/useFile';
import {useConsoleStore, LogLevel} from '@/state/useConsole';
import {useDebugStore} from '@/state/useDebugStore';
import {useWalletStore} from '@/state/useWallet';
import {useTabsStore} from '@/state/useTabs';
import {useNodeStore} from '@/state/useNodeStore';

export default function DebugPanel() {
  const handleOpenFile = useTabsStore(state => state.handleOpenFile);
  const {leasedNode, timeRemaining} = useNodeStore();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const {
    isDebugging,
    debugSession,
    setIsDebugging,
    setDebugSession,
    loadDebugInfo,
    toggleBreakpoint,
    setCurrentDebugFileId,
    currentDebugFileId,
    setCurrentLine,
    connectDebugWS,
    finishDebug,
    getDebugClient,
  } = useDebugStore(
    useShallow(state => ({
      isDebugging: state.isDebugging,
      debugSession: state.debugSession,
      debugInfo: state.debugInfo,
      setIsDebugging: state.setIsDebugging,
      setDebugSession: state.setDebugSession,
      loadDebugInfo: state.loadDebugInfo,
      toggleBreakpoint: state.toggleBreakpoint,
      setCurrentDebugFileId: state.setCurrentDebugFileId,
      currentDebugFileId: state.currentDebugFileId,
      setCurrentLine: state.setCurrentLine,
      connectDebugWS: state.connectDebugWS,
      finishDebug: state.finishDebug,
      getDebugClient: state.getDebugClient,
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
  const {
    isConnected,
    currentAccount,
    signTransaction,
    sendTransaction,
    tryContract,
    contractCall,
  } = useWalletStore();

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
  }, [currentDebugFileId, debugFile, loadDebugInfo]);

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

      // Step 2: Execute method through wallet extension
      switch (apiType) {
        case 'sendRawTransaction': {
          if (!isConnected || !currentAccount) {
            toast.error('Please connect your wallet first');
            return;
          }

          addLog('Requesting signature from wallet...', null, LogLevel.INFO);
          const signedTxHex = await signTransaction(rawTx);
          addLog('Transaction signed', {signedTxHex}, LogLevel.SUCCESS);

          addLog('Broadcasting transaction...', null, LogLevel.INFO);
          const txHash = await sendTransaction(signedTxHex);
          addLog(
            'sendRawTransaction executed successfully',
            {txHash},
            LogLevel.SUCCESS,
          );
          toast.success('Transaction sent successfully');
          break;
        }

        case 'tryContract': {
          const result = await tryContract(rawTx);
          if (result.error) {
            toast.error('Try contract failed');
            addLog('tryContract Error:', result.error, LogLevel.ERROR);
            return;
          }
          addLog('tryContract executed successfully', result, LogLevel.SUCCESS);
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

          const result = await contractCall(runData.contractAddress, rawTx);
          if (result.error) {
            toast.error('Contract call failed');
            addLog('contractcall Error:', result.error, LogLevel.ERROR);
            return;
          }
          addLog(
            'contractcall executed successfully',
            result,
            LogLevel.SUCCESS,
          );
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
      // 2. Attach RPC & Setup WebSocket
      if ((debugFile.breakpoints?.length || 0) < 1) {
        toast.warning('set breakpoints first to attach debug session');
        return;
      }

      // Establish WebSocket connection first
      await connectDebugWS();
      const debugClient = getDebugClient();

      await debugClient.debugCall(DebugCallType.attach);

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
            await debugClient.debugCall(DebugCallType.breakpoint, [
              '',
              vmOffset,
            ]);
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
        const debugClient = getDebugClient();
        const response = await debugClient.debugCall(DebugCallType.stop);
        if (response.error) {
          addLog('Error stopping debug session:', response.error.message);
        }
      }
    } catch (error) {
      console.error('Error stopping debug session:', error);
    } finally {
      finishDebug();
    }
  };

  const handleDebugAction = async (action: DebugCallType) => {
    if (!debugSession) return;

    setCurrentLine(null);
    addLog(`debug action: ${action}`);

    try {
      const debugClient = getDebugClient();
      const response = await debugClient.debugCall(action);
      if (response && response.error) {
        toast.error(`${action} failed: ${response.error}`);
        return;
      }

      // Log the confirmation from server
      if (response && response.result) {
        addLog(`[Debugger] ${action}: ${response.result}`);
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
      const debugClient = getDebugClient();
      const response = await debugClient.debugCall(DebugCallType.getstack);

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
    <div className="flex h-full flex-col p-2 pt-4 space-y-6">
      {/* Integrated Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Bug className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Debugger</h2>
        </div>
      </div>

      {/* Leased RPC Node Information Card */}
      {leasedNode && (
        <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.06)] animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">
                Dedicated RPC Leased
              </span>
            </div>
            <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/10">
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="mt-1 space-y-1 divide-y divide-emerald-500/5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 first:pt-0">
              <span>Node Name</span>
              <span className="font-semibold text-emerald-400/90">
                {leasedNode.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 first:pt-0">
              <span>Endpoint</span>
              <span className="font-mono text-foreground/80">
                {leasedNode.httpsEndpoint}
              </span>
            </div>
          </div>
        </div>
      )}

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
