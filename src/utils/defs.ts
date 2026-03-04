import {sha256 as nobleSha256} from '@noble/hashes/sha2.js';

import {bytesToHex, bytesToString, hashReverse} from './index';
import {Packer} from './packer';
import {Reader} from './reader';

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
