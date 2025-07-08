import Asm from './asm';

// 示例ASM代码
const exampleAsmCode = `
; 这是一个简单的SmallC合约示例
;#{\"code\":\"init\",\"types\":{},\"vars\":[]}
define BODY .
MALLOC 0,336,
EVAL32 gi0,4,
EVAL32 gi4,BODY,
STOP
;#{\"endcode\":\"\"}

define init .
ALLOC 0,48,
; 初始化代码
EVAL32 ii0'8,x1,i8,!
IF ii0'8,4,
CALL 0,.setup,
RETURN
STOP
;#{\"endcode\":\"\"}

define setup .
ALLOC 0,32,
; 设置逻辑
EVAL64 ii0'8,i8,0,=
IF ii0'8,.__label123,
REVERT
define __label123 .
RETURN
`;

// 使用示例
export function demonstrateAsmLib() {
  console.log('=== SmallC ASM编译器示例 ===\n');

  // 1. 验证语法
  console.log('1. 验证ASM代码语法...');
  const validation = Asm.validateSyntax(exampleAsmCode);
  if (validation.valid) {
    console.log('✅ 语法验证通过');
  } else {
    console.log('❌ 语法错误:');
    validation.errors.forEach(error => console.log(`   ${error}`));
    return;
  }

  // 2. 编译ASM代码
  console.log('\n2. 编译ASM代码...');
  const result = Asm.assemble(exampleAsmCode);
  
  if (result.success) {
    console.log('✅ 编译成功!');
    console.log(`📦 字节码长度: ${result.bytecode.length} 字符`);
    console.log(`🔗 合约哈希: ${result.hash}`);
    console.log(`📋 调试信息: ${result.debugInfo.length} 个函数`);
    
    // 显示对象代码（前200个字符）
    const truncatedObjectCode = result.objectCode.length > 200 
      ? result.objectCode.substring(0, 200) + '...'
      : result.objectCode;
    console.log(`🔧 对象代码预览:\n${truncatedObjectCode}`);
    
    // 显示字节码（前100个字符）
    const truncatedBytecode = result.bytecode.length > 100
      ? result.bytecode.substring(0, 100) + '...'
      : result.bytecode;
    console.log(`🔢 字节码预览:\n${truncatedBytecode}`);
    
  } else {
    console.log('❌ 编译失败:');
    console.log(`   错误: ${result.error}`);
  }

  // 3. 显示支持的操作码
  console.log('\n3. 支持的操作码:');
  const opcodes = Asm.getSupportedOpcodes();
  console.log(`   总共支持 ${opcodes.length} 个操作码:`);
  opcodes.slice(0, 10).forEach(opcode => {
    console.log(`   - ${opcode.padEnd(15)}`);
  });
  if (opcodes.length > 10) {
    console.log(`   ... 和其他 ${opcodes.length - 10} 个操作码`);
  }

  // 4. 格式化代码示例
  console.log('\n4. 代码格式化示例:');
  const unformattedCode = `define test .
EVAL32 ii0,1,
IF ii0,4,
RETURN
STOP`;
  const formattedCode = Asm.formatCode(unformattedCode);
  console.log('原始代码:');
  console.log(unformattedCode);
  console.log('\n格式化后:');
  console.log(formattedCode);

  return result;
}

// 编译单个ASM文件的功能
export function compileAsmCode(code: string) {
  const result = Asm.assemble(code);
  
  return {
    success: result.success,
    bytecode: result.bytecode,
    hash: result.hash,
    objectCode: result.objectCode,
    debugInfo: result.debugInfo,
    error: result.error,
    // 额外的统计信息
    stats: {
      originalLines: code.split('\n').length,
      objectCodeLines: result.objectCode.split('\n').length,
      bytecodeSize: result.bytecode.length,
      hasDebugInfo: result.debugInfo.length > 0
    }
  };
}

// 批量编译多个ASM文件
export function batchCompile(asmFiles: { name: string; code: string }[]) {
  const results = asmFiles.map(file => {
    const result = compileAsmCode(file.code);
    return {
      fileName: file.name,
      ...result
    };
  });

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    results,
    summary: {
      total: asmFiles.length,
      successful,
      failed,
      successRate: Math.round((successful / asmFiles.length) * 100)
    }
  };
}

// 导出主要功能
export { Asm };
export default {
  compile: compileAsmCode,
  batchCompile,
  demonstrate: demonstrateAsmLib,
  validateSyntax: Asm.validateSyntax,
  formatCode: Asm.formatCode,
  getSupportedOpcodes: Asm.getSupportedOpcodes
}; 