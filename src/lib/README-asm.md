# Asm — SmallC Assembler

`Asm` is a TypeScript implementation of the SmallC assembler, ported from the original PHP `asmlib.php`. It compiles SmallC ASM source into bytecode and supports debug info, variable substitution, opcode translation and more.

## Features

- Full ASM compilation with all SmallC opcodes
- Source-level debug info preservation
- Variable substitution via `\variableName,` syntax
- `abi()` / `ABI()` function support
- String-to-hex conversion
- Relative address (`.label`) jump syntax
- Pre-compilation syntax validation
- Automatic code formatting
- Runs in both Node.js and browser environments

## Usage

### Basic

```typescript
import Asm from '@/lib/asm'

const asmCode = `
define BODY .
MALLOC 0,336,
EVAL32 gi0,4,
STOP
`

const result = Asm.assemble(asmCode)

if (result.success) {
  console.log('Bytecode:',    result.bytecode)
  console.log('Hash:',        result.hash)
  console.log('Object code:', result.objectCode)
} else {
  console.error('Error:', result.error)
}
```

### Inside a React component

```typescript
import { useState } from 'react'
import Asm from '@/lib/asm'

function CompilerComponent() {
  const [asmCode, setAsmCode] = useState('')
  const [result, setResult] = useState(null)

  const handleCompile = () => setResult(Asm.assemble(asmCode))

  return (
    <div>
      <textarea value={asmCode} onChange={e => setAsmCode(e.target.value)} />
      <button onClick={handleCompile}>Compile</button>
      {result && (
        result.success
          ? <p>Hash: {result.hash}</p>
          : <p>Error: {result.error}</p>
      )}
    </div>
  )
}
```

## API

### `Asm.assemble(code: string): AssemblyResult`

Compiles ASM source into bytecode.

```typescript
interface AssemblyResult {
  bytecode: string   // hex-encoded bytecode
  hash: string       // RIPEMD160 hash of bytecode
  objectCode: string // intermediate object code
  debugInfo: string  // JSON-serialized debug info array
  success: boolean
  error?: string
}
```

### `Asm.validateSyntax(code: string): { valid: boolean; errors: string[] }`

Validates syntax before compilation. Checks for unmatched quotes, parentheses and invalid variable syntax.

### `Asm.formatCode(code: string): string`

Auto-indents ASM source. `define` directives and labels are left-aligned; instructions are indented with two spaces.

### `Asm.getSupportedOpcodes(): string[]`

Returns the complete list of supported opcodes.

## Supported Opcodes

| Opcode | Byte | Description |
|---|---|---|
| `EVAL8` | `A` | 8-bit evaluate |
| `EVAL16` | `B` | 16-bit evaluate |
| `EVAL32` | `C` | 32-bit evaluate |
| `EVAL64` | `D` | 64-bit evaluate |
| `EVAL256` | `E` | 256-bit evaluate |
| `IF` | `K` | Conditional jump |
| `CALL` | `L` | Function call |
| `EXEC` | `M` | Execute |
| `LOAD` | `N` | Load |
| `STORE` | `O` | Store |
| `MALLOC` | `R` | Allocate heap memory |
| `ALLOC` | `S` | Stack allocation |
| `RETURN` | `Y` | Return from function |
| `REVERT` | `X` | Revert transaction |
| `STOP` | `z` | Halt execution |
| … | … | See `Asm.getSupportedOpcodes()` for full list |

## ASM Syntax

### Instructions

```asm
EVAL32 gi0,4,
MALLOC 0,336,
IF ii0'8,4,
```

### Label definitions

```asm
define BODY .
define __label123 .
```

### Debug info (embedded comments)

```asm
;#{"code":"init","types":{},"vars":[]}
;#{"endcode":""}
;#{"srcline":42}
```

### Variable substitution

```asm
EVAL64 \variableName,
```

### ABI functions

```asm
LOAD  @ii0'40,abi("accountmgr::assetKinds"),
STORE ABI("contract::deploy"),data,
```

### String literals

```asm
EVAL8 "hello",   ; converted to hex automatically
```

### Relative addresses

```asm
IF ii0'8,.123,   ; jump to line 123
```

## Error Handling

The assembler catches and reports:

- Syntax errors (unmatched quotes or parentheses)
- Undefined variable references
- Malformed debug-info JSON

```typescript
const result = Asm.assemble(code)
if (!result.success) {
  console.error('Assembly failed:', result.error)
}
```

## Debugging Tips

```typescript
// Inspect intermediate output
const result = Asm.assemble(code)
console.log('Debug info:',  result.debugInfo)
console.log('Object code:', result.objectCode)

// Validate before assembling
const { valid, errors } = Asm.validateSyntax(code)
if (!valid) console.log('Syntax errors:', errors)
```
