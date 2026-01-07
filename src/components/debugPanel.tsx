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
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {useSettingsStore} from '@/state/useSettings';
import {rpcClient} from '@/lib/api';
import {toast} from 'sonner';
import {runContractMethod} from '@/utils/contractRunner';
import {PlayIcon} from 'lucide-react';
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
} from 'react-icons/vsc';

import {DebugCallType} from '@/constants';
import {useFileStore} from '@/state/useFile';
import {useConsoleStore} from '@/state/useConsole';
import {useDebugStore} from '@/state/useDebugStore';
import type {
  DebugNode,
  Breakpoint,
  DebugInfo,
  Variable,
  FileType,
} from '@/types';

import {useTabsStore} from '@/state/useTabs';

export default function DebugPanel() {
  const chainType = useSettingsStore(state => state.chainType);
  const handleOpenFile = useTabsStore(state => state.handleOpenFile);
  const {
    isDebugging,
    isPaused,
    debugSession,
    debugInfo,
    setIsDebugging,
    setIsPaused,
    setDebugSession,
    loadDebugInfo,
    toggleBreakpoint,
    setCurrentDebugFileId,
    currentDebugFileId,
    setCurrentLine,
  } = useDebugStore(
    useShallow(state => ({
      isDebugging: state.isDebugging,
      isPaused: state.isPaused,
      debugSession: state.debugSession,
      debugInfo: state.debugInfo,
      setIsDebugging: state.setIsDebugging,
      setIsPaused: state.setIsPaused,
      setDebugSession: state.setDebugSession,
      loadDebugInfo: state.loadDebugInfo,
      toggleBreakpoint: state.toggleBreakpoint,
      setCurrentDebugFileId: state.setCurrentDebugFileId,
      currentDebugFileId: state.currentDebugFileId,
      setCurrentLine: state.setCurrentLine,
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
      const rawTx = await runContractMethod(tsFile.content, methodName);
      if (!rawTx) {
        toast.error('Method execution failed');
        return;
      }
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
      if (!privateKey) {
        toast.error('Private key not found in environment variables');
        return;
      }
      // // signrawtransaction
      // const signedTx = await rpcClient
      //   .getClient(chainType)
      //   .signRawTransaction(rawTx, [], [privateKey], false);
      // if (signedTx.error) {
      //   toast.error('Sign raw transaction failed');
      //   return;
      // }
      // console.log('sign raw transaction result', signedTx);

      // // sendrawtransaction
      // const txHash = await rpcClient
      //   .getClient(chainType)
      //   .sendRawTransaction(signedTx.result.hex);
      // if (txHash.error) {
      //   toast.error('Send raw transaction failed');
      //   return;
      // }
      const txHash = await rpcClient.getClient(chainType).tryContract(rawTx);
      addLog('TypeScript executed successfully', txHash);
    } catch (e) {
      console.error('Method execution failed', e);
      toast.error('Method execution failed');
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
      const attachResult = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.attach);
      console.log('attach result:', attachResult);

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
          }
        }
      }

      // 4. Enter debug mode and highlight first breakpoint
      setIsDebugging(true);
      setIsPaused(true);
      setDebugSession({
        sessionId: 'default',
        breakpoints: sortedBreakpoints.map(bp => ({
          line: bp.lineNumber,
          file: debugFile.name,
        })),
      });

      // Set current line to the first breakpoint
      const firstBreakpoint = sortedBreakpoints[0];
      if (firstBreakpoint) {
        setCurrentLine(firstBreakpoint.lineNumber);
      }

      toast.success('Debug session attached');
    } catch (error) {
      console.error('Attach failed:', error);
      toast.error('Failed to attach debug session');
    }
  };

  const restartDebugSession = async () => {
    if (!debugFile) {
      toast.error('Please select a file to debug');
      return;
    }
    handleOpenFile(debugFile);

    try {
      const res = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.start);

      if (res && res.result) {
        toast.success('Debug session restarted');

        const currentSession = useDebugStore.getState().debugSession;
        setDebugSession({
          sessionId: 'default',
          breakpoints: currentSession ? currentSession.breakpoints : [],
        });

        setIsDebugging(true);
        setIsPaused(true);
      } else {
        toast.error('Failed to restart debug session');
      }
    } catch (error) {
      console.error('Restart failed:', error);
      toast.error('Failed to restart debug session');
    }
  };

  const handleStopDebugging = async () => {
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
      setIsPaused(false);
      setDebugSession(null);
      setCurrentLine(null);
    }
  };

  const handleContinue = async () => {
    if (!debugSession) return;

    try {
      setIsPaused(false);
      const [result, err] = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.continue);
      if (err) throw new Error(err);
      updateDebugState(result);
    } catch (error) {
      console.error('Continue failed:', error);
      toast.error('Continue failed');
      setIsPaused(true);
    }
  };

  const handlePause = async () => {
    if (!debugSession) return;

    try {
      const [result, err] = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.pause);
      if (err) throw new Error(err);
      updateDebugState(result);
    } catch (error) {
      console.error('Pause failed:', error);
      toast.error('Failed to pause execution');
    }
  };

  const handleStepOver = async () => {
    if (!debugSession) return;

    try {
      const [result, err] = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.stepOver);
      if (err) throw new Error(err);
      updateDebugState(result);
    } catch (error) {
      console.error('Step over failed:', error);
      toast.error('Step over failed');
    }
  };

  const handleStepInto = async () => {
    if (!debugSession) return;

    try {
      const [result, err] = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.stepInto);
      if (err) throw new Error(err);
      updateDebugState(result);
    } catch (error) {
      console.error('Step into failed:', error);
      toast.error('Step into failed');
    }
  };

  const handleStepOut = async () => {
    if (!debugSession) return;

    try {
      const [result, err] = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.stepOut);
      if (err) throw new Error(err);
      updateDebugState(result);
    } catch (error) {
      console.error('Step out failed:', error);
      toast.error('Step out failed');
    }
  };

  const updateDebugState = (debugInfo: DebugInfo) => {
    if (debugInfo) {
      setIsPaused(debugInfo.isPaused || false);

      // Update current line in editor if needed
      if (debugInfo.currentLine && debugFile) {
        // You'll need to pass a callback to update the current line in the editor
        // onCurrentLineChange?.(debugInfo.currentLine);
      }
    }
  };

  return (
    <div className="flex h-full flex-col p-4 space-y-10">
      {/* Integrated Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Bug className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Debugger</h2>
        </div>
      </div>

      <div className="flex-1 space-y-10 overflow-y-auto pr-1">
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
                      onClick={restartDebugSession}
                      disabled={!isDebugging}
                      className="h-8 w-8 p-0 rounded-xl text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                    >
                      <VscDebugRestart className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restart</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStopDebugging}
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
                      onClick={handleContinue}
                      disabled={!isDebugging || !isPaused}
                      className="h-8 w-8 p-0 rounded-xl text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-20"
                    >
                      <VscDebugContinue className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Resume</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePause}
                      disabled={!isDebugging || isPaused}
                      className="h-8 w-8 p-0 rounded-xl text-blue-600 hover:bg-blue-500/10 disabled:opacity-20"
                    >
                      <VscDebugPause className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Pause</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStepOver}
                      disabled={!isPaused}
                      className="h-8 w-8 p-0 rounded-xl text-foreground/70 hover:bg-foreground/5 disabled:opacity-20"
                    >
                      <VscDebugStepOver className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step Over</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStepInto}
                      disabled={!isPaused}
                      className="h-8 w-8 p-0 rounded-xl text-foreground/70 hover:bg-foreground/5 disabled:opacity-20"
                    >
                      <VscDebugStepInto className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step Into</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleStepOut}
                      disabled={!isPaused}
                      className="h-8 w-8 p-0 rounded-xl text-foreground/70 hover:bg-foreground/5 disabled:opacity-20"
                    >
                      <VscDebugStepOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Step Out</TooltipContent>
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

          <div className="flex items-center gap-2">
            {/* Manual input removed as per requirements */}
          </div>

          <div className="space-y-2">
            {(() => {
              // Get breakpoints from the selected file or current debug context
              // Since this panel is often context-specific, maybe we show breakpoints of the `selectedFile` if it matches C file?
              // The `selectedFile` state seems to be the one we are "debugging" or "about to debug".
              const breakpoints = debugFile?.breakpoints || [];

              return breakpoints.length > 0 ? (
                breakpoints.map((bp, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/40 text-xs"
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
  onMethodCall: (sig: string, file: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const truncatedAddress =
    data.contractAddress && data.contractAddress.length > 10
      ? `${data.contractAddress.slice(0, 6)}...${data.contractAddress.slice(
          -4,
        )}`
      : data.contractAddress || 'Unknown';

  const dateStr = data.lastModified
    ? new Date(data.lastModified).toLocaleString()
    : '';

  return (
    <Card className="mb-2 overflow-hidden border-muted/40 shadow-sm">
      <CardHeader
        className="p-3 cursor-pointer flex flex-row items-center justify-between space-y-0 bg-muted/20 hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <CardTitle className="text-xs font-medium flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-normal">Contract:</span>
            <span className="font-mono text-primary/80">
              {truncatedAddress}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 mr-2">
            {dateStr}
          </span>
        </CardTitle>
        {isOpen ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        )}
      </CardHeader>
      {isOpen && (
        <CardContent className="p-2 space-y-2 bg-background/50">
          <div className="flex flex-col gap-1">
            {data.methodIdentifiers &&
            Object.keys(data.methodIdentifiers).length > 0 ? (
              Object.keys(data.methodIdentifiers).map(sig => (
                <Button
                  key={sig}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 text-xs font-mono hover:bg-primary/10 hover:text-primary transition-colors truncate"
                  onClick={e => {
                    e.stopPropagation();
                    onMethodCall(sig, data.tsFile);
                  }}
                >
                  <PlayIcon className="mr-2 h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {sig.match(/\s*(\w+)\s*\(/)?.[1] || sig}
                  </span>
                </Button>
              ))
            ) : (
              <div className="text-xs text-muted-foreground p-2 text-center">
                No methods available
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
