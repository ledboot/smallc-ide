import {nib} from './index';

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
