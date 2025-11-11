import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';

import { Packer } from './packer';
import { Reader } from './reader';
import { hashReverse } from './index';
import { VertexDef, BorderDef , PolygonDef, RightDef, RightSetDef, SeparatorDef, TinDef, ToutDef } from './defs';



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
      const sid = addresses.findIndex((n) => n === this.tIn[i].signatureIndex);
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
        if (!this.signatureScripts[i]) {
          w.WriteVarInt(0);
        } else {
          w.WriteVarInt(this.signatureScripts[i].length / 2);
          w.PackHs(this.signatureScripts[i]);
        }
      }
    } else {
      w.WriteVarInt(0);
    }
    return w.Bytes();
  }

  hashval() {
    const h = nobleSha256(nobleSha256(this.encode(0)));
    return hashReverse(h);
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
        c.read(r);
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
      if (this.tIn[i].previousOutPoint.hash === '0000000000000000000000000000000000000000000000000000000000000000') {
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

  inputOf (tokenType: any) {
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
  
  outputOf (tokenType: any) {
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
