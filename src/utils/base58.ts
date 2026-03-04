import bigInt from 'big-integer';

export interface Base58Interface {
  encode(input: number[] | Uint8Array): string;
  decode(input: string): number[];
}

export class Base58 implements Base58Interface {
  public readonly alphabet: string =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  public readonly validRegex: RegExp = /^[1-9A-HJ-NP-Za-km-z]+$/;
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
export default base58;
