"use client";

import { useState, useEffect } from "react";
import { FileIcon} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRootStore } from "@/state";
import { rpcClient } from "@/lib/api";
import { toast } from "sonner";
import type { FileType } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  VscDebugStart,
  VscDebugPause,
  VscDebugStepOver,
  VscDebugStepInto,
  VscDebugStepOut,
  VscDebugRestart,
} from "react-icons/vsc";

import { DebugCallType } from "@/constants";

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

export default function DebugPanel({ files, setCurrentFile }: DebugPanelProps) {
  const { chainType } = useRootStore().settings;
  const [isDebugging, setIsDebugging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [debugSession, setDebugSession] = useState<{
    sessionId: string;
    breakpoints: { line: number; file: string }[];
  } | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Filter C files for debugging
  const cFiles = files.filter((file) => file.name.endsWith(".c"));
  const selectedFile = files.find((file) => file.id === selectedFileId) || null;

  const [transactionHash, setTransactionHash] = useState<string>("");

  // Auto-select first .c file if none selected and files are available
  useEffect(() => {
    if (cFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(cFiles[0].id);
      setCurrentFile(cFiles[0]);
    }
  }, [cFiles, selectedFileId, setCurrentFile]);

  // Initialize debug session
  const initializeDebugSession = async () => {
    if (!selectedFile) {
      toast.error("Please select a file to debug");
      return false;
    }

    try {
      // Set breakpoints for the selected file
      if (selectedFile.breakpoints?.length) {
        const breakpoints = selectedFile.breakpoints.map(
          (bp: { lineNumber: number; condition?: string }) => ({
            line: bp.lineNumber,
            file: selectedFile?.name || "",
            condition: bp.condition,
          })
        );

        // Use the breakpoints in the debug call
        const response = await rpcClient
          .getClient(chainType)
          .debugCall("breakpoints");

        setDebugSession({
          sessionId: response.sessionId,
          breakpoints: response.breakpoints,
        });
      }

      return true;
    } catch (error) {
      console.error("Failed to initialize debug session:", error);
      toast.error("Failed to start debug session");
      return false;
    }
  };

  const handleStartDebugging = async () => {
    if (!selectedFile) {
      toast.warning("Please select a file to debug");
      return;
    }

    const initialized = await initializeDebugSession();
    if (!initialized) return;

    setIsDebugging(true);
    setIsPaused(true);

    try {
      // Start the debugger
      const debugInfo = await rpcClient.getClient(chainType).debugCall("start");

      // Update UI with initial debug state
      if (debugInfo) {
        setVariables(debugInfo.variables || []);
      }
    } catch (error) {
      console.error("Debug start failed:", error);
      toast.error("Failed to start debugging");
      setIsDebugging(false);
      setIsPaused(false);
    }
  };

  const handleStopDebugging = async () => {
    try {
      if (debugSession) {
        await rpcClient.getClient(chainType).debugCall("stop");
      }
    } catch (error) {
      console.error("Error stopping debug session:", error);
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
      const result = await rpcClient.getClient(chainType).debugCall("continue");
      updateDebugState(result);
    } catch (error) {
      console.error("Continue failed:", error);
      toast.error("Continue failed");
      setIsPaused(true);
    }
  };

  const handlePause = async () => {
    if (!debugSession) return;

    try {
      const result = await rpcClient.getClient(chainType).debugCall("pause");
      updateDebugState(result);
    } catch (error) {
      console.error("Pause failed:", error);
      toast.error("Failed to pause execution");
    }
  };

  const handleStepOver = async () => {
    if (!debugSession) return;

    try {
      const result = await rpcClient.getClient(chainType).debugCall("stepOver");
      updateDebugState(result);
    } catch (error) {
      console.error("Step over failed:", error);
      toast.error("Step over failed");
    }
  };

  const handleStepInto = async () => {
    if (!debugSession) return;

    try {
      const result = await rpcClient.getClient(chainType).debugCall("stepInto");
      updateDebugState(result);
    } catch (error) {
      console.error("Step into failed:", error);
      toast.error("Step into failed");
    }
  };

  const handleStepOut = async () => {
    if (!debugSession) return;

    try {
      const result = await rpcClient.getClient(chainType).debugCall("stepOut");
      updateDebugState(result);
    } catch (error) {
      console.error("Step out failed:", error);
      toast.error("Step out failed");
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
    <div className="flex h-full flex-col p-4 space-y-4">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Debugger</h2>
        </div>

        <div className="space-y-2">
          <Label htmlFor="debug-file">Select File</Label>
          <Select
            value={selectedFileId || ""}
            onValueChange={(value) => {
              setSelectedFileId(value);
              const file = files.find((f) => f.id === value);
              if (file) setCurrentFile(file);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a file to debug" />
            </SelectTrigger>
            <SelectContent>
              {cFiles.map((file) => (
                <SelectItem key={file.id} value={file.id}>
                  <div className="flex items-center">
                    <FileIcon className="mr-2 h-4 w-4" />
                    {file.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="debug-addr">Transaction Hash</Label>
          <Input
            id="debug-addr"
            placeholder="Enter transaction hash"
            value={transactionHash}
            onChange={(e) => setTransactionHash(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Debug Controls</CardTitle>
          <CardDescription>
            {selectedFile
              ? `Ready to debug: ${selectedFile.name}`
              : cFiles.length > 0
              ? "Select a C file to debug"
              : "No C files available"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md w-fit">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartDebugging}
                    className="h-8 w-8 p-0"
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
                    onClick={handlePause}
                    className="h-8 w-8 p-0"
                  >
                    <VscDebugPause className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pause (F6)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStepOver}
                    disabled={!isPaused}
                    className="h-8 w-8 p-0"
                  >
                    <VscDebugStepOver className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Step Over (F10)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStepInto}
                    disabled={!isPaused}
                    className="h-8 w-8 p-0"
                  >
                    <VscDebugStepInto className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Step Into (F11)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStepOut}
                    disabled={!isPaused}
                    className="h-8 w-8 p-0"
                  >
                    <VscDebugStepOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Step Out (Shift+F11)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleStartDebugging}
                    className="h-8 w-8 p-0"
                  >
                    <VscDebugRestart className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restart (Ctrl+Shift+F5)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
