import { hexToBytes, bytesToHex } from './index';

export class Reader {
    private src: Uint8Array = new Uint8Array(0);
    private pos = 0;
    private len = 0;
  
    EOF(): boolean { return this.pos >= this.len; }
  
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
  
    readBH(): { Version: number; PrevBlock: string; MerkleRoot: string; Timestamp: number; ContractExec: bigint; Nonce: number } {
      const v = this.readInt32();
      const Prev = this.readHash();
      const Merkle = this.readHash();
      const Timestamp = this.readInt32();
      const ContractExec = this.readInt64();
      const Nonce = this.readInt32();
      return { Version: v, PrevBlock: Prev, MerkleRoot: Merkle, Timestamp, ContractExec, Nonce };
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
        sum += this.src[this.pos++] << (i * 8);
      }
      // signed 32-bit
      if (sum & 0x80000000) {
        sum = (~sum) + 1;
        sum = -sum;
      }
      return sum;
    }
  
    readInt64(): bigint {
      // unsigned int64
      let sum = BigInt(0);
      for (let i = 0; i < 8; i++) {
        if (this.pos >= this.len) return sum;
        const d = BigInt(this.src[this.pos++]) << BigInt(i * 8);
        sum += d;
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
      for (let i = 0; i < count; i++) s += String.fromCharCode(t[i]);
      return s;
    }
  
    readOutPoint(): { hash: string; index: number } {
      const h = this.readHash();
      const i = this.readInt32();
      return { hash: h, index: i };
    }
  
    readHash(): string {
      const t = this.read(32);
      return bytesToHex(t);
    }
  
    readVarInt(): number | bigint {
      const discriminant = this.src[this.pos];
      if (discriminant < 0xfd) {
        this.pos++;
        return discriminant;
      }
      this.pos++;
  
      let sum = 0;
      const bs = 1 << (discriminant - 0xfc);
  
      for (let i = 0; i < Math.min(bs, 4); i++) {
        if (this.pos >= this.len) return sum;
        sum = sum | ((this.src[this.pos] << (i * 8)) & 0xFFFFFFFF);
        this.pos++;
      }
  
      if (bs > 4) {
        let big = BigInt(sum);
        for (let i = 4; i < bs; i++) {
          if (this.pos >= this.len) return big;
          big = big | (BigInt(this.src[this.pos]) << BigInt(i * 8));
          this.pos++;
        }
        return big;
      }
      return sum;
    }
    readIntDiscriminant(): number {
      return this.src[this.pos];
    }
  }
  