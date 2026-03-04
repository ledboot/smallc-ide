# Debug Variable Processing Implementation

## Overview

实现了根据变量类型对 RPC `getdata` 返回值的正确处理逻辑。

使用原生的WebSocket库
1. 在attachDebugSession的时候建立websocket的连接，需要通过Authorization进行认证
2. 在后续的debug操作中，通过websocket发送指令，获取变量的值

## 实现的功能

### 1. 基础类型（非指针）

对于基础类型如 `int`, `long`, `char` 等：

- 将 websocket 返回的十六进制字符串进行**字节反转**（little-endian 转换）
- 转换为对应的数值类型

示例：

```typescript
// 输入: "0x0a000000" (int)
// 输出: "10"
```

### 2. 指针类型

对于指针类型（如 `*char`, `*int`, `*__coin__`）：

- **直接展示** websocket 返回的字符串，不做任何转换

示例：

```typescript
// 输入: "0x1234567890abcdef" (*char)
// 输出: "0x1234567890abcdef"
```

### 3. 自定义结构体类型

对于自定义类型（如 `__storedata__`, `__coin__`）：

- 在 `debugInfo` 的 `types` 字段中查找类型定义
- 验证 `__TYPE__` 为 `"struct"`
- 遍历结构体的每个字段：
  - 根据字段类型递归应用规则 1、2
- 返回 JSON 格式的结构化数据

示例：

```typescript
// 类型定义 (来自 storage.dbg):
{
  "__storedata__": {
    "__TYPE__": "struct",
    "len": {
      "loc": "0",
      "size": 4,
      "type": "int"
    },
    "data": {
      "loc": "4",
      "size": 8,
      "type": "*char"
    }
  }
}

// 处理结果:
{
  "len": "12",        // int - 反转并转换
  "data": "0xabcd..."  // *char - 直接显示
}
```

## 核心函数

### `reverseHexString(hexStr: string): string`

反转十六进制字符串的字节序（用于 little-endian 转换）

### `processBasicType(hexValue: string, varType: string): string`

处理基础类型：反转并转换为数值

### `processStructType(hexValue: string, typeName: string, debugInfo: any[], chainType: ChainType, client: DebugWebSocketClient,varSize: number,structData: string): Promise<{[key: string]: any}>`

处理结构体类型：

1. 在 debugInfo 中查找类型定义
2. 递归处理字段值

### `processVariableValue(hexValue: string, varType: string, debugInfo: any[], chainType: ChainType, client: DebugWebSocketClient,varSize: number,structData: string): Promise<string>`

主处理函数，根据类型分发到相应的处理逻辑
