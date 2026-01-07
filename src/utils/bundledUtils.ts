/**
 * AUTO-GENERATED FILE.
 * Contains bundled source code of utils.
 */

export const BUNDLED_UTILS_CODE = `
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';
import bigInt from 'big-integer';


// --- base58.ts ---

export interface Base58Interface {
  encode(input: number[] | Uint8Array): string;
  decode(input: string): number[];
}

export class Base58 implements Base58Interface {
  public readonly alphabet: string =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  public readonly validRegex: RegExp = /^[1-9A-HJ-NP-Za-km-z]+\$/;
  public readonly base: bigInt.BigInteger = bigInt(58);

  /**
   * Convert a byte array to a base58-encoded string.
   *
   * Written by Mike Hearn for BitcoinJ.
   *   Copyright (c) 2011 Google Inc.
   *
   * Ported to JavaScript by Stefan Thomas.
   */
  public encode(input: number[] | Uint8Array): string {
    const inputArray = Array.isArray(input) ? input : Array.from(input);
    const bi = bigInt.fromArray(inputArray, 256, false);
    const chars: string[] = [];

    let currentBi = bi;
    while (currentBi.compare(this.base) >= 0) {
      const mod = currentBi.mod(this.base);
      chars.unshift(this.alphabet[mod.toJSNumber()]!);
      currentBi = currentBi.subtract(mod).divide(this.base);
    }
    chars.unshift(this.alphabet[currentBi.toJSNumber()]!);

    // Convert leading zeros too.
    for (let i = 0; i < inputArray.length; i++) {
      if (inputArray[i] === 0x00) {
        chars.unshift(this.alphabet[0]!);
      } else {
        break;
      }
    }

    return chars.join('');
  }

  /**
   * Convert a base58-encoded string to a byte array.
   *
   * Written by Mike Hearn for BitcoinJ.
   *   Copyright (c) 2011 Google Inc.
   *
   * Ported to JavaScript by Stefan Thomas.
   */
  public decode(input: string): number[] {
    let bi = bigInt(0);
    let leadingZerosNum = 0;

    for (let i = input.length - 1; i >= 0; i--) {
      const char = input[i];
      if (char === undefined) continue;
      const alphaIndex = this.alphabet.indexOf(char);
      if (alphaIndex < 0) {
        throw new Error('Invalid character');
      }

      bi = bi.add(
        bigInt(alphaIndex).multiply(this.base.pow(input.length - 1 - i)),
      );

      // This counts leading zero bytes
      if (input[i] === '1') {
        leadingZerosNum++;
      } else {
        leadingZerosNum = 0;
      }
    }

    const bytes = bi.toArray(256).value;

    // Add leading zeros
    while (leadingZerosNum-- > 0) {
      bytes.unshift(0);
    }

    return bytes;
  }
}

// 创建单例实例
export const base58 = new Base58();

// 为了兼容性，也导出默认实例
// export default base58;


// --- packer.ts ---


export class Packer {
  private dest: number[] = [];

  Bytes(): Uint8Array {
    return new Uint8Array(this.dest);
  }

  PackC(c: number): void {
    this.dest.push(c);
  }

  PackV(v: number): void {
    this.dest.push(v & 0xff);
    this.dest.push((v >> 8) & 0xff);
    this.dest.push((v >> 16) & 0xff);
    this.dest.push((v >> 24) & 0xff);
  }

  PackP(v: bigint | number): void {
    if (typeof v !== 'bigint') {
      v = BigInt(Math.round(Number(v)));
    }

    this.dest.push(Number(v) & 0xff);
    this.dest.push(Number(v >> BigInt(8)) & 0xff);
    this.dest.push(Number(v >> BigInt(16)) & 0xff);
    this.dest.push(Number(v >> BigInt(24)) & 0xff);
    this.dest.push(Number(v >> BigInt(32)) & 0xff);
    this.dest.push(Number(v >> BigInt(40)) & 0xff);
    this.dest.push(Number(v >> BigInt(48)) & 0xff);
    this.dest.push(Number(v >> BigInt(56)) & 0xff);
  }

  PackH(v: string): void {
    // v is a hex string
    this.dest.push(((nib(v.charCodeAt(0)) << 4) | nib(v.charCodeAt(1))) & 0xff);
  }

  PackCs(c: Uint8Array | number[]): void {
    for (let i = 0; i < c.length; i++) {
      const byte = (c as any)[i];
      if (byte !== undefined) this.PackC(byte);
    }
  }

  PackVs(v: number[]): void {
    for (let i = 0; i < v.length; i++) {
      const val = v[i];
      if (val !== undefined) this.PackV(val);
    }
  }

  PackHs(v: string): void {
    // v is a hex string
    for (let i = 0; i < v.length; i += 2) {
      this.dest.push(
        ((nib(v.charCodeAt(i)) << 4) | nib(v.charCodeAt(i + 1))) & 0xff,
      );
    }
  }

  WriteVarInt(val: number | bigint): void {
    if (typeof val === 'bigint' && val <= BigInt(0xffffffff)) {
      val = Number(val);
    }

    if (typeof val === 'number') {
      if (val < 0xfd) {
        this.dest.push(val);
        return;
      }

      if (val <= 0xffff) {
        this.dest.push(0xfd);
        this.dest.push(val & 0xff);
        this.dest.push((val >> 8) & 0xff);
        return;
      }

      if (val <= 0xffffffff) {
        this.dest.push(0xfe);
        this.PackV(val);
        return;
      }
    }
    this.dest.push(0xff);
    this.PackP(val);
  }

  Merge(val: Uint8Array | number[]): void {
    this.dest = this.dest.concat(Array.from(val as any));
  }
}


// --- reader.ts ---


export class Reader {
  private src: Uint8Array = new Uint8Array(0);
  private pos = 0;
  private len = 0;

  EOF(): boolean {
    return this.pos >= this.len;
  }

  SetBytes(s: Uint8Array): void {
    this.src = s;
    this.pos = 0;
    this.len = s.length;
  }

  StrToByte(s: string): void {
    this.src = hexToBytes(s);
    this.pos = 0;
    this.len = this.src.length;
  }

  readBH(): {
    Version: number;
    PrevBlock: string;
    MerkleRoot: string;
    Timestamp: number;
    ContractExec: bigint;
    Nonce: number;
  } {
    const v = this.readInt32();
    const Prev = this.readHash();
    const Merkle = this.readHash();
    const Timestamp = this.readInt32();
    const ContractExec = this.readInt64();
    const Nonce = this.readInt32();
    return {
      Version: v,
      PrevBlock: Prev,
      MerkleRoot: Merkle,
      Timestamp,
      ContractExec,
      Nonce,
    };
  }

  read(n: number): Uint8Array {
    const remaining = Math.max(0, Math.min(n, this.len - this.pos));
    const out = this.src.subarray(this.pos, this.pos + remaining);
    this.pos += remaining;
    return out;
  }

  readInt32(): number {
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      if (this.pos >= this.len) return sum;
      const byte = this.src[this.pos++];
      if (byte !== undefined) sum += byte << (i * 8);
    }
    // signed 32-bit
    if (sum & 0x80000000) {
      sum = ~sum + 1;
      sum = -sum;
    }
    return sum;
  }

  readInt64(): bigint {
    // unsigned int64
    let sum = BigInt(0);
    for (let i = 0; i < 8; i++) {
      if (this.pos >= this.len) return sum;
      const byte = this.src[this.pos++];
      if (byte !== undefined) {
        const d = BigInt(byte) << BigInt(i * 8);
        sum += d;
      }
    }
    return sum;
  }

  readScript(): string {
    const count = this.readVarInt();
    if (!count) return '';
    return bytesToHex(this.read(Number(count)));
  }

  readText(): string {
    const count = Number(this.readVarInt());
    const t = this.read(count);
    let s = '';
    for (let i = 0; i < count; i++) {
      const byte = t[i];
      if (byte !== undefined) s += String.fromCharCode(byte);
    }
    return s;
  }

  readOutPoint(): {hash: string; index: number} {
    const h = this.readHash();
    const i = this.readInt32();
    return {hash: h, index: i};
  }

  readHash(): string {
    const t = this.read(32);
    return bytesToHex(t);
  }

  readVarInt(): number | bigint {
    const discriminant = this.src[this.pos];
    if (discriminant === undefined) return 0;

    if (discriminant < 0xfd) {
      this.pos++;
      return discriminant;
    }
    this.pos++;

    let sum = 0;
    const bs = 1 << (discriminant - 0xfc);

    for (let i = 0; i < Math.min(bs, 4); i++) {
      if (this.pos >= this.len) return sum;
      const byte = this.src[this.pos];
      if (byte !== undefined) sum = sum | ((byte << (i * 8)) & 0xffffffff);
      this.pos++;
    }

    if (bs > 4) {
      let big = BigInt(sum);
      for (let i = 4; i < bs; i++) {
        if (this.pos >= this.len) return big;
        const byte = this.src[this.pos];
        if (byte !== undefined) big = big | (BigInt(byte) << BigInt(i * 8));
        this.pos++;
      }
      return big;
    }
    return sum;
  }
  readIntDiscriminant(): number {
    return this.src[this.pos] ?? 0;
  }
}


// --- defs.ts ---






export class BorderDef {
  type: string;
  father: string;
  begin: VertexDef;
  end: VertexDef;
  constructor() {
    this.type = 'border';
    this.father = '';
    this.begin = new VertexDef();
    this.end = new VertexDef();
  }

  write0(b: BorderDef, w: Packer) {
    if (b.father.length > 0) {
      for (let i = 0; i < 32; i++) w.PackC(0);
    } else w.PackHs(hashReverse(b.father));
    w.Merge(b.begin.write());
    w.Merge(b.end.write());
  }

  read(r: Reader) {
    this.father = r.readHash();
    this.begin.read(r);
    this.end.read(r);
  }

  write() {
    const w = new Packer();
    w.PackC(1);
    this.write0(this, w);
    return w.Bytes();
  }

  hashval() {
    const w = new Packer();
    this.write0(this, w);
    const h = nobleSha256(w.Bytes());
    if (h[0] !== undefined) h[0] &= 0xfe;
    return hashReverse(bytesToHex(h));
  }

  data() {
    return {
      father: this.father,
      begin: this.begin.data(),
      end: this.end.data(),
    };
  }
}

export class PolygonDef {
  type: string;
  Loops: any;
  constructor() {
    this.type = 'polygon';
    this.Loops = [];
  }
  read(r: Reader) {
    for (let nloops = r.readVarInt(); nloops > 0; nloops--) {
      const loop = [];
      for (let borders = r.readVarInt(); borders > 0; borders--) {
        loop.push(r.readHash());
      }
      this.Loops.push(loop);
    }
  }
  write() {
    const w = new Packer();
    w.PackC(2);
    w.WriteVarInt(this.Loops.length);
    for (let i = 0; i < this.Loops.length; i++) {
      const loop = this.Loops[i];
      w.WriteVarInt(loop.length);
      for (let j = 0; j < loop.length; j++) w.PackHs(hashReverse(loop[j]));
    }
    return w.Bytes();
  }

  hashval() {
    const w = new Packer();

    for (let i = 0; i < this.Loops.length; i++) {
      const loop = this.Loops[i];
      for (let j = 0; j < loop.length; j++) w.PackHs(hashReverse(loop[j]));
    }

    const h = nobleSha256(w.Bytes());
    return hashReverse(bytesToHex(h));
  }

  data() {
    return {
      Loops: this.Loops,
    };
  }
}

export class VertexDef {
  type: string;
  lat: number;
  lng: number;
  alt: number;
  constructor() {
    this.type = 'vertex';
    this.lat = 0;
    this.lng = 0;
    this.alt = 0;
  }
  read(r: Reader) {
    this.lat = r.readInt32();
    this.lng = r.readInt32();
    this.alt = r.readInt32();
  }

  write() {
    const w = new Packer();
    w.PackV(this.lat);
    w.PackV(this.lng);
    w.PackV(this.alt);
    return w.Bytes();
  }

  hashval() {
    return hashReverse(bytesToHex(this.write()));
  }

  data() {
    return {
      lat: this.lat,
      lng: this.lng,
      alt: this.alt,
    };
  }
}

export class RightDef {
  type: string;
  father: string;
  desc: string;
  attrib: number;
  constructor() {
    this.type = 'right';
    this.father = '';
    this.desc = '';
    this.attrib = 0;
  }
  read(r: Reader) {
    this.father = r.readHash();
    const n = r.readVarInt();
    const s = r.read(Number(n));
    this.desc = bytesToString(s);
    this.attrib = r.read(1)[0] ?? 0;
  }
  write() {
    const w = new Packer();
    w.PackC(4);
    w.PackHs(hashReverse(this.father));
    w.WriteVarInt(this.desc.length);
    if (typeof this.desc === 'string') {
      const sp = this.desc.split('');
      for (let i = 0; i < sp.length; i++) {
        const char = sp[i];
        if (char !== undefined) sp[i] = String.fromCharCode(char.charCodeAt(0));
      }
      w.Merge(sp as any);
    } else w.Merge(this.desc);
    w.PackC(this.attrib);
    return w.Bytes();
  }

  hashval() {
    const w = new Packer();
    w.PackHs(hashReverse(this.father));
    if (typeof this.desc === 'string') {
      const sp = this.desc.split('');
      for (let i = 0; i < sp.length; i++) {
        const char = sp[i];
        if (char !== undefined) sp[i] = String.fromCharCode(char.charCodeAt(0));
      }
      w.Merge(sp as any);
    } else w.Merge(this.desc);
    w.PackC(this.attrib);

    const h = nobleSha256(w.Bytes());
    return hashReverse(bytesToHex(h));
  }

  data() {
    return {
      father: this.father,
      desc: this.desc,
      attrib: this.attrib,
    };
  }
}

export class RightSetDef {
  type: string;
  rights: string[];
  constructor() {
    this.type = 'rightset';
    this.rights = [];
  }
  data() {
    return {rights: this.rights};
  }
  read(r: Reader) {
    const n = r.readVarInt();
    for (let i = 0; i < n; i++) {
      this.rights.push(r.readHash());
    }
  }

  write() {
    this.rights.sort((a, b) => {
      for (let k = 0; k < 32; k++) {
        const ak = a[k];
        const bk = b[k];
        if (ak === undefined || bk === undefined) continue;
        if (ak < bk) return -1;
        if (ak > bk) return 1;
      }
      return 0;
    });

    const w = new Packer();
    w.WriteVarInt(this.rights.length);
    for (let i = 0; i < this.rights.length; i++) {
      const right = this.rights[i];
      if (right) w.PackHs(hashReverse(right));
    }
    return w.Bytes();
  }

  hashval() {
    this.rights.sort((a, b) => {
      for (let k = 0; k < 32; k++) {
        const ak = a[k];
        const bk = b[k];
        if (ak === undefined || bk === undefined) continue;
        if (ak < bk) return -1;
        if (ak > bk) return 1;
      }
      return 0;
    });

    const w = new Packer();
    for (let i = 0; i < this.rights.length; i++) {
      const right = this.rights[i];
      if (right) w.PackHs(hashReverse(right));
    }

    const h = nobleSha256(w.Bytes());
    return hashReverse(bytesToHex(h));
  }
}

export class SeparatorDef {
  type: string;
  constructor() {
    this.type = 'separator';
  }
  read() {}
  write() {
    return [0xfc];
  }
  data() {
    return {};
  }
}

export class TinDef {
  type: string;
  previousOutPoint: {
    hash: string;
    index: number;
  };
  signatureIndex: number;
  sequence: number;

  constructor() {
    this.type = 'tin';
    this.previousOutPoint = {
      hash: '',
      index: -1,
    };
    this.signatureIndex = -1;
    this.sequence = -1;
  }
  data() {
    return {
      previousOutPoint: this.previousOutPoint,
      signatureIndex: this.signatureIndex,
      sequence: this.sequence,
    };
  }
  read(r: Reader) {
    this.previousOutPoint = r.readOutPoint();
    this.previousOutPoint.hash = hashReverse(this.previousOutPoint.hash);
    this.signatureIndex = r.readInt32();
    this.sequence = r.readInt32();
  }
  write() {
    const w = new Packer();
    w.PackHs(hashReverse(this.previousOutPoint.hash));
    w.PackV(this.previousOutPoint.index);
    w.PackV(this.signatureIndex);
    w.PackV(this.sequence);
    return w.Bytes();
  }
  isSeparator() {
    return (
      this.previousOutPoint.hash ==
        '0000000000000000000000000000000000000000000000000000000000000000' &&
      this.previousOutPoint.index == 0 &&
      this.signatureIndex == 0 &&
      this.sequence == 0
    );
  }
}

export class ToutDef {
  type: string;
  tokenType: bigint;
  value: bigint;
  rights: string[];
  pkScript: string;

  constructor() {
    this.type = 'txout';
    this.tokenType = 0n;
    this.value = 0n;
    this.rights = [];
    this.pkScript = '';
  }
  data() {
    return {
      tokenType: this.tokenType,
      value: this.value,
      rights: this.rights,
      pkScript: this.pkScript,
    };
  }
  read(r: Reader) {
    const discriminant = r.readIntDiscriminant();

    this.tokenType = BigInt(r.readVarInt());

    if (discriminant >= 0xfd) {
      const bs = 1 << (discriminant - 0xfc);
      if (bs <= 4) {
        this.tokenType = this.tokenType & BigInt(0xffffffff);
      }
    }

    if (this.tokenType == BigInt(0xfc)) {
      r.readScript();
      return;
    }

    if ((this.tokenType & 1n) == 1n) {
      this.value = BigInt(hashReverse(r.readHash()));
    } else {
      this.value = BigInt(r.readInt64());
    }

    if ((this.tokenType & 2n) != 0n) {
      this.rights = [hashReverse(r.readHash())];
    }

    this.pkScript = r.readScript();
  }

  write() {
    const w = new Packer();

    w.WriteVarInt(this.tokenType);

    if (this.tokenType == BigInt(0xfc)) {
      w.WriteVarInt(0);
      return w.Bytes();
    }

    if ((this.tokenType & 1n) == 0n) w.PackP(this.value);
    else w.PackHs(hashReverse(this.value.toString(16).padStart(64, '0')));

    if ((this.tokenType & 2n) != 0n && this.rights[0])
      w.PackHs(hashReverse(this.rights[0]));
    w.WriteVarInt(this.pkScript.length / 2);
    w.PackHs(this.pkScript);

    return w.Bytes();
  }

  isSeparator() {
    return this.tokenType == BigInt(0xfc);
  }
}


// --- index.ts ---






// 辅助函数：将字符转换为半字节值
export function nib(charCode: number): number {
  if (charCode >= 48 && charCode <= 57) return charCode - 48; // 0-9
  if (charCode >= 97 && charCode <= 102) return charCode - 97 + 10; // a-f
  if (charCode >= 65 && charCode <= 70) return charCode - 65 + 10; // A-F
  return 0;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const len = clean.length;
  const out = new Uint8Array(Math.floor(len / 2));
  for (let i = 0, j = 0; i < len; i += 2, j++) {
    out[j] = (nib(clean.charCodeAt(i)) << 4) | nib(clean.charCodeAt(i + 1));
  }
  return out;
}

export function addressHexToString(bytes: Uint8Array, version: number): string {
  // Create a copy of the input bytes
  const hash = bytes.slice(0);

  // Add version at the beginning
  const versionedHash = new Uint8Array([version, ...hash]);

  // Calculate checksum (double SHA-256) of the versioned hash
  const checksum = nobleSha256(nobleSha256(versionedHash));

  // Combine versioned hash with first 4 bytes of checksum
  const result = new Uint8Array([...versionedHash, ...checksum.slice(0, 4)]);

  return base58.encode(result);
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  const lut = Array.from({length: 256}, (_, i) =>
    i.toString(16).padStart(2, '0'),
  );
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) s += lut[byte];
  }
  return s;
}

export function bytesToString(bytes: Uint8Array): string {
  let str: string = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) str += String.fromCharCode(byte);
  }
  return str;
}

// h 要是hash字符串
export function hashReverse(h: string): string {
  if (typeof h !== 'string' || h.length !== 64) {
    return '';
  }
  let s = '';
  for (let i = 0; i < 64; i += 2) {
    s = h.charAt(i) + h.charAt(i + 1) + s;
  }
  return s;
}

/**
 * 对应 PHP 的 rev16，实现 16 位（4位十六进制字符）字节序反转
 */
export function rev16(hex: string): string {
  const cleanHex = hex.replace('0x', '').padStart(4, '0');
  return cleanHex.slice(2, 4) + cleanHex.slice(0, 2);
}

/**
 * 对应 PHP 的 rev，实现 32 位（8位十六进制字符）字节序反转
 */
export function rev32(hex: string): string {
  const cleanHex = hex.replace('0x', '').padStart(8, '0');
  return rev16(cleanHex.slice(4, 8)) + rev16(cleanHex.slice(0, 4));
}

/**
 * 对应 PHP 的 rev64，实现 64 位（16位十六进制字符）字节序反转
 */
export function rev64(hex: string): string {
  const cleanHex = hex.replace('0x', '').padStart(16, '0');
  return rev32(cleanHex.slice(8, 16)) + rev32(cleanHex.slice(0, 8));
}

export function rawTxDecode(hex: string) {
  hex = hex.toLowerCase();
  const r = new Reader();
  r.StrToByte(hex);
  return r;
}

export function decode(r: Reader) {
  const version = r.readInt32();

  if ((version & 0x20) == 0) {
    const dcount = r.readVarInt();
    const txDef = [];
    let lockTime = 0;

    for (let i = 0; i < dcount; i++) {
      let t = r.read(1);
      t = t[0] as unknown as Uint8Array;

      let c;

      switch (t) {
        case new Uint8Array([0]):
          c = new VertexDef();
          break;
        case new Uint8Array([1]):
          c = new BorderDef();
          break;
        case new Uint8Array([2]):
          c = new PolygonDef();
          break;
        case new Uint8Array([4]):
          c = new RightDef();
          break;
        case new Uint8Array([5]):
          c = new RightSetDef();
          break;
        case new Uint8Array([0xfc]):
          c = new SeparatorDef();
          break;
      }
      c?.read(r);

      txDef.push(c);
    }

    let count = r.readVarInt();
    const tIn = [];
    for (let i = 0; i < count; i++) {
      const t = new TinDef();
      t.read(r);
      tIn.push(t);
    }

    count = r.readVarInt();
    const tOut = [];
    for (let i = 0; i < count; i++) {
      const t = new ToutDef();
      t.read(r);
      tOut.push(t);
    }

    if ((version & 0x10) == 0) {
      lockTime = r.readInt32();
      console.log('lockTime', lockTime);
    }

    count = r.readVarInt();
    const signatureScripts = [];
    for (let i = 0; i < count; i++) {
      signatureScripts.push(r.readScript());
    }
  }
}

export function bytesToHex2(bytes: Uint8Array): string {
  const hex = [];
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte !== undefined) {
      hex.push((byte >>> 4).toString(16));
      hex.push((byte & 0xf).toString(16));
    }
  }
  return hex.join('');
}

export function bin2hex(str: string) {
  let hex = '',
    num;
  str = padLeft(str, 4);
  for (let i = str.length; i >= 4; i -= 4) {
    num = parseInt(str.slice(i - 4, i), 2);
    if (isNaN(num)) {
      throw new Error('Invalid binary character.');
    }
    hex = num.toString(16) + hex;
  }
  return hex;
}

export function padLeft(str: string, bits: number) {
  /*
  bits: 8, // default number of bits
	radix: 16, // work with HEX by default
	minBits: 3,
	maxBits: 20, // this permits 1,048,575 shares, though going this high is NOT recommended in JS!

	bytesPerChar: 2,
	maxBytesPerChar: 6
  */
  bits = bits || 8;
  const missing = str.length % bits;
  return (missing ? new Array(bits - missing + 1).join('0') : '') + str;
}


// --- msgTools.ts ---







export class MsgT {
  version: number;
  txDef: any[];
  tIn: any[];
  tOut: any[];
  signatureScripts: string[] = [];
  lockTime: number;

  constructor() {
    this.version = 0x11;
    this.txDef = [] as any[];
    this.tIn = [] as any[];
    this.tOut = [] as any[];
    this.signatureScripts = [];
    this.lockTime = 0;
  }
  data() {
    const t: {
      version: number;
      TxDef: any[];
      TIn: any[];
      TOut: any[];
      SignatureScripts: string[];
    } = {
      version: this.version,
      TxDef: [],
      TIn: [],
      TOut: [],
      SignatureScripts: this.signatureScripts,
    };
    for (let i = 0; i < this.txDef.length; i++) {
      t.TxDef.push(this.txDef[i].data());
    }
    for (let i = 0; i < this.tIn.length; i++) {
      t.TIn.push(this.tIn[i].data());
    }
    for (let i = 0; i < this.tOut.length; i++) {
      t.TOut.push(this.tOut[i].data());
    }
    return t;
  }

  fromData(d: any) {
    this.signatureScripts = d.SignatureScripts;
    for (let i = 0; i < d.TIn.length; i++) {
      const t = new TinDef();
      t.previousOutPoint = d.TIn[i].previousOutPoint;
      t.signatureIndex = d.TIn[i].signatureIndex;
      t.sequence = d.TIn[i].sequence;
      this.tIn.push(t);
    }
    for (let i = 0; i < d.TOut.length; i++) {
      const t = new ToutDef();
      t.tokenType = d.TOut[i].tokenType;
      t.value = d.TOut[i].value;
      t.rights = d.TOut[i].rights;
      t.pkScript = d.TOut[i].pkScript;
      this.tOut.push(t);
    }
  }
  assignSigIndex() {
    let signatureIndex = 0;
    const addresses: number[] = [];
    for (let i = 0; i < this.tIn.length; i++) {
      const sid = addresses.findIndex(n => n === this.tIn[i].signatureIndex);
      if (sid >= 0) {
        this.tIn[i].signatureIndex = sid;
      } else {
        addresses.push(this.tIn[i].signatureIndex);
        this.tIn[i].signatureIndex = signatureIndex;
        signatureIndex++;
      }
    }
    return addresses;
  }

  encode(mode: number) {
    const w = new Packer();
    w.PackV(this.version);
    let count = 0;
    if ((this.version & 0x20) === 0) {
      count = this.txDef.length;
      if ((mode & 2) === 0) {
        for (let i = 0; i < this.txDef.length; i++) {
          if (this.txDef[i].type === 'separator') {
            count = i;
            break;
          }
        }
      }
      w.WriteVarInt(count);
      for (let i = 0; i < count; i++) {
        w.Merge(this.txDef[i].write());
      }
    }
    count = this.tIn.length;
    if ((mode & 2) === 0) {
      for (let i = 0; i < this.tIn.length; i++) {
        if (this.tIn[i].isSeparator()) {
          count = i;
          break;
        }
      }
    }
    w.WriteVarInt(count);
    for (let i = 0; i < count; i++) {
      w.Merge(this.tIn[i].write());
    }
    count = this.tOut.length;
    if ((mode & 2) === 0) {
      for (let i = 0; i < this.tOut.length; i++) {
        if (this.tOut[i].isSeparator()) {
          count = i;
          break;
        }
      }
    }
    w.WriteVarInt(count);
    for (let i = 0; i < count; i++) {
      w.Merge(this.tOut[i].write());
    }

    if ((this.version & 0x10) === 0) {
      w.PackV(this.lockTime);
    }

    if (mode & 1) {
      w.WriteVarInt(this.signatureScripts.length);
      for (let i = 0; i < this.signatureScripts.length; i++) {
        const script = this.signatureScripts[i];
        if (!script) {
          w.WriteVarInt(0);
        } else {
          w.WriteVarInt(script.length / 2);
          w.PackHs(script);
        }
      }
    } else {
      w.WriteVarInt(0);
    }
    return w.Bytes();
  }

  hashval() {
    const h = nobleSha256(nobleSha256(this.encode(0)));
    return hashReverse(bytesToHex(h));
  }

  rawDecode(raw: string) {
    raw = raw.toLowerCase();
    const r = new Reader();
    r.StrToByte(raw);
    this.decode(r);
  }

  decodeBytes(bytes: Uint8Array) {
    const r = new Reader();
    r.SetBytes(bytes);
    this.decode(r);
  }

  decode(r: any) {
    this.version = r.readInt32();
    if ((this.version & 0x20) === 0) {
      const dcount = r.readVarInt();
      this.txDef = [];
      for (let i = 0; i < dcount; i++) {
        let t = r.read(1);
        console.log('t', t);
        t = t[0] as number;
        let c: any;
        switch (t) {
          case 0:
            c = new VertexDef();
            break;
          case 1:
            c = new BorderDef();
            break;
          case 2:
            c = new PolygonDef();
            break;
          case 4:
            c = new RightDef();
            break;
          case 5:
            c = new RightSetDef();
            break;
          case 0xfc:
            c = new SeparatorDef();
            break;
        }
        if (c) c.read(r);
        this.txDef.push(c);
      }

      let count = r.readVarInt();
      this.tIn = [];
      for (let i = 0; i < count; i++) {
        const t = new TinDef();
        t.read(r);
        this.tIn.push(t);
      }
      // console.log('this.tIn', this.tIn);

      count = r.readVarInt();
      this.tOut = [];
      for (let i = 0; i < count; i++) {
        const t = new ToutDef();
        t.read(r);
        this.tOut.push(t);
      }
      // console.log('this.tOut', this.tOut);

      if ((this.version & 0x10) === 0) {
        this.lockTime = r.readInt32();
      }

      count = r.readVarInt();
      this.signatureScripts = [];
      for (let i = 0; i < count; i++) {
        this.signatureScripts.push(r.readScript());
      }
    }
  }

  modifiable() {
    let m = this.signatureScripts.length === 0;
    for (let i = 0; i < this.tIn.length && m; i++) {
      if (
        this.tIn[i].previousOutPoint.hash ===
        '0000000000000000000000000000000000000000000000000000000000000000'
      ) {
        continue;
      } else if (this.tIn[i].signatureIndex !== -1) {
        m = false;
      }
    }
    for (let i = 0; i < this.tOut.length && m; i++) {
      if (this.tOut[i].isSeparator()) {
        m = false;
      }
    }
    return m;
  }

  lockInput(v: any) {
    // omegaDB.transaction(function (dbtx) {
    //   if (v == undefined) v = 1;
    //   for (var i = 0; i < T.TIn.length; i++) {
    //     if (T.TIn[i].prototype.IsSeparator()) continue;
    //     var sql = "update " + T.model.module + "ut_table SET locked=? WHERE txid='" + T.TIn[i].PreviousOutPoint.Hash + "' AND opindex=" + T.TIn[i].PreviousOutPoint.Index.toString();
    //     dbtx.executeSql(sql, [v], function (){}, function (resp){
    //     });
    //   }
    // });
  }

  inputOf(tokenType: any) {
    // return new Promise(resolve=>omegaDB.transaction(function (dbtx) {
    //   var sql = '', glue = '';
    //   for (var i = 0; i < T.TIn.length; i++) {
    //     if (T.TIn[i].prototype.IsSeparator()) continue;
    //     sql += glue + "(txid='" + T.TIn[i].PreviousOutPoint.Hash + "' AND opindex=" + T.TIn[i].PreviousOutPoint.Index.toString() + ")";
    //     glue = " OR ";
    //   }
    //   tx.executeSql('SELECT sum(amount) FROM ' + T.model.module + 'ut_table WHERE tokentype=? AND (' +sql+ ')', [Model.prototype.tokentype2Hex(tokentype)], function (tx, res) {
    //     var res = SentenceSql(res);
    //     resolve(res.rows[0]['sum(amount)']);
    //   });
    // }));
  }

  outputOf(tokenType: any) {
    let sum = BigInt(0);
    for (let i = 0; i < this.tOut.length; i++) {
      if (this.tOut[i].isSeparator() || this.tOut[i].tokenType !== tokenType) {
        continue;
      }
      sum += this.tOut[i].value;
    }
    return sum;
  }
}


// --- address.ts ---




/**
 * Decode a Base58Check address string.
 * Validates checksum (double SHA-256) and returns the first 21 bytes
 * [version(1) + hash160(20)].
 */
export class Address {
  static decodeString(address: string): Uint8Array {
    const bytes = Uint8Array.from(base58.decode(address));
    if (bytes.length < 25) {
      throw new Error('Invalid address length: ' + address);
    }

    const hash = bytes.slice(0, 21);
    const checksum = nobleSha256(nobleSha256(hash));
    if (
      checksum[0] !== bytes[21] ||
      checksum[1] !== bytes[22] ||
      checksum[2] !== bytes[23] ||
      checksum[3] !== bytes[24]
    ) {
      throw new Error('Checksum validation failed! ' + address);
    }

    return hash;
  }

  static toPkScript(address: string): string {
    const hash = Address.decodeString(address);
    //TODO: support crosschain

    const op =
      hash[0] == 0 || hash[0] == 0x6f ? 0x41 : hash[0] == 0x78 ? 0x43 : 0x42;
    const adb = new Uint8Array([...hash, op, 0, 0, 0]);
    const pkScript = bytesToHex2(adb);
    return pkScript;
  }
}

// export default Address;


`;
