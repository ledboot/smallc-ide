# Console Component — Usage Guide

## Quick Start

### Add logs from any component

```typescript
import { useConsoleStore } from '@/state/useConsole'

function YourComponent() {
  const { addLog } = useConsoleStore()

  addLog('Compilation started...', 'info')
  addLog('Warning found',          'warn')
  addLog('Compilation failed',     'error')
  addLog('Compilation succeeded!', 'success')
}
```

### Log levels

| Level | Color | Constant |
|---|---|---|
| `info` | Blue | `LogLevel.INFO` |
| `warn` | Yellow | `LogLevel.WARN` |
| `error` | Red | `LogLevel.ERROR` |
| `success` | Green | `LogLevel.SUCCESS` |

## Features

### 1. Search
Type in the search box to filter logs in real time. Matching text is highlighted.

### 2. Copy
Click **Copy** to write all currently visible logs to the clipboard (including timestamps and levels).

### 3. Clear
Click **Clear** to remove all log history.

### 4. Auto-scroll
- Enabled by default — new logs automatically scroll to the bottom.
- Toggleable — click the arrow icon to disable/enable.

## Integration Examples

### compile-panel.tsx

```typescript
import { useConsoleStore } from '@/state/useConsole'

const CompilePanel = () => {
  const { addLog } = useConsoleStore()

  const handleCompile = async () => {
    addLog('Starting compilation...', 'info')

    try {
      const result = await compilerService.compile(files, args)
      if (result.code === 0) {
        addLog(`Compilation succeeded: ${result.output}`, 'success')
      } else {
        addLog(`Compilation failed: ${result.output}`, 'error')
      }
    } catch (error) {
      addLog(`Compilation error: ${error.message}`, 'error')
    }
  }
}
```

### deploy-panel.tsx

```typescript
const handleDeploy = async () => {
  addLog('Deploying contract...', 'info')

  try {
    const txHash = await sendTransaction()
    addLog(`Deploy successful! TxHash: ${txHash}`, 'success')
  } catch (error) {
    addLog(`Deploy failed: ${error.message}`, 'error')
  }
}
```

## API

### `useConsoleStore()`

**Actions:**

| Method | Description |
|---|---|
| `addLog(message, level?)` | Append a log entry |
| `clearLogs()` | Remove all logs |
| `setSearchTerm(term)` | Set the active search filter |
| `setAutoScroll(enabled)` | Enable or disable auto-scroll |
| `getFilteredLogs()` | Returns logs matching the current search term |

**State:**

| Property | Type | Description |
|---|---|---|
| `logs` | `LogEntry[]` | All log entries |
| `searchTerm` | `string` | Current search filter |
| `autoScroll` | `boolean` | Auto-scroll state |
