/**
 * 解析比特币风格原始交易（hex字符串）
 * 返回主要字段对象
 */

export interface TxIn {
  prevHash: string;
  prevIndex: number;
  sigIndex: number;
  sequence: number;
}

export interface TxOut {
  tokenType: number;
  value: string;
  rights?: string;
  pkScript: string;
}

export interface DecodedTx {
  version: number;
  txDef: any[];
  txIns: TxIn[];
  txOuts: TxOut[];
  lockTime?: number;
  sigs: string[];
}

function readInt32(hex: string, offset: number): [number, number] {
  // 取4字节，低字节在前
  const b0 = parseInt(hex.slice(offset, offset + 2), 16);
  const b1 = parseInt(hex.slice(offset + 2, offset + 4), 16);
  const b2 = parseInt(hex.slice(offset + 4, offset + 6), 16);
  const b3 = parseInt(hex.slice(offset + 6, offset + 8), 16);
  let val = b0 + (b1 << 8) + (b2 << 16) + (b3 << 24);
  // 处理负数
  if (val & 0x80000000) val = val | (~0xFFFFFFFF);
  return [val, offset + 8];
}

function readUInt64LE(hex: string, offset: number): [string, number] {
  // 返回字符串，避免大数精度丢失
  const low = parseInt(hex.slice(offset, offset + 8), 16);
  const high = parseInt(hex.slice(offset + 8, offset + 16), 16);
  const val = BigInt('0x' + hex.slice(offset, offset + 16)).toString();
  return [val, offset + 16];
}

function readVarInt(hex: string, offset: number): [number, number] {
  const first = parseInt(hex.slice(offset, offset + 2), 16);
  if (first < 0xfd) return [first, offset + 2];
  if (first === 0xfd) return [parseInt(hex.slice(offset + 2, offset + 6), 16), offset + 6];
  if (first === 0xfe) return [parseInt(hex.slice(offset + 2, offset + 10), 16), offset + 10];
  if (first === 0xff) throw new Error('VarInt 0xff not supported');
  throw new Error('Invalid VarInt');
}

function hashreverse(hex: string): string {
  return hex.match(/.{2}/g)!.reverse().join('');
}

export function parseRawTx(hex: string): DecodedTx {
  hex = hex.toLocaleLowerCase()
  let offset = 0;
  // 1. Version
  const [version, off1] = readInt32(hex, offset);
  offset = off1;
  // 2. TxDef
  const txDef: any[] = [];
  if ((version & 0x20) === 0) {
    const [txDefCount, off2] = readVarInt(hex, offset);
    offset = off2;
    for (let i = 0; i < txDefCount; i++) {
      // 这里略过，通常为0
    }
  }
  // 3. TxIn
  const [txInCount, off3] = readVarInt(hex, offset);
  offset = off3;
  const txIns: TxIn[] = [];
  for (let i = 0; i < txInCount; i++) {
    const prevHash = hashreverse(hex.slice(offset, offset + 64));
    offset += 64;
    const [prevIndex, off4] = readInt32(hex, offset);
    offset = off4;
    const [sigIndex, off5] = readInt32(hex, offset);
    offset = off5;
    const [sequence, off6] = readInt32(hex, offset);
    offset = off6;
    txIns.push({ prevHash, prevIndex, sigIndex, sequence });
  }
  // 4. TxOut
  const [txOutCount, off7] = readVarInt(hex, offset);
  offset = off7;
  const txOuts: TxOut[] = [];
  for (let i = 0; i < txOutCount; i++) {
    const [tokenType, off8] = readVarInt(hex, offset);
    offset = off8;
    let value = '';
    let rights: string | undefined = undefined;
    if ((tokenType & 1) === 1) {
      // hash类型
      value = hashreverse(hex.slice(offset, offset + 64));
      offset += 64;
    } else {
      // int64类型
      const [val, off9] = readUInt64LE(hex, offset);
      value = val;
      offset = off9;
    }
    if ((tokenType & 2) !== 0) {
      rights = hashreverse(hex.slice(offset, offset + 64));
      offset += 64;
    }
    const [pkScriptLen, off10] = readVarInt(hex, offset);
    offset = off10;
    const pkScript = hex.slice(offset, offset + pkScriptLen * 2);
    offset += pkScriptLen * 2;
    txOuts.push({ tokenType, value, rights, pkScript });
  }
  // 5. LockTime
  let lockTime: number | undefined = undefined;
  if ((version & 0x10) === 0) {
    const [lt, off11] = readInt32(hex, offset);
    lockTime = lt;
    offset = off11;
  }
  // 6. SignatureScripts
  const [sigCount, off12] = readVarInt(hex, offset);
  offset = off12;
  const sigs: string[] = [];
  for (let i = 0; i < sigCount; i++) {
    const [sigLen, off13] = readVarInt(hex, offset);
    offset = off13;
    const sig = hex.slice(offset, offset + sigLen * 2);
    offset += sigLen * 2;
    sigs.push(sig);
  }
  return { version, txDef, txIns, txOuts, lockTime, sigs };
} 