# TS Script Runtime API

本文档用于说明在 IDE 中执行合约 TS 脚本时，可直接调用的运行时能力。

## 1. 执行入口约定

- 你的方法必须 `export`，并由 IDE 按方法名调用（例如 `setTotal`）。
- 如果方法内使用 `await`，必须写成 `async` 方法。

示例：

```ts
export async function setTotal() {
  // your logic
  return 'raw_tx_hex'
}
```

## 2. walletApi（可直接调用）

执行器会注入全局对象 `walletApi`：

```ts
declare const walletApi: {
  connect(): Promise<string[]>
  getCurrentAccount(): Promise<string | null>
  getNetwork(): Promise<any>
  getCurrentAccountUtxos(value?: number | bigint): Promise<any[]>
  signTransaction(rawTxHex: string): Promise<string>
  sendTransaction(signedHex: string): Promise<string>
  tryContract(
    rawTxHex: string
  ): Promise<{id: string; error: any; result: any}>
  contractCall(
    contractAddress: string,
    params: string
  ): Promise<{id: string; error: any; result: any}>
}
```

说明：

- `getCurrentAccountUtxos(value?)` 仅针对当前已连接账户。
- 当 `value` 有值时，只返回一条满足 `utxo.value >= value` 的记录（`[]` 或 `[utxo]`）。

## 3. 内置工具（无需 import）

脚本运行时会自动注入 `BUNDLED_UTILS_CODE`，常用能力包括：

- 交易结构类：`MsgT`、`TinDef`、`ToutDef`
- 地址工具：`Address.toPkScript(address)`
- 编码工具：`rev32`、`rev64`、`bytesToHex2`、`hashReverse`、`hexToBytes`
- 底层工具类：`Reader`、`Packer`、`Base58`

示例：

```ts
const methodHex = '6aff4f7b'
const revMethodHex = rev32(methodHex)

const msg = new MsgT()
msg.version = 0x11

const utxos = await walletApi.getCurrentAccountUtxos(1200n)
if (utxos.length === 0) throw new Error('No available utxo')

const rawTxHex = bytesToHex2(msg.encode(0))
return rawTxHex
```

## 4. console 输出

- 可以直接使用 `console.log/info/warn/error`。
- 输出会被 IDE 控制台面板捕获并展示。

## 5. require 可用模块

仅支持以下模块：

- `@noble/hashes/sha2`（或 `@noble/hashes/sha2.js`）
- `big-integer`

其他模块会抛错：`Module 'xxx' is not available in the contract runner environment.`

## 6. 返回值建议

- 推荐返回 `rawTxHex`（字符串），便于 IDE 后续签名/广播流程接管。
- 若你自行调用签名/广播方法，请确保业务流程不会重复提交交易。

