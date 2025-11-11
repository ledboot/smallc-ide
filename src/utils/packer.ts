import { nib } from './index';

export class Packer {
    private dest: number[] = [];
  
    Bytes(): Uint8Array {
      return new Uint8Array(this.dest);
    }
  
    PackC(c: number): void {
      this.dest.push(c);
    }
  
    PackV(v: number): void {
      this.dest.push(v & 0xFF);
      this.dest.push((v >> 8) & 0xFF);
      this.dest.push((v >> 16) & 0xFF);
      this.dest.push((v >> 24) & 0xFF);
    }
  
    PackP(v: bigint | number): void {
      if (typeof v !== 'bigint') {
        v = BigInt(Math.round(Number(v)));
      }
  
      this.dest.push(Number(v) & 0xFF);
      this.dest.push(Number(v >> BigInt(8)) & 0xFF);
      this.dest.push(Number(v >> BigInt(16)) & 0xFF);
      this.dest.push(Number(v >> BigInt(24)) & 0xFF);
      this.dest.push(Number(v >> BigInt(32)) & 0xFF);
      this.dest.push(Number(v >> BigInt(40)) & 0xFF);
      this.dest.push(Number(v >> BigInt(48)) & 0xFF);
      this.dest.push(Number(v >> BigInt(56)) & 0xFF);
    }
  
    PackH(v: string): void {
      // v is a hex string
      this.dest.push((nib(v.charCodeAt(0)) << 4 | nib(v.charCodeAt(1))) & 0xFF);
    }
  
    PackCs(c: Uint8Array | number[]): void {
      for (let i = 0; i < c.length; i++) {
        this.PackC((c as any)[i]);
      }
    }
  
    PackVs(v: number[]): void {
      for (let i = 0; i < v.length; i++) {
        this.PackV(v[i]);
      }
    }
  
    PackHs(v: string): void {
      // v is a hex string
      for (let i = 0; i < v.length; i += 2) {
        this.dest.push((nib(v.charCodeAt(i)) << 4 | nib(v.charCodeAt(i + 1))) & 0xFF);
      }
    }
  
    WriteVarInt(val: number | bigint): void {
      if (typeof val === "bigint" && val <= BigInt(0xFFFFFFFF)) {
        val = Number(val);
      }
  
      if (typeof val === "number") {
        if (val < 0xfd) {
          this.dest.push(val);
          return;
        }
  
        if (val <= 0xFFFF) {
          this.dest.push(0xFD);
          this.dest.push(val & 0xFF);
          this.dest.push((val >> 8) & 0xFF);
          return;
        }
  
        if (val <= 0xFFFFFFFF) {
          this.dest.push(0xFE);
          this.PackV(val);
          return;
        }
      }
      this.dest.push(0xFF);
      this.PackP(val);
    }
  
    Merge(val: Uint8Array | number[]): void {
      this.dest = this.dest.concat(Array.from(val as any));
    }
  }