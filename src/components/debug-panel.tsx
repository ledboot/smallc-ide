'use client';

import {useState, useEffect} from 'react';
import {FileIcon, Bug} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {Input} from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {useRootStore} from '@/state';
import {rpcClient} from '@/lib/api';
import {toast} from 'sonner';
import type {FileType} from '@/lib/types';
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

interface DebugPanelProps {
  files: FileType[];
  setCurrentFile: (file: FileType | null) => void;
}

interface Breakpoint {
  lineNumber: number;
  condition?: string;
  enabled?: boolean;
}

interface DebugInfo {
  isPaused: boolean;
  currentLine?: number;
  variables: Variable[];
  callStack: Array<{
    function: string;
    file: string;
    line: number;
  }>;
}

interface Variable {
  name: string;
  value: string;
  type: string;
}

export default function DebugPanel({files, setCurrentFile}: DebugPanelProps) {
  const {chainType} = useRootStore().settings;
  const [isDebugging, setIsDebugging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [debugSession, setDebugSession] = useState<{
    sessionId: string;
    breakpoints: {line: number; file: string}[];
  } | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);

  // Filter C files for debugging
  const cFiles = files.filter(file => file.name.endsWith('.c'));
  const selectedFile = files.find(file => file.id === selectedFileId) || null;

  const [transactionHash, setTransactionHash] = useState<string>('');

  const attachDebugSession = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to debug');
      return;
    }
    setCurrentFile(selectedFile);

    try {
      const res = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.attach);

      if (res && res.result) {
        toast.success('Debug session attached');
        setIsDebugging(true);
        setIsPaused(true);
        setDebugSession({
          sessionId: 'default',
          breakpoints: [],
        });
        // 打开对应的文件
        setCurrentFile(selectedFile);
      } else {
        toast.error('Failed to attach debug session');
      }
    } catch (error) {
      console.error('Attach failed:', error);
      toast.error('Failed to attach debug session');
    }
  };

  const restartDebugSession = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to debug');
      return;
    }

    try {
      const res = await rpcClient
        .getClient(chainType)
        .debugCall(DebugCallType.start);

      if (res && res.result) {
        toast.success('Debug session restarted');
        setIsDebugging(true);
        setIsPaused(true);
        setDebugSession({
          sessionId: 'default',
          breakpoints: [],
        });
        // 打开对应的文件
        setCurrentFile(selectedFile);
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
      setVariables([]);
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
      setVariables(debugInfo.variables || []);
      setIsPaused(debugInfo.isPaused || false);

      // Update current line in editor if needed
      if (debugInfo.currentLine && selectedFile) {
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
              value={selectedFileId || ''}
              onValueChange={setSelectedFileId}
              disabled={isDebugging}
            >
              <SelectTrigger
                id="debug-file"
                className="h-12 w-full max-w-[200px] px-2 hover:bg-muted/40 focus:ring-0 focus:ring-offset-0"
              >
                <SelectValue placeholder="Select target..." />
              </SelectTrigger>
              <SelectContent className="border-none shadow-xl bg-background/95 backdrop-blur-md">
                {cFiles.map(file => (
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
      </div>
    </div>
  );
}
