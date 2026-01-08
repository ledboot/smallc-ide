'use client';

import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {useDebugStore} from '@/state/useDebugStore';
import {useShallow} from 'zustand/react/shallow';
import {ChevronRight, ChevronDown, Layers, Variable} from 'lucide-react';
import {useState} from 'react';

export default function DebugWatchPanel() {
  const {isDebugging, currentLine, debugVariables, debugCallStack} =
    useDebugStore(
      useShallow(state => ({
        isDebugging: state.isDebugging,
        currentLine: state.currentLine,
        debugVariables: state.debugVariables,
        debugCallStack: state.debugCallStack,
      })),
    );

  const [isVariablesOpen, setIsVariablesOpen] = useState(true);
  const [isCallStackOpen, setIsCallStackOpen] = useState(true);

  // Use real data from store
  const variables = debugVariables;
  const callStack = debugCallStack;

  if (!isDebugging) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground text-sm">
          <Variable className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Start debugging to view variables</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="p-4 space-y-4">
        {/* Variables Section */}
        <Card className="border-muted/40">
          <CardHeader
            className="p-3 cursor-pointer hover:bg-muted/20 transition-colors"
            onClick={() => setIsVariablesOpen(!isVariablesOpen)}
          >
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {isVariablesOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Variable className="h-4 w-4 text-primary" />
              Variables
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {variables.length}
              </span>
            </CardTitle>
          </CardHeader>
          {isVariablesOpen && (
            <CardContent className="p-0 pb-2">
              {variables.length > 0 ? (
                <div className="space-y-1">
                  {variables.map((variable, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono text-primary truncate">
                            {variable.name}
                          </span>
                          {variable.type && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {variable.type}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-foreground/80 shrink-0">
                          {variable.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No variables in current scope
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Call Stack Section */}
        <Card className="border-muted/40">
          <CardHeader
            className="p-3 cursor-pointer hover:bg-muted/20 transition-colors"
            onClick={() => setIsCallStackOpen(!isCallStackOpen)}
          >
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {isCallStackOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Layers className="h-4 w-4 text-primary" />
              Call Stack
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {callStack.length}
              </span>
            </CardTitle>
          </CardHeader>
          {isCallStackOpen && (
            <CardContent className="p-0 pb-2">
              {callStack.length > 0 ? (
                <div className="space-y-1">
                  {callStack.map((frame, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground font-mono w-6 text-right">
                          {index}
                        </span>
                        <span className="font-mono text-foreground/90 truncate">
                          {frame.name}
                        </span>
                      </div>
                      <div className="ml-8 text-[10px] text-muted-foreground font-mono">
                        {frame.address}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No active call stack
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Debug Info */}
        {currentLine !== null && (
          <div className="text-xs text-muted-foreground px-1">
            Current line: <span className="font-mono">{currentLine}</span>
          </div>
        )}
      </div>
    </div>
  );
}
