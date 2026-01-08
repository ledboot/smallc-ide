'use client';

import {useDebugStore} from '@/state/useDebugStore';
import {useShallow} from 'zustand/react/shallow';
import {ChevronRight, ChevronDown, PlayCircle} from 'lucide-react';
import {useState} from 'react';

export default function DebugControlPanel() {
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

  if (!isDebugging) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground text-sm">
          <PlayCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a file and set breakpoints in the Debug Panel</p>
          <p className="text-xs mt-1">Then click Start to begin debugging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-background">
      {/* Variables Section */}
      <div className="border-b border-border/40">
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors select-none"
          onClick={() => setIsVariablesOpen(!isVariablesOpen)}
        >
          {isVariablesOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Variables
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/60 font-medium">
            {debugVariables.length}
          </span>
        </div>

        {isVariablesOpen && (
          <div className="pb-1">
            {debugVariables.length > 0 ? (
              <div>
                {debugVariables.map((variable, index) => (
                  <div
                    key={index}
                    className="px-3 py-1.5 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs font-mono text-primary/90 truncate font-medium">
                          {variable.name}
                        </span>
                        {variable.type && (
                          <span className="text-[9px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded font-mono">
                            {variable.type}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-foreground/70 shrink-0">
                        {variable.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-xs text-muted-foreground/60 text-center italic">
                No variables in current scope
              </div>
            )}
          </div>
        )}
      </div>

      {/* Call Stack Section */}
      <div className="border-b border-border/40">
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors select-none"
          onClick={() => setIsCallStackOpen(!isCallStackOpen)}
        >
          {isCallStackOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Call Stack
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground/60 font-medium">
            {debugCallStack.length}
          </span>
        </div>

        {isCallStackOpen && (
          <div className="pb-1">
            {debugCallStack.length > 0 ? (
              <div>
                {debugCallStack.map((frame, index) => (
                  <div
                    key={index}
                    className="px-3 py-1.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-[10px] text-muted-foreground/50 font-mono mt-0.5 w-4 text-right shrink-0">
                        {index}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono text-foreground/90 truncate font-medium">
                          {frame.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                          {frame.address}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-xs text-muted-foreground/60 text-center italic">
                No active call stack
              </div>
            )}
          </div>
        )}
      </div>

      {/* Debug Info */}
      {currentLine !== null && (
        <div className="px-3 py-2 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              Current Line:
            </span>
            <span className="text-xs font-mono font-medium text-primary">
              {currentLine}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
