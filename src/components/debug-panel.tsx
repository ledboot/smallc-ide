"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  BugIcon,
  PlayIcon,
  StepForwardIcon,
  StepBackIcon as StepIntoIcon,
  StepBackIcon as StepOutIcon,
  MonitorStopIcon as StopIcon,
  InfoIcon,
  EyeIcon,
} from "lucide-react"
import type { FileType } from "@/lib/types"

interface DebugPanelProps {
  files: FileType[]
  currentFile: FileType | null
}

interface Breakpoint {
  file: string
  line: number
  enabled: boolean
}

interface Variable {
  name: string
  value: string
  type: string
}

export default function DebugPanel({ files, currentFile }: DebugPanelProps) {
  const [isDebugging, setIsDebugging] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([])
  const [variables, setVariables] = useState<Variable[]>([
    { name: "argc", value: "1", type: "int" },
    { name: "argv", value: "0x7fff5fbff5c8", type: "char**" },
    { name: "result", value: "42", type: "int" },
  ])
  const [watchExpressions, setWatchExpressions] = useState<string[]>([])
  const [newWatchExpression, setNewWatchExpression] = useState("")

  const debuggableFiles = files.filter(
    (file) =>
      file.name.endsWith(".c") || file.name.endsWith(".cpp") || file.name.endsWith(".cc") || file.name.endsWith(".cxx"),
  )

  const handleStartDebugging = () => {
    setIsDebugging(true)
    setIsPaused(true)
  }

  const handleStopDebugging = () => {
    setIsDebugging(false)
    setIsPaused(false)
  }

  const handleContinue = () => {
    setIsPaused(false)
    // Simulate hitting a breakpoint after some time
    setTimeout(() => {
      if (isDebugging) {
        setIsPaused(true)
      }
    }, 2000)
  }

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
              <div className="flex flex-wrap gap-2">
                {!isDebugging ? (
                  <Button
                    onClick={handleStartDebugging}
                    disabled={!currentFile || !debuggableFiles.some((f) => f.id === currentFile.id)}
                    size="sm"
                  >
                    <PlayIcon className="mr-2 h-4 w-4" />
                    Start Debugging
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleStopDebugging} variant="destructive" size="sm">
                      <StopIcon className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                    <Button onClick={handleContinue} disabled={!isPaused} size="sm">
                      <PlayIcon className="mr-2 h-4 w-4" />
                      Continue
                    </Button>
                    <Button disabled={!isPaused} size="sm">
                      <StepForwardIcon className="mr-2 h-4 w-4" />
                      Step Over
                    </Button>
                    <Button disabled={!isPaused} size="sm">
                      <StepIntoIcon className="mr-2 h-4 w-4" />
                      Step Into
                    </Button>
                    <Button disabled={!isPaused} size="sm">
                      <StepOutIcon className="mr-2 h-4 w-4" />
                      Step Out
                    </Button>
                  </>
                )}
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
