# Developer API Reference

Complete API reference for all built-in classes, utilities and Zustand state stores available in SmallC IDE.

---

## `Asm` — SmallC Assembler

`src/lib/asm.ts`

Compiles SmallC ASM source code into bytecode client-side. No server required.

```typescript
import Asm from '@/lib/asm'

const result = Asm.assemble(code)
```

### `Asm.assemble(code: string): AssemblyResult`

Compiles ASM source into bytecode.

```typescript
interface AssemblyResult {
  bytecode: string    // hex-encoded bytecode
  hash: string        // RIPEMD160 hash of bytecode
  objectCode: string  // intermediate object code
  debugInfo: string   // JSON-serialized debug info array
  success: boolean
  error?: string
}
```

### `Asm.validateSyntax(code: string): { valid: boolean; errors: string[] }`

Validates ASM syntax before compilation. Checks for unmatched quotes, parentheses and invalid variable syntax.

### `Asm.formatCode(code: string): string`

Auto-indents ASM source code. `define` directives and labels are left-aligned; instructions are indented with two spaces.

### `Asm.getSupportedOpcodes(): string[]`

Returns the full list of supported ASM opcodes (e.g. `EVAL32`, `MALLOC`, `CALL`, `RETURN`, …).

---

## `CompilerService` — WASM Compiler

`src/lib/wasm-compiler.ts`

Runs the SmallC compiler inside a Web Worker backed by WebAssembly.

```typescript
import { compilerService } from '@/lib/wasm-compiler'

await compilerService.init()
const result = await compilerService.compile(files, ['-o', 'output.asm'])
```

### `compilerService.init(): Promise<void>`

Spawns the compiler Web Worker and waits for it to signal `READY`. Safe to call multiple times.

### `compilerService.compile(files: FileType[], args: string[]): Promise<CompileResult>`

Sends files and compiler arguments to the worker and resolves when compilation completes.

```typescript
interface CompileResult {
  code: number                                  // exit code (0 = success)
  output: string                                // combined stdout/stderr
  outputFiles: { name: string; content: string }[]
}
```

### `compilerService.isReadyState(): boolean`

Returns `true` if the worker has initialised and is ready to accept jobs.

Convenience exports:

```typescript
import { initWasmCompiler, isWasmReady } from '@/lib/wasm-compiler'
```

---

## `RPCClient` — JSON-RPC HTTP Client

`src/lib/api.ts`

Singleton HTTP client for communicating with a ZENT node.

```typescript
import { getRPCClient } from '@/lib/api'
import { ChainType } from '@/constants'

const client = getRPCClient(ChainType.ZENT_TESTNET)
```

### `RPCClient.getClient(chainType?: ChainType): RPCClient`

Returns (or creates) the singleton `RPCClient` for the given chain.

### `client.rpcCall(method: string, params?: unknown[]): Promise<any>`

Generic JSON-RPC 1.0 call.

### `client.debugCall(fn: DebugCallType, params?: any[]): Promise<any>`

Calls `vmdebug` with the given sub-command. See `DebugCallType` enum for all values:
`attach | detach | clearbreakpoint | breakpoint | stop | go | step | up | getstack | getdata | evaluate`

### `client.signRawTransaction(hexString, params, privkeys, ishash): Promise<any>`

Signs a raw transaction hex using the node's `signrawtransaction` RPC.

### `client.sendRawTransaction(hextx: string): Promise<any>`

Broadcasts a signed raw transaction via `sendrawtransaction`.

### `client.contractCall(contractAddress: string, params: string): Promise<any>`

Calls a deployed contract without broadcasting a transaction (`contractcall`).

### `client.tryContract(hex: string): Promise<any>`

Simulates a contract transaction without broadcasting (`trycontract`).

---

## `DebugWebSocketClient` — WebSocket Debug Client

`src/lib/debugWebSocket.ts`

Maintains a persistent WebSocket connection to the ZENT node for real-time step debugging.

