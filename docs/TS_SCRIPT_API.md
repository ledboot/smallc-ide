# TS Script Runtime API

This document describes the runtime capabilities available when executing a contract TypeScript script inside the IDE.

## 1. Entry-point Convention

- Your function must be `export`ed and will be called by the IDE using its exact name (e.g. `setTotal`).
- If your function uses `await`, it must be declared `async`.

Example:

```ts
export async function setTotal() {
  // your logic
  return 'raw_tx_hex'
}
```

## 2. `walletApi` (globally injected)

The runner injects a global `walletApi` object:

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
  ): Promise<{ id: string; error: any; result: any }>
  contractCall(
    contractAddress: string,
    params: string
  ): Promise<{ id: string; error: any; result: any }>
}
```

Notes:

- `getCurrentAccountUtxos(value?)` operates on the currently connected account only.
- When `value` is provided, at most one UTXO satisfying `utxo.value >= value` is returned (`[]` or `[utxo]`).

## 3. Built-in Utilities (no import required)

The script runtime automatically injects `BUNDLED_UTILS_CODE`. Available utilities include:

| Utility | Description |
|---|---|
| `MsgT`, `TinDef`, `ToutDef` | Transaction builder classes |
| `Address.toPkScript(address)` | Convert an address to its pkScript |
| `rev32`, `rev64` | 32-bit / 64-bit byte-order reversal |
| `bytesToHex2`, `hashReverse`, `hexToBytes` | Hex encoding helpers |
| `Reader`, `Packer`, `Base58` | Low-level encoding utilities |

Example:

```ts
const methodHex = '6aff4f7b'
const revMethodHex = rev32(methodHex)

const msg = new MsgT()
msg.version = 0x11

const utxos = await walletApi.getCurrentAccountUtxos(1200n)
if (utxos.length === 0) throw new Error('No available UTXO')

const rawTxHex = bytesToHex2(msg.encode(0))
return rawTxHex
```

## 4. Console Output

Use `console.log`, `console.info`, `console.warn` and `console.error` directly. All output is captured and displayed in the IDE console panel.

## 5. Available `require` Modules

Only the following modules are supported:

| Module |
|---|
| `@noble/hashes/sha2` (or `@noble/hashes/sha2.js`) |
| `big-integer` |

Any other module will throw:
`Module 'xxx' is not available in the contract runner environment.`

## 6. Return Value

- Returning a `rawTxHex` string is recommended so the IDE can take over the signing and broadcasting flow.
- If you call `signTransaction` / `sendTransaction` yourself, make sure your logic does not submit the transaction twice.
