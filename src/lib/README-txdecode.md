# txdecode

## 功能

- 解析比特币风格原始交易（hex字符串）
- 返回主要字段对象

## 使用

```typescript
import { parseRawTx } from './txdecode';

const rawhash = '110000000001eeb5950a931c53a70afe69111cbbfb68d2c20e1a65ce32cb323f748b6ca925870000000000000000ffffffff021000ca9a3b0000000019003743d68cf6c52702f55ec53662e6bd8bcdf52b2e4100000010ca4eaf6dd1010000190077c3789ca98711546d2c92fd1000ff253b86159341000000017156222102676a41876df5cedb8ecdf8e3ae368d3e76931e905c0ce8d521e9d3cb72e509fb5649483046022100f3d0921efe0f2194de97bbee1ff479b3691647a375c96785de3970f116c913c5022100ce60cc4e7f22e062ba87ac4dad5063b10e1f1e4cf3c711083888a0bfc93fa0614a01';

const decoded = parseRawTx(rawhash);

console.log(decoded);
```

## 运行测试用例

```
npx tsx src/lib/txdecode.test.ts
```