```typescript
import { getDebugWSClient } from '@/lib/debugWebSocket'
import { ChainType, DebugCallType } from '@/constants'

const ws = getDebugWSClient(ChainType.ZENT_TESTNET)
await ws.connect()
```

### `ws.connect(): Promise<void>`

Opens the WebSocket connection and authenticates. Idempotent.

### `ws.disconnect(): void`

Closes the connection and cleans up all pending requests.

### `ws.debugCall(fn: DebugCallType, params?: any[]): Promise<any>`

Sends a `vmdebug` RPC command and resolves with the response.

### `ws.onDebugEvent(listener: (event: any) => void): () => void`

Registers a listener for unsolicited `vmdebug.event` notifications (e.g. breakpoint hit). Returns an unsubscribe function.

### `ws.isReady(): boolean`

Returns `true` when connected and authenticated.

### `ws.getStatus(): { connected: boolean; authenticated: boolean; reconnectAttempts: number }`

Returns the current connection status.

Module-level helpers:

```typescript
import { getDebugWSClient, disconnectDebugWSClient, disconnectAllDebugWSClients } from '@/lib/debugWebSocket'
```

---

## `parseRawTx` — Raw Transaction Decoder

`src/lib/txdecode.ts`

Decodes a hex-encoded ZENT raw transaction into its constituent fields.

```typescript
import { parseRawTx } from '@/lib/txdecode'

const tx = parseRawTx(hexString)
```

Returns `DecodedTx`:

```typescript
interface DecodedTx {
  version: number
  txDef: any[]
  txIns: TxIn[]   // { prevHash, prevIndex, sigIndex, sequence }
  txOuts: TxOut[] // { tokenType, value, rights?, pkScript }
  lockTime?: number
  sigs: string[]
}
```

---

## IndexedDB File System Helpers

`src/lib/db.ts` + `src/lib/fs.ts`

The IDE stores all project files in IndexedDB via `lightning-fs`. These functions operate on a singleton `IndexedDBStorage` instance.

```typescript
import { initDB, saveFile, getFile, getAllFiles, deleteFile,
         createFolder, renameFile, deleteFolder, buildFileTree } from '@/lib/db'
```

| Function | Signature | Description |
|---|---|---|
| `initDB` | `() => Promise<void>` | Initialise the file system |
| `saveFile` | `(file: FileType) => Promise<void>` | Write a file (creates parent dirs) |
| `getFile` | `(path: string) => Promise<FileType>` | Read a file by path |
| `getAllFiles` | `() => Promise<FileType[]>` | Recursively list all files |
| `deleteFile` | `(path: string) => Promise<void>` | Remove a file |
| `createFolder` | `(path: string) => Promise<void>` | Create a directory (idempotent) |
| `renameFile` | `(oldPath, newPath) => Promise<void>` | Move / rename a file or directory |
| `deleteFolder` | `(path: string) => Promise<void>` | Recursively delete a directory |
| `buildFileTree` | `() => Promise<FileType[]>` | Build a nested tree structure |

---

## Debug Utilities

`src/lib/debugUtils.ts`

Helpers for interpreting raw hex data returned from the VM debugger.

### `reverseHexString(hexStr: string): string`

Reverses byte order (little-endian conversion).

### `processBasicType(hexValue: string, varType: string): string`

Converts a hex value to a decimal string for numeric types (`int`, `uint`, `long`, `ulong`, `char`, `uchar`, `short`, `ushort`).

### `processStructType(hexValue, typeName, debugInfo, chainType, client, isRawData?, varSize?, structure?): Promise<Record<string, { type: string; value: any }>>`

Expands a struct value by resolving each field from the debug type definitions. Recursively handles nested structs and pointer types.

### `processVariableValue(hexValue, varType, debugInfo, chainType, client, varSize, structure?): Promise<any>`

Main entry point. Dispatches to `processBasicType` or `processStructType` based on `varType`.

---

