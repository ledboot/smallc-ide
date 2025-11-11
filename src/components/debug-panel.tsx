"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { BugIcon, InfoIcon, EyeIcon } from "lucide-react"
import {
  VscDebugStart,
  VscDebugStop,
  VscDebugPause,
  VscDebugContinue,
  VscDebugStepOver,
  VscDebugStepInto,
  VscDebugStepOut,
  VscDebugRestart
} from "react-icons/vsc"
import type { FileType } from "@/lib/types"
import { rpcClient } from "@/lib/api"
import { useRootStore } from "@/state"

interface DebugPanelProps {
  files: FileType[]
  currentFile: FileType | null
}

interface Variable {
  name: string
  value: string
  type: string
}

export default function DebugPanel({ files, currentFile }: DebugPanelProps) {
  const { chainType } = useRootStore().settings
  const [isDebugging, setIsDebugging] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [variables, setVariables] = useState<Variable[]>([])
  const [watchExpressions, setWatchExpressions] = useState<string[]>([])
  const [newWatchExpression, setNewWatchExpression] = useState("")
  const [debugSession, setDebugSession] = useState<{
    sessionId: string
    breakpoints: { line: number; file: string }[]
  } | null>(null)

  const debuggableFiles = files.filter(
    (file) =>
      file.name.endsWith(".c") || file.name.endsWith(".cpp") || file.name.endsWith(".cc") || file.name.endsWith(".cxx"),
  )

  // Initialize debug session
  const initializeDebugSession = async () => {
    try {
      // Set breakpoints for the current file
      if (currentFile?.breakpoints?.length) {
        const breakpoints = currentFile.breakpoints.map(bp => ({
          line: bp.lineNumber,
          file: currentFile.name,
          condition: bp.condition
        }));
        
        const response = await rpcClient.getClient(chainType).debugCall('breakpoints');
        
        setDebugSession({
          sessionId: response.sessionId,
          breakpoints: response.breakpoints
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize debug session:', error);
      toast.error('Failed to start debug session');
      return false;
    }
  };

  const handleStartDebugging = async () => {
    if (!currentFile) {
      toast.warning('Please select a file to debug');
      return;
    }

    const initialized = await initializeDebugSession();
    if (!initialized) return;
    
    setIsDebugging(true);
    setIsPaused(true);
    
    try {
      // Start the debugger
      const debugInfo = await rpcClient.getClient(chainType).debugCall('start');
      
      // Update UI with initial debug state
      if (debugInfo) {
        setVariables(debugInfo.variables || []);
      }
    } catch (error) {
      console.error('Debug start failed:', error);
      toast.error('Failed to start debugging');
      setIsDebugging(false);
      setIsPaused(false);
    }
  }

  const handleStopDebugging = async () => {
    try {
      if (debugSession) {
        await rpcClient.getClient(chainType).debugCall('stop');
      }
    } catch (error) {
      console.error('Error stopping debug session:', error);
    } finally {
      setIsDebugging(false);
      setIsPaused(false);
      setDebugSession(null);
      setVariables([]);
    }
  }

  const handleContinue = async () => {
    if (!debugSession) return;
    
    try {
      setIsPaused(false);
      const result = await rpcClient.getClient(chainType).debugCall('continue');
      updateDebugState(result);
    } catch (error) {
      console.error('Continue failed:', error);
      toast.error('Continue failed');
      setIsPaused(true);
    }
  }

  const handlePause = async () => {
    if (!debugSession) return;
    
    try {
      const result = await rpcClient.getClient(chainType).debugCall('pause');
      updateDebugState(result);
    } catch (error) {
      console.error('Pause failed:', error);
      toast.error('Failed to pause execution');
    }
  }

  const handleStepOver = async () => {
    if (!debugSession) return;
    
    try {
      const result = await rpcClient.getClient(chainType).debugCall('stepOver');
      updateDebugState(result);
    } catch (error) {
      console.error('Step over failed:', error);
      toast.error('Step over failed');
    }
  }

  const handleStepInto = async () => {
    if (!debugSession) return;
    
    try {
      const result = await rpcClient.getClient(chainType).debugCall('stepInto');
      updateDebugState(result);
    } catch (error) {
      console.error('Step into failed:', error);
      toast.error('Step into failed');
    }
  }

  const handleStepOut = async () => {
    if (!debugSession) return;
    
    try {
      const result = await rpcClient.getClient(chainType).debugCall('stepOut');
      updateDebugState(result);
    } catch (error) {
      console.error('Step out failed:', error);
      toast.error('Step out failed');
    }
  }

  const updateDebugState = (debugInfo: any) => {
    if (debugInfo) {
      setVariables(debugInfo.variables || []);
      setIsPaused(debugInfo.isPaused || false);
      
      // Update current line in editor if needed
      if (debugInfo.currentLine && currentFile) {
        // You'll need to pass a callback to update the current line in the editor
        // onCurrentLineChange?.(debugInfo.currentLine);
      }
    }
  };

  const handleAddWatchExpression = () => {
    if (newWatchExpression.trim()) {
      setWatchExpressions([...watchExpressions, newWatchExpression.trim()])
      setNewWatchExpression("")
    }
  }

  const handleRemoveWatchExpression = (index: number) => {
    setWatchExpressions(watchExpressions.filter((_, i) => i !== index))
  }

  return (
    <div className="flex h-full flex-col p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BugIcon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Debug</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Debug Controls</CardTitle>
          <CardDescription>
            {currentFile && debuggableFiles.some((f) => f.id === currentFile.id)
              ? `Ready to debug: ${currentFile.name}`
              : "Select a C/C++ file to debug"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {debuggableFiles.length > 0 ? (
            <>
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md w-fit">
                <TooltipProvider>
                  {!isDebugging ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleStartDebugging}
                          disabled={!currentFile || !debuggableFiles.some((f) => f.id === currentFile.id)}
                          className="h-8 w-8 p-0"
                        >
                          <VscDebugStart className="h-4 w-4 text-green-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Start Debugging (F5)</TooltipContent>
                    </Tooltip>
                  ) : (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleStopDebugging}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <VscDebugStop className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Stop (Shift+F5)</TooltipContent>
                      </Tooltip>

                      <Separator orientation="vertical" className="h-6 mx-1" />

                      {isPaused ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={handleContinue}
                              className="h-8 w-8 p-0"
                            >
                              <VscDebugContinue className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Continue (F5)</TooltipContent>
                        </Tooltip>
                      ) : (
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
                      )}

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
                    </>
                  )}
                </TooltipProvider>
              </div>

              {isDebugging && (
                <div className="flex items-center gap-2">
                  <Badge variant={isPaused ? "destructive" : "default"}>{isPaused ? "Paused" : "Running"}</Badge>
                  {isPaused && <span className="text-sm text-muted-foreground">Paused at line 15 in main()</span>}
                </div>
              )}
            </>
          ) : (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>No debuggable files found. Create a C/C++ file to get started.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {isDebugging && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {variables.map((variable, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <EyeIcon className="h-3 w-3" />
                      <span className="font-mono">{variable.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {variable.type}
                      </Badge>
                    </div>
                    <span className="font-mono text-muted-foreground">{variable.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Watch Expressions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter expression to watch"
                  value={newWatchExpression}
                  onChange={(e) => setNewWatchExpression(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddWatchExpression()
                  }}
                />
                <Button onClick={handleAddWatchExpression} size="sm">
                  Add
                </Button>
              </div>

              {watchExpressions.length > 0 && (
                <div className="space-y-2">
                  {watchExpressions.map((expression, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{expression}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">undefined</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveWatchExpression(index)}>
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Call Stack</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm font-mono">
                <div className="bg-accent p-2 rounded">main() at main.c:15</div>
                <div className="text-muted-foreground p-2">_start() at crt0.c:23</div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
