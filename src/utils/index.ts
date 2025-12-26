import {sha256 as nobleSha256} from '@noble/hashes/sha2.js';

import base58 from './base58';
import {
  BorderDef,
  PolygonDef,
  RightDef,
  RightSetDef,
  SeparatorDef,
  TinDef,
  ToutDef,
  VertexDef,
} from './defs';
import {Reader} from './reader';

import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

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

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
