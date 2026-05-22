# ZENT SmallC IDE — Contract Script Runner API Reference

This document provides a comprehensive technical reference for the script runner environment within the SmallC IDE. Developers use typescript/javascript runner scripts to construct, sign, simulate, and broadcast transactions that interact with deployed SmallC smart contracts on the ZENT network.

The runtime script environment consists of two core layers:
1. **`walletApi`**: The global, injected interface bridging the contract script and the browser extension wallet (ZENT Wallet).
2. **`bundledUtils`**: A robust library of cryptographical, encoding, binary packing/reading, and transaction assembly utilities prepended and available in the execution scope.



## 1. Injected Wallet API (`walletApi`)

**Source Reference**: [contractRunner.ts](../src/utils/contractRunner.ts)

The script execution engine dynamically injects a global `walletApi` object into the runner context. This object routes directly to the active browser extension wallet (`window.zent`) managed by the IDE's state container (`useWalletStore`).

### Interface Definition
```typescript
interface RunnerWalletApi {
  connect(): Promise<string[]>
  getCurrentAccount(): Promise<string | null>
  getNetwork(): Promise<any>
  getCurrentAccountUtxos(value?: number | bigint): Promise<any[]>
  signTransaction(rawTxHex: string): Promise<string>
  sendTransaction(signedHex: string): Promise<string>
  tryContract(rawTxHex: string): Promise<{id: string; error: any; result: any}>
  contractCall(
    contractAddress: string,
    params: string
  ): Promise<{id: string; error: any; result: any}>
}
```

### API Method Details

#### 1. `connect(): Promise<string[]>`
*   **Description**: Prompts the user to connect their ZENT browser wallet extension to the IDE.
*   **Returns**: Resolves to an array of connected wallet addresses.
*   **Usage**:
    ```typescript
    const accounts = await walletApi.connect();
    console.log("Connected accounts:", accounts);
    ```

#### 2. `getCurrentAccount(): Promise<string | null>`
*   **Description**: Resolves the wallet's currently selected active address.
*   **Returns**: The active address string, or `null` if the wallet is locked or disconnected.
*   **Usage**:
    ```typescript
    const activeAddress = await walletApi.getCurrentAccount();
    if (!activeAddress) throw new Error("Please connect your wallet!");
    ```

#### 3. `getNetwork(): Promise<any>`
*   **Description**: Resolves metadata about the currently connected ZENT chain (e.g. Testnet, Local Node).
*   **Returns**: An object representing the active network configurations.

#### 4. `getCurrentAccountUtxos(value?: number | bigint): Promise<any[]>`
*   **Description**: Retrieves spendable Unspent Transaction Outputs (UTXOs) belonging to the active account.
*   **Parameters**:
    *   `value` (Optional): A minimum required amount of ZENT tokens.
*   **Behavior**:
    *   If `value` is omitted, resolves to the complete list of spendable UTXOs.
    *   If `value` is specified, the method returns a list containing at most one UTXO whose balance satisfies `utxo.value >= value`.
*   **Usage**:
    ```typescript
    // Fetch a single UTXO containing at least 50,000,000 units (0.5 ZENT)
    const utxos = await walletApi.getCurrentAccountUtxos(50000000n);
    if (utxos.length === 0) {
      throw new Error("No single UTXO is large enough to cover the fee.");
    }
    const targetUtxo = utxos[0];
    ```

#### 5. `signTransaction(rawTxHex: string): Promise<string>`
*   **Description**: Opens a wallet extension window prompting the user to sign a compiled raw transaction.
*   **Parameters**:
    *   `rawTxHex`: The unsigned transaction payload represented as a hexadecimal string.
*   **Returns**: A promise resolving to the fully signed raw transaction hex string.
*   **Usage**:
    ```typescript
    const signedTx = await walletApi.signTransaction(unsignedTxHex);
    ```

#### 6. `sendTransaction(signedHex: string): Promise<string>`
*   **Description**: Broadcasts a signed raw transaction hex string directly onto the ZENT node network.
*   **Parameters**:
    *   `signedHex`: The signed raw transaction hex.
*   **Returns**: Resolves to the transaction ID/hash string on success.
*   **Usage**:
    ```typescript
    const txid = await walletApi.sendTransaction(signedTxHex);
    console.log("Transaction successfully broadcast. TxID:", txid);
    ```

