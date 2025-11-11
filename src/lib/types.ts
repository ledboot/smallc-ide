export interface FileType {
  id: string
  name: string
  content: string
  lastModified: string
  breakpoints?: Breakpoint[]
}

export interface Breakpoint {
  lineNumber: number
  enabled: boolean
  condition?: string
}

export interface DebugInfo {
  currentLine?: number
  callStack: CallFrame[]
  variables: Variable[]
}

export interface CallFrame {
  functionName: string
  file: string
  line: number
  column: number
}

export interface Variable {
  name: string
  value: string
  type: string
}

export interface CompiledResult {
  bytecode: string
  abi: string
  hash: string
}