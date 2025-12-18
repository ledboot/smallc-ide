import Asm from './asm';

// 简单的测试用例
export function runAsmLibTests() {
  console.log('🧪 开始 AsmLib 测试...\n');

  // 测试1: 基本编译功能
  console.log('📝 测试1: 基本编译功能');
  const basicCode = `
define BODY .
MALLOC 0,336,
EVAL32 gi0,4,
EVAL32 gi4,BODY,
STOP
`;

  const basicResult = Asm.assemble(basicCode);
  if (basicResult.success) {
    console.log('✅ 基本编译测试通过');
    console.log(`   字节码长度: ${basicResult.bytecode.length}`);
    console.log(`   哈希: ${basicResult.hash.substring(0, 16)}...`);
    console.log(`   bytecode: ${basicResult.bytecode}`);
  } else {
    console.log('❌ 基本编译测试失败:', basicResult.error);
  }

  // 测试2: 操作码替换
  console.log('\n📝 测试2: 操作码替换');
  const opcodeCode = 'EVAL32 gi0,4,\nIF ii0,4,\nRETURN';
  const opcodeResult = Asm.assemble(opcodeCode);
  if (
    opcodeResult.success &&
    opcodeResult.objectCode.includes('C') &&
    opcodeResult.objectCode.includes('K')
  ) {
    console.log('✅ 操作码替换测试通过');
  } else {
    console.log('❌ 操作码替换测试失败');
  }

  // 测试3: 字符串处理
  console.log('\n📝 测试3: 字符串处理');
  const stringCode = 'EVAL8 "test",';
  const stringResult = Asm.assemble(stringCode);
  if (stringResult.success && stringResult.objectCode.includes('x74657374')) {
    console.log('✅ 字符串处理测试通过');
  } else {
    console.log('❌ 字符串处理测试失败');
  }

  // 测试4: ABI函数处理
  console.log('\n📝 测试4: ABI函数处理');
  const abiCode = 'LOAD buf,abi("test::function"),';
  const abiResult = Asm.assemble(abiCode);
  if (abiResult.success && abiResult.objectCode.includes('x')) {
    console.log('✅ ABI函数处理测试通过');
  } else {
    console.log('❌ ABI函数处理测试失败');
  }

  // 测试5: 调试信息处理
  console.log('\n📝 测试5: 调试信息处理');
  const debugCode = `
;#{"code":"init","types":{},"vars":[]}
ALLOC 0,48,
EVAL32 ii0'8,x1,
;#{"endcode":""}
`;
  const debugResult = Asm.assemble(debugCode);
  if (debugResult.success && debugResult.debugInfo.length > 0) {
    console.log('✅ 调试信息处理测试通过');
    console.log(`   调试信息数量: ${debugResult.debugInfo.length}`);
  } else {
    console.log('❌ 调试信息处理测试失败');
  }

  // 测试6: 语法验证
  console.log('\n📝 测试6: 语法验证');
  const invalidCode = 'EVAL32 "unclosed string,\nIF (unmatched parentheses,';
  const validation = Asm.validateSyntax(invalidCode);
  if (!validation.valid && validation.errors.length > 0) {
    console.log('✅ 语法验证测试通过');
    console.log(`   检测到 ${validation.errors.length} 个错误`);
  } else {
    console.log('❌ 语法验证测试失败');
  }

  // 测试7: 代码格式化
  console.log('\n📝 测试7: 代码格式化');
  const unformattedCode = `define test .
EVAL32 ii0,1,
IF ii0,4,
RETURN`;
  const formatted = Asm.formatCode(unformattedCode);
  if (formatted.includes('  EVAL32') && formatted.includes('  IF')) {
    console.log('✅ 代码格式化测试通过');
  } else {
    console.log('❌ 代码格式化测试失败');
  }

  // 测试8: 操作码列表
  console.log('\n📝 测试8: 操作码列表');
  const opcodes = Asm.getSupportedOpcodes();
  if (
    opcodes.length > 0 &&
    opcodes.includes('EVAL32 ') &&
    opcodes.includes('RETURN')
  ) {
    console.log('✅ 操作码列表测试通过');
    console.log(`   支持 ${opcodes.length} 个操作码`);
  } else {
    console.log('❌ 操作码列表测试失败');
  }

  // 测试9: 复杂ASM代码（来自accountv2.asm的简化版本）
  console.log('\n📝 测试9: 复杂ASM代码编译');
  const complexCode = `
;#{"code":"","types":{"asset":{"__TYPE__":"struct","tokentype":{"loc":"0","size":8,"type":"long"},"amount":{"loc":"8","size":8,"type":"long"}}},"vars":[{"assetKinds":{"loc":"gii0'168","size":4,"type":"int"}}]}
;#{"code":"init","types":{},"vars":[]}
MALLOC 0,336,
define mainRETURN .
EVAL32 gi0,4,
EVAL32 gi4,BODY,
STOP
;#{"endcode":""}
define BODY .
MALLOC 0,296,
EVAL32 ii0'8,x1,i8,!
IF ii0'8,4,
CALL 0,.init,
RETURN
STOP
;#{"endcode":""}
define init .
ALLOC 0,48,
EVAL32 ii0'40,0,
RETURN
;#{"endcode":""}
`;

  const complexResult = Asm.assemble(complexCode);
  if (complexResult.success) {
    console.log('✅ 复杂ASM代码编译测试通过');
    console.log(`   字节码长度: ${complexResult.bytecode.length}`);
    console.log(`   调试信息: ${complexResult.debugInfo.length} 个函数`);
  } else {
    console.log('❌ 复杂ASM代码编译测试失败:', complexResult.error);
  }

  console.log('\n✨ Asm 测试完成!');

  // 返回测试结果摘要
  return {
    totalTests: 9,
    basicCompilation: basicResult.success,
    opcodeReplacement:
      opcodeResult.success && opcodeResult.objectCode.includes('C'),
    stringProcessing:
      stringResult.success && stringResult.objectCode.includes('x74657374'),
    abiProcessing: abiResult.success,
    debugInfo: debugResult.success && debugResult.debugInfo.length > 0,
    syntaxValidation: !validation.valid && validation.errors.length > 0,
    codeFormatting: formatted.includes('  EVAL32'),
    opcodeList: opcodes.length > 0,
    complexCompilation: complexResult.success,
  };
}

// 如果在Node.js环境中直接运行此文件
if (typeof window === 'undefined' && require.main === module) {
  runAsmLibTests();
}