#### 7. `tryContract(rawTxHex: string): Promise<{id: string; error: any; result: any}>`
*   **Description**: Simulates/evaluates a raw transaction containing contract invocations without broadcasting it to the block chain. This is extremely useful for dry-running state transitions or debugging bytecode execution failures.
*   **Parameters**:
    *   `rawTxHex`: The transaction hex to simulate.
*   **Returns**:
    *   `id`: Simulating Tx ID identifier.
    *   `error`: Failure details (if the execution reverted or threw a VM error).
    *   `result`: Raw return hex value or receipt from the contract.
*   **Usage**:
    ```typescript
    const simulation = await walletApi.tryContract(unsignedTxHex);
    if (simulation.error) {
      console.error("Simulation failed:", simulation.error);
    } else {
      console.log("Resulting VM state output:", simulation.result);
    }
    ```

#### 8. `contractCall(contractAddress: string, params: string): Promise<{id: string; error: any; result: any}>`
*   **Description**: Directly invokes a read-only method on a deployed contract without constructing or signing a full blockchain transaction. Useful for querying contract balances, constants, and getter variables.
*   **Parameters**:
    *   `contractAddress`: The deployed contract address.
    *   `params`: The hex-encoded contract call parameters (method selector prefix + arguments).
*   **Returns**:
    *   `id`: Invocation identifier.
    *   `error`: Failure details if the getter failed.
    *   `result`: Hex-encoded return values.
*   **Usage**:
    ```typescript
    // Call contract getter with hex-encoded method selector
    const response = await walletApi.contractCall(contractAddress, "c4a30e81");
    console.log("Returned hex value:", response.result);
    ```



## 2. Bundled Script Utilities (`bundledUtils.ts`)

**File Path**: [bundledUtils.ts](../src/utils/bundledUtils.ts)

At compile time, the IDE prepends the `BUNDLED_UTILS_CODE` string to your script, making these classes and utilities available directly in the script execution scope without requiring standard imports.

### 2.1 Hex & Byte Conversions
Small-C operates with binary payloads and hexadecimal representations. These low-level functions simplify parsing and encoding.

*   `nib(charCode: number): number`
    Converts a single hex character code into its corresponding nibble value (0 - 15).
*   `hexToBytes(hex: string): Uint8Array`
    Converts a hex string (e.g. `"0x1a2b"` or `"1a2b"`) into a `Uint8Array`.
*   `bytesToHex(bytes: Uint8Array | number[]): string`
    Converts a byte array or `Uint8Array` to a hexadecimal string.
*   `bytesToHex2(bytes: Uint8Array): string`
    Alternative optimized hex string generation from a `Uint8Array`.
*   `bytesToString(bytes: Uint8Array): string`
    Decodes a byte array into a standard ASCII string.
*   `bin2hex(str: string): string`
    Parses a binary string of `1`s and `0`s and converts it to a hex string.
*   `padLeft(str: string, bits: number): string`
    Left-pads a binary/hex string with leading zeroes to meet the bit alignment.

### 2.2 Little-Endian Endianness Reversals
Smart contract selectors, numbers, and hashes are represented in Little-Endian byte-order internally. These functions reverse byte order.

*   `hashReverse(h: string): string`
    Reverses the byte-order of a 64-character (32-byte) hex hash string.
*   `rev16(hex: string): string`
    Reverses the byte-order of a 16-bit hex number (4 hex characters).
*   `rev32(hex: string): string`
    Reverses the byte-order of a 32-bit hex number (8 hex characters). Usually applied to method selector hashes.
*   `rev64(hex: string): string`
    Reverses the byte-order of a 64-bit hex number (16 hex characters). Used for standard integers.

### 2.3 Address Management
Handles cryptographic ZENT Base58Check address calculations.

#### `Address` Class
*   `static decodeString(address: string): Uint8Array`
    Decodes a Base58Check address string, verifies the checksum (double SHA-256), and returns the raw `[version (1 byte) + hash160 (20 bytes)]` byte array. Throws an error on checksum mismatch.
*   `static toPkScript(address: string): string`
    Converts a Base58Check address into the contract-compatible raw Hexadecimal Public Key Script (`pkScript`). It decodes the address, detects the address type version, appends the network action code (`0x41` for standard, `0x43` for contracts, `0x42` for multisig), and appends padding.

