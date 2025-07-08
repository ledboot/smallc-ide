# Asm - SmallC 汇编器工具类

`Asm` 是一个 TypeScript 实现的 SmallC 汇编器，基于原始的 PHP 版本 `asmlib.php` 开发。它能够将 SmallC ASM 代码编译成字节码，支持调试信息、变量替换、操作码转换等完整功能。

## 主要特性

- ✅ **完整的ASM编译**: 支持所有SmallC操作码和语法
- ✅ **调试信息处理**: 保持源码级调试信息
- ✅ **变量替换**: 支持 `\variableName,` 语法
- ✅ **ABI函数支持**: 自动处理 `abi()` 和 `ABI()` 函数
- ✅ **字符串处理**: 自动转换字符串为十六进制
- ✅ **相对地址**: 支持 `.label` 相对跳转语法
- ✅ **语法验证**: 编译前语法检查
- ✅ **代码格式化**: 自动格式化ASM代码
- ✅ **跨平台**: 同时支持Node.js和浏览器环境

## 安装和使用

### 基本使用

```typescript
import Asm from './lib/asm';

// 编译ASM代码
const asmCode = `
define BODY .
MALLOC 0,336,
EVAL32 gi0,4,
STOP
`;

const result = Asm.assemble(asmCode);

if (result.success) {
  console.log('字节码:', result.bytecode);
  console.log('哈希:', result.hash);
  console.log('对象代码:', result.objectCode);
} else {
  console.error('编译错误:', result.error);
}
```

### 在React组件中使用

```typescript
import React, { useState } from 'react';
import Asm from '../lib/asm';

function CompilerComponent() {
  const [asmCode, setAsmCode] = useState('');
  const [result, setResult] = useState(null);

  const handleCompile = () => {
    const compilationResult = Asm.assemble(asmCode);
    setResult(compilationResult);
  };

  return (
    <div>
      <textarea 
        value={asmCode}
        onChange={(e) => setAsmCode(e.target.value)}
        placeholder="输入ASM代码..."
      />
      <button onClick={handleCompile}>编译</button>
      
      {result && (
        <div>
          {result.success ? (
            <div>
              <p>编译成功!</p>
              <p>哈希: {result.hash}</p>
              <p>字节码长度: {result.bytecode.length}</p>
            </div>
          ) : (
            <p>错误: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## API 文档

### Asm.assemble(code: string): AssemblyResult

编译ASM代码为字节码。

**参数:**
- `code`: 要编译的ASM源代码

**返回值:**
```typescript
interface AssemblyResult {
  bytecode: string;      // 编译后的字节码（十六进制）
  hash: string;          // RIPEMD160哈希值
  objectCode: string;    // 中间对象代码
  debugInfo: DebugInfo[]; // 调试信息数组
  success: boolean;      // 编译是否成功
  error?: string;        // 错误信息（如果失败）
}
```

### Asm.validateSyntax(code: string): ValidationResult

验证ASM代码语法。

**返回值:**
```typescript
interface ValidationResult {
  valid: boolean;     // 语法是否有效
  errors: string[];   // 错误信息列表
}
```

### Asm.formatCode(code: string): string

格式化ASM代码，添加适当的缩进。

### Asm.getSupportedOpcodes(): string[]

获取所有支持的操作码列表。

## 支持的操作码

| 操作码 | 映射 | 描述 |
|--------|------|------|
| EVAL8 | A | 8位求值 |
| EVAL16 | B | 16位求值 |
| EVAL32 | C | 32位求值 |
| EVAL64 | D | 64位求值 |
| EVAL256 | E | 256位求值 |
| IF | K | 条件跳转 |
| CALL | L | 函数调用 |
| MALLOC | R | 内存分配 |
| ALLOC | S | 栈分配 |
| RETURN | Y | 函数返回 |
| REVERT | X | 回滚交易 |
| ... | ... | ... |

完整的操作码列表可以通过 `Asm.getSupportedOpcodes()` 获取。

## ASM语法支持

### 1. 基本指令
```asm
EVAL32 gi0,4,
MALLOC 0,336,
IF ii0'8,4,
```

### 2. 标签定义
```asm
define BODY .
define __label123 .
```

### 3. 调试信息
```asm
;#{"code":"init","types":{},"vars":[]}
;#{"endcode":""}
;#{"srcline":42}
```

### 4. 变量替换
```asm
EVAL64 \variableName,
```

### 5. ABI函数
```asm
LOAD @ii0'40,abi("accountmgr::assetKinds"),
STORE ABI("contract::deploy"),data,
```

### 6. 字符串字面量
```asm
EVAL8 "hello",  ; 转换为十六进制
```

### 7. 相对地址
```asm
IF ii0'8,.123,  ; 跳转到行号123
```

## 错误处理

编译器会捕获并报告以下类型的错误：
- 语法错误（括号不匹配、引号不匹配等）
- 变量引用错误（未定义的变量）
- JSON格式错误（调试信息）

示例错误处理：
```typescript
const result = Asm.assemble(invalidCode);
if (!result.success) {
  console.error('编译失败:', result.error);
  // 处理错误...
}
```

## 与原始PHP版本的对比

| 功能 | PHP版本 | TypeScript版本 | 说明 |
|------|---------|----------------|------|
| 操作码转换 | ✅ | ✅ | 完全兼容 |
| 调试信息 | ✅ | ✅ | 完全兼容 |
| 变量替换 | ✅ | ✅ | 完全兼容 |
| ABI函数 | ✅ | ✅ | 完全兼容 |
| 字符串处理 | ✅ | ✅ | 完全兼容 |
| 相对地址 | ✅ | ✅ | 完全兼容 |
| 哈希算法 | RIPEMD160 | RIPEMD160* | *浏览器环境使用简化版本 |
| 环境支持 | 服务器端 | 全栈 | 支持浏览器和Node.js |

## 性能注意事项

- 大型ASM文件编译可能需要几秒钟
- 调试信息会增加内存使用
- 浏览器环境中的哈希计算使用简化算法

## 故障排除

### 常见问题

1. **编译失败 "Invalid variable"**
   - 检查变量名是否正确定义
   - 确保调试信息中包含变量定义

2. **语法验证失败**
   - 检查括号和引号是否匹配
   - 确保每行语法正确

3. **哈希值与PHP版本不同**
   - 浏览器环境使用简化哈希算法
   - Node.js环境应该产生相同结果

### 调试技巧

```typescript
// 启用详细日志
const result = Asm.assemble(code);
console.log('调试信息:', result.debugInfo);
console.log('对象代码:', result.objectCode);

// 分步验证
const validation = Asm.validateSyntax(code);
if (!validation.valid) {
  console.log('语法错误:', validation.errors);
}
```