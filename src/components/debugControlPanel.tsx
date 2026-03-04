'use client';

import {useDebugStore} from '@/state/useDebugStore';
import {useShallow} from 'zustand/react/shallow';
import {ChevronRight, ChevronDown, Bug} from 'lucide-react';
import {useState} from 'react';
import {cn} from '@/utils/twMerge';

interface VariableItemProps {
  name: string;
  type?: string;
  value: any;
  isFetching?: boolean;
  depth?: number;
  structure?: any;
}

interface DebugVariable {
  name: string;
  type?: string;
  value: any;
  isFetching: boolean;
  structure?: any;
}

function VariableItem({
  name,
  type,
  value,
  isFetching,
  depth = 0,
  structure,
}: VariableItemProps) {
  const [isOpen, setIsOpen] = useState(depth < 1);

  let parsedValue = value;
  let isObject = false;

  if (
    typeof value === 'string' &&
    value.startsWith('{') &&
    value.endsWith('}')
  ) {
    try {
      parsedValue = JSON.parse(value);
      isObject = true;
    } catch (e) {
      console.error(e);
    }
  } else if (typeof value === 'object' && value !== null) {
    isObject = true;
  } else if (structure && structure.__TYPE__ === 'struct') {
    isObject = true;
    if (!parsedValue) parsedValue = {};
  }

  const keys = isObject ? Object.keys(parsedValue) : [];
  const displayKeys =
    keys.length > 0
      ? keys
      : structure
        ? Object.keys(structure).filter(k => k !== '__TYPE__')
        : [];
  const hasChildren = displayKeys.length > 0;

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'group flex items-center gap-2 py-1.5 hover:bg-muted/30 transition-colors cursor-default select-none relative',
          hasChildren && 'cursor-pointer',
        )}
        style={{paddingLeft: `${depth * 16 + 8}px`}}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        {depth > 0 &&
          Array.from({length: depth}).map((_, i) => (
            <div
              key={i}
              className="absolute h-full w-px bg-muted/20"
              style={{left: `${i * 16 + 14}px`}}
            />
          ))}

        <div className="flex items-center gap-1.5 min-w-0 flex-1 z-10">
          {hasChildren ? (
            <div className="p-0.5 rounded-sm hover:bg-muted/50 transition-colors">
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </div>
          ) : (
            <div className="w-4.5 flex justify-center">
              <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          )}

          <span className="text-xs font-mono font-medium text-primary/90 truncate">
            {name}
          </span>

          {type && (
            <span className="text-[9px] text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded font-mono shrink-0">
              {type}
            </span>
          )}
        </div>

        <div className="flex-1 text-right min-w-0 z-10 pr-2">
          {!isObject ? (
            <span
              className={cn(
                'text-xs font-mono truncate',
                isFetching
                  ? 'text-muted-foreground/50 italic animate-pulse'
                  : 'text-foreground/70',
                typeof value === 'number' &&
                  'text-amber-600 dark:text-amber-400',
                typeof value === 'boolean' &&
                  'text-blue-600 dark:text-blue-400',
              )}
            >
              {isFetching ? '...' : String(value)}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/60 font-mono italic">
              {isOpen ? '' : '{...}'}
            </span>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div className="flex flex-col">
          {displayKeys.map(key => {
            const fieldVal = parsedValue?.[key];

            // Handle new structure where each field has {type, value}
            let actualValue = fieldVal;
            let actualType = structure?.[key]?.type;

            // If fieldVal is an object with type and value properties, extract them
            if (
              fieldVal &&
              typeof fieldVal === 'object' &&
              'type' in fieldVal &&
              'value' in fieldVal
            ) {
              actualType = fieldVal.type;
              actualValue = fieldVal.value;
            } else {
              // Fallback to structure-based type
              const fieldStructure = structure?.[key];
              actualType = fieldStructure?.type;
            }

            let nestedStructure = undefined;
            if (
              actualType &&
              actualType.startsWith('__') &&
              actualType.endsWith('__')
            ) {
              const debugInfo = useDebugStore.getState().debugInfo;
              for (const codeNode of debugInfo) {
                if (codeNode.types && codeNode.types[actualType]) {
                  nestedStructure = codeNode.types[actualType];
                  break;
                }
              }
            }

            return (
              <VariableItem
                key={key}
                name={key}
                value={actualValue}
                depth={depth + 1}
                isFetching={
                  isFetching || (isObject && actualValue === undefined)
                }
                type={actualType}
                structure={nestedStructure}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DebugControlPanel() {
  const {
    isDebugging,
    currentLine,
    debugVariables,
    debugCallStack,
    preparsedVariables,
  } = useDebugStore(
    useShallow(state => ({
      isDebugging: state.isDebugging,
      currentLine: state.currentLine,
      debugVariables: state.debugVariables,
      debugCallStack: state.debugCallStack,
      preparsedVariables: state.preparsedVariables,
    })),
  );

  const [isVariablesOpen, setIsVariablesOpen] = useState(true);
  const [isCallStackOpen, setIsCallStackOpen] = useState(true);

  const variables: DebugVariable[] =
    preparsedVariables.length > 0
      ? preparsedVariables.map(p => {
          const realVar = debugVariables.find(v => v.name === p.name);
          return {
            name: p.name,
            type: p.type,
            value: realVar ? realVar.value : undefined,
            isFetching: !realVar,
            structure: p.structure,
          };
        })
      : debugVariables.map(v => ({
          name: v.name,
          type: v.type,
          value: v.value,
          isFetching: false,
          structure: undefined,
        }));

  if (!isDebugging) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center text-muted-foreground text-sm">
          <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Select a file and set breakpoints in the Debug Panel</p>
          <p className="text-xs mt-1">Then click Start to begin debugging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto bg-background">
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
            {variables.length}
          </span>
        </div>

        {isVariablesOpen && (
          <div className="pb-1">
            {variables.length > 0 ? (
              <div className="divide-y divide-muted/10 px-2">
                {variables.map((variable, index) => (
                  <VariableItem
                    key={index}
                    name={variable.name}
                    type={variable.type}
                    value={variable.value}
                    isFetching={variable.isFetching}
                    structure={variable.structure}
                  />
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