```typescript
// Example: Create pkScript from Base58 address
const pkScript = Address.toPkScript("zT1234567890abcdef...");
```



### 2.4 Low-Level Data Marshalling (Binary Serialization)

#### `Packer` Class
The `Packer` class is used to serialize transaction and contract data into binary formats (little-endian byte streams).

##### Instance Methods:
*   `Bytes(): Uint8Array`: Returns the packed byte stream as a `Uint8Array`.
*   `PackC(c: number): void`: Packs a single 8-bit byte/character.
*   `PackV(v: number): void`: Packs a 32-bit integer in little-endian format (4 bytes).
*   `PackP(v: bigint | number): void`: Packs a 64-bit integer in little-endian format (8 bytes).
*   `PackH(v: string): void`: Packs the first byte represented by a 2-character hex string.
*   `PackCs(c: Uint8Array | number[]): void`: Packs an array or stream of 8-bit bytes.
*   `PackVs(v: number[]): void`: Packs an array of 32-bit integers.
*   `PackHs(v: string): void`: Packs a full hex string as binary bytes.
*   `WriteVarInt(val: number | bigint): void`: Packs a variable-length integer (VarInt) compatible with ZENT serialization.
*   `Merge(val: Uint8Array | number[]): void`: Concatenates external raw byte arrays into the packer.

##### Basic Serialization Example:
```typescript
const packer = new Packer();
packer.PackC(0x11);                  // Pack version 17
packer.PackV(100);                   // Pack 32-bit 100
packer.PackHs("aabbcc");             // Pack hex string bytes
const binaryPayload = packer.Bytes();
```

#### `Reader` Class
The `Reader` class provides an interface for parsing byte streams generated during transaction serialization.

##### Instance Methods:
*   `SetBytes(s: Uint8Array): void`: Populates the reader with a byte stream and resets the pointer.
*   `StrToByte(s: string): void`: Parses a hex string to bytes and populates the reader.
*   `EOF(): boolean`: Returns `true` if the reader pointer has reached the end of the byte stream.
*   `read(n: number): Uint8Array`: Reads the next `n` bytes.
*   `readInt32(): number`: Reads a little-endian 32-bit signed integer.
*   `readInt64(): bigint`: Reads a little-endian 64-bit unsigned integer (bigint).
*   `readVarInt(): number | bigint`: Reads a ZENT-encoded variable-length integer.
*   `readScript(): string`: Reads a script array (prefixed with VarInt length) and returns its hex representation.
*   `readText(): string`: Reads a text string (prefixed with VarInt length).
*   `readHash(): string`: Reads a standard 32-byte cryptographic hash string.
*   `readOutPoint(): { hash: string, index: number }`: Reads a transaction input OutPoint.
*   `readBH()`: Parses a block header structure (`{ Version, PrevBlock, MerkleRoot, Timestamp, ContractExec, Nonce }`).



### 2.5 ZENT Transaction Assembly (`MsgT`)

The `MsgT` class is the central tool used to parse, modify, sign, and build ZENT transactions.

#### Transaction Elements
A ZENT transaction consists of:
- `version` (`number`): The transaction version (standard: `0x11`).
- `txDef` (`any[]`): Array of asset metadata and geographic polygon/border/right definitions.
- `tIn` (`TinDef[]`): Array of Transaction Inputs pointing to unspent UTXOs.
- `tOut` (`ToutDef[]`): Array of Transaction Outputs routing assets and payloads.
- `signatureScripts` (`string[]`): Array of hex signature scripts unlocking inputs.
- `lockTime` (`number`): The block time or height at which the transaction is valid.

#### Transaction Data Structs:
- **`TinDef` (Transaction Input)**
  - `previousOutPoint`: `{ hash: string, index: number }` (references a spent UTXO).
  - `signatureIndex`: The index of the script in the `signatureScripts` array used to validate this input.
  - `sequence`: Standard sequence lock number (`0xffffffff`).
- **`ToutDef` (Transaction Output)**
  - `tokenType`: The asset type index (`0n` for native ZENT).
  - `value`: Amount to transfer in satoshis (`bigint`).
  - `pkScript`: The target destination public key script (`hex string`).
  - `rights`: Optional array of rights associated with the output.