## Zustand State Stores

All stores live under `src/state/` and are consumed via React hooks.

### `useFileStore` — `src/state/useFile.ts`

| Member | Type | Description |
|---|---|---|
| `files` | `FileType[]` | All files loaded from IndexedDB |
| `isLoading` | `boolean` | Loading state |
| `expandedFolders` | `Set<string>` | Persisted open folders |
| `refreshFiles()` | `() => Promise<void>` | Reload files from IndexedDB |
| `addFile(file)` | action | Add a file (no-op if duplicate) |
| `updateFile(file)` | action | Update file by id |
| `removeFile(fileId)` | action | Remove file by id |
| `toggleFolder(id)` | action | Expand/collapse folder |

### `useCompilerStore` — `src/state/useCompiler.ts`

| Member | Type | Description |
|---|---|---|
| `compiledResultMap` | `Map<string, CompiledResult>` | Latest compile result per file |
| `setCompiledResult(fileName, result)` | action | Store a compile result |
| `removeCompiledResult(fileName)` | action | Remove a result |
| `clearAll()` | action | Clear all results |

### `useConsoleStore` — `src/state/useConsole.ts`

```typescript
import { useConsoleStore, LogLevel } from '@/state/useConsole'

const { addLog } = useConsoleStore()
addLog('Compilation started', LogLevel.INFO)
addLog('Warning found',       LogLevel.WARN)
addLog('Build failed',        LogLevel.ERROR)
addLog('Deploy success',      LogLevel.SUCCESS)
```

| Member | Type | Description |
|---|---|---|
| `logs` | `LogEntry[]` | All log entries |
| `searchTerm` | `string` | Active filter term |
| `autoScroll` | `boolean` | Auto-scroll to latest log |
| `addLog(message, level?)` | action | Append a log entry |
| `clearLogs()` | action | Remove all logs |
| `setSearchTerm(term)` | action | Update the search filter |
| `setAutoScroll(enabled)` | action | Toggle auto-scroll |
| `getFilteredLogs()` | `() => LogEntry[]` | Logs matching `searchTerm` |

### `useWalletStore` — `src/state/useWallet.ts`

| Member | Type | Description |
|---|---|---|
| `isExtensionAvailable` | `boolean` | Whether `window.zent` is present |
| `isConnected` | `boolean` | Whether accounts are connected |
| `accounts` | `string[]` | Connected account addresses |
| `currentAccount` | `string \| null` | Active account |
| `network` | `ZentNetwork \| null` | Current network |
| `init()` | `async` | Detect extension and sync state |
| `connect()` | `async` | Request account access |
| `disconnect()` | `async` | Disconnect wallet |
| `switchNetwork(chainId)` | `async` | Switch to a different chain |
| `getCurrentAccountUtxos(value?)` | `async` | Fetch UTXOs, optionally filtered by min value |
| `signTransaction(rawTxHex)` | `async → string` | Sign a raw transaction |
| `sendTransaction(signedHex)` | `async → string` | Broadcast a signed transaction, returns txHash |
| `tryContract(rawTxHex)` | `async` | Simulate a contract transaction |
| `contractCall(address, params)` | `async` | Call a contract read-only |

### `useSettingsStore` — `src/state/useSettings.ts`

Persisted to `localStorage` under the key `settings`.

| Member | Type | Description |
|---|---|---|
| `locale` | `string` | UI locale (`'en'`, `'zh'`, …) |
| `networkType` | `NetworkType` | `mainnet` or `testnet` |
| `chainType` | `ChainType` | `ZENT_TESTNET` or `ZENT_LOCAL` |
| `setLocale(locale)` | action | |
| `setNetworkType(type)` | action | |
| `setChainType(type)` | action | |

### `useDeployStore` — `src/state/useDeploy.ts`

| Member | Type | Description |
|---|---|---|
| `selectedFileId` | `string \| null` | File selected for deployment |
| `setSelectedFileId(id)` | action | |