#### Central `MsgT` Methods:
*   `rawDecode(rawHex: string): void`: Decodes a raw transaction hex string into the `MsgT` instance.
*   `encode(mode: number): Uint8Array`: Encodes the transaction to binary bytes. `mode` controls parts to omit/include (e.g. for signature validation or final broadcasting).
*   `hashval(): string`: Computes the transaction hash identifier (Double SHA-256 of the binary payload).
*   `outputOf(tokenType: bigint): bigint`: Aggregates and returns the sum of values for all outputs matching a specific `tokenType`.



## 3. End-to-End Usage Example

Below is a complete, real-world script workflow illustrating how to assemble a contract transaction, unlock a spent UTXO using the injected `walletApi` and `bundledUtils`, encode it, and simulate/broadcast it.

```typescript
export async function executeContractCall() {
  const contractAddress = "zT1234567890abcdef...";
  
  // 1. Get active user account
  const account = await walletApi.getCurrentAccount();
  if (!account) {
    throw new Error("Wallet not connected! Please connect in IDE.");
  }
  
  // 2. Query UTXO from user wallet (e.g., minimum 100,000 ZENT units for fee/transfer)
  const requiredFee = 20000n;
  const transferAmount = 100000n;
  const totalRequired = transferAmount + requiredFee;
  const utxos = await walletApi.getCurrentAccountUtxos(totalRequired);
  
  if (utxos.length === 0) {
    throw new Error("No UTXO found with sufficient funds!");
  }
  const inputUtxo = utxos[0];
  
  // 3. Assemble Transaction using MsgT
  const tx = new MsgT();
  tx.version = 0x11; // Standard ZENT Tx Version
  
  // 3a. Add Transaction Input (TinDef)
  const txIn = new TinDef();
  txIn.previousOutPoint = {
    hash: inputUtxo.txid, // Spent Transaction ID
    index: inputUtxo.vout, // Spent output index
  };
  txIn.signatureIndex = 0; // Reference the first signature
  txIn.sequence = 0xffffffff;
  tx.tIn.push(txIn);
  
  // 3b. Construct pkScript for Contract
  // Suppose we call a contract method: void increment(int val)
  // Selector hash is "c4a30e81"
  const methodSelector = rev32("c4a30e81"); // Little-Endian byte-order
  
  const contractPacker = new Packer();
  contractPacker.PackHs(methodSelector);
  contractPacker.PackP(10n); // Pack argument: 10
  
  // Script payload: Contract address code prefix + encoded arguments
  const opCodePrefix = getOps(contractAddress); // e.g. "43000000"
  const payloadHex = opCodePrefix + bytesToHex(contractPacker.Bytes());
  
  // 3c. Add Transaction Output (ToutDef) targeting the contract script
  const txOut = new ToutDef();
  txOut.tokenType = 0n; // Native asset
  txOut.value = transferAmount; // Send amount
  txOut.pkScript = payloadHex; // Execute bytecode script payload
  tx.tOut.push(txOut);
  
  // 3d. Add change output returning unspent change back to sender
  const changeAmount = BigInt(inputUtxo.value) - totalRequired;
  if (changeAmount > 0n) {
    const changeOut = new ToutDef();
    changeOut.tokenType = 0n;
    changeOut.value = changeAmount;
    changeOut.pkScript = Address.toPkScript(account); // Send change to sender address
    tx.tOut.push(changeOut);
  }
  
  // 4. Encode Transaction
  const rawTxHex = bytesToHex(tx.encode(0)); // Mode 0 = unsigned encoding
  console.log("Unsigned Raw Tx Hex:", rawTxHex);
  
  // 5. Sign raw transaction through ZENT Wallet extension
  const signedTxHex = await walletApi.signTransaction(rawTxHex);
  console.log("Signed Tx Hex:", signedTxHex);
  
  // 6. Dry run simulation
  const dryRun = await walletApi.tryContract(signedTxHex);
  if (dryRun.error) {
    console.error("Simulation failure:", dryRun.error);
    return;
  }
  console.log("Simulation success! DryRun ID:", dryRun.id);
  
  // 7. Broadcast transaction onto the blockchain network
  const txid = await walletApi.sendTransaction(signedTxHex);
  console.log("Transaction successfully broadcasted! TxID:", txid);
  
  return txid;
}
```
