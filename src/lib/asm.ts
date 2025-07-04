// 使用 crypto-js 统一实现哈希功能
import CryptoJS from 'crypto-js';



// 操作码映射表
const stringToOp: Record<string, string> = {
  "EVAL8 ": 'A', "EVAL16 ": 'B', "EVAL32 ": 'C', "EVAL64 ": 'D', "EVAL256 ": 'E', "CONV ": 'F', "HASH ": 'G',
  "HASH160 ": 'H', "SIGCHECK ": 'I', "IF ": 'K', "CALL ": 'L', "EXEC ": 'M', "LOAD ": 'N',
  "STORE ": 'O', "DEL ": 'P', "LIBLOAD ": 'Q', "MALLOC ": 'R', "ALLOC ": 'S', "COPY ": 'T', "COPYIMM ": 'U',
  "SELFDESTRUCT": 'W', "REVERT": 'X', "RETURN": 'Y',
  "RECEIVED ": 'a', "TXFEE ": 'b', "GETCOIN ": 'c', "NOP": 'd', "SPEND ": 'e', "ADDDEF ": 'f', "ADDTXOUT ": 'g',
  "GETDEFINITION ": 'h', "GETUTXO ": 'i', "MINT ": 'j', "META ": 'k', "TIME ": 'l', "HEIGHT ": 'm', "TXIOCOUNT": 'n', 
  "VERSION": 'o', 'TOKENCONTRACT': 'p', 'LOG': 'q', "STOP": 'z'
};


interface DebugInfo {
  code?: string;
  endcode?: string;
  srcline?: number;
  types?: unknown;
  vars?: unknown[];
  begin?: number;
  end?: number;
  lines?: Array<[number, number]>;
  body?: number;
}

interface AssemblyResult {
  bytecode: string;
  hash: string;
  objectCode: string;
  debugInfo: DebugInfo[];
  success: boolean;
  error?: string;
}

export class Asm {
  /**
   * 汇编ASM代码为字节码
   * @param code ASM源代码
   * @returns 汇编结果
   */
  public static assemble(code: string): AssemblyResult {
    try {
      const lines = code.split('\n');
      const defs: Record<string, string> = {};
      let ln = 0;
      let processedCode = "";
      const debug: DebugInfo[] = [];
      let globvar: DebugInfo | null = null;
      let pdinfo: DebugInfo | null = null;

      // 第一遍处理：处理调试信息、注释、变量替换和define语句
      for (let line of lines) {
        line = line.trim();

        // 处理调试信息
        const debugMatch = line.match(/^;#\{[^}\n]+\}/);
        if (debugMatch) {
          try {
            const dinfo: DebugInfo = JSON.parse(line.substring(2));
            
            if (dinfo.code !== undefined) {
              if (pdinfo) {
                debug.push(pdinfo);
                if (globvar === null) {
                  globvar = pdinfo;
                }
              }
              dinfo.begin = ln - (defs["BODY"] ? parseInt(defs["BODY"]) : 0);
              dinfo.lines = [];
              pdinfo = dinfo;
            } else if (dinfo.endcode !== undefined) {
              if (pdinfo) {
                pdinfo.end = ln - (defs["BODY"] ? parseInt(defs["BODY"]) : 0);
              }
            } else if (dinfo.srcline !== undefined) {
              if (pdinfo) {
                const matched = pdinfo.lines?.some(rec => rec[1] === dinfo.srcline);
                if (!matched) {
                  pdinfo.lines = pdinfo.lines || [];
                  pdinfo.lines.push([ln - (defs["BODY"] ? parseInt(defs["BODY"]) : 0), dinfo.srcline]);
                }
              }
            }
            continue;
          } catch {
            console.warn(`Failed to parse debug info: ${line}`);
            continue;
          }
        }

        // 移除注释
        const commentMatch = line.match(/\s*;.*$/);
        if (commentMatch) {
          line = line.replace(commentMatch[0], '');
        }
        if (!line) continue;

        // 处理abi函数调用
        line = this.processAbiFunctions(line);

        // 处理变量替换
        line = this.processVariables(line, pdinfo, globvar);

        // 处理define语句
        const defineMatch = line.match(/^define\s+(.*)$/);
        if (defineMatch) {
          const parts = defineMatch[1].split(' ');
          if (parts.length >= 2) {
            const lastIndex = parts.length - 1;
            if (parts[lastIndex] === ".") {
              parts[lastIndex] = ln.toString();
            }
            defs[parts[0]] = parts[lastIndex];
          }
          continue;
        }

        ln++;
        processedCode += line + "\n";
      }

      if (pdinfo) {
        debug.push(pdinfo);
        if (debug.length > 0) {
          debug[0].end = pdinfo.end;
          debug[0].body = defs["BODY"] ? parseInt(defs["BODY"]) : 0;
        }
      }

      // 按长度排序definitions（长的优先替换）
      const sortedDefs = Object.entries(defs).sort((a, b) => b[0].length - a[0].length);

      // 第二遍处理：替换操作码、字符串和相对地址
      const codeLines = processedCode.split('\n');
      ln = 0;
      let objectCode = "";

      for (let line of codeLines) {
        if (!line.trim()) continue;

        // 替换操作码
        line = this.replaceOpcodes(line);
        // 处理字符串
        line = this.processStrings(line);

        // 替换definitions
        for (const [key, value] of sortedDefs) {
          line = line.replace(new RegExp(`\\b${this.escapeRegExp(key)}\\b`, 'g'), value);
        }

        // 处理相对地址
        line = this.processRelativeAddresses(line, ln);

        ln++;
        objectCode += line + "\n";
      }

      // 生成最终输出
      const cleanObjectCode = objectCode.trim();
      const bytecode = this.generateBytecode(cleanObjectCode);
      const hash = this.generateHash(bytecode);

      return {
        bytecode: bytecode,
        hash: hash,
        objectCode: cleanObjectCode,
        debugInfo: debug,
        success: true
      };

    } catch (error) {
      return {
        bytecode: "",
        hash: "",
        objectCode: "",
        debugInfo: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 处理ABI函数调用
   */
  private static processAbiFunctions(line: string): string {
    // 处理 abi("string") 函数
    line = line.replace(/abi\("([^"]*)"\)/g, (match, str) => {
      const hash = CryptoJS.SHA256(String(str ?? '')).toString(CryptoJS.enc.Hex);
      return "x" + hash.substring(0, 8);
    });

    // 处理 ABI("string") 函数
    line = line.replace(/ABI\("([^"]*)"\)/g, (match, str) => {
      const hash = CryptoJS.SHA256(String(str ?? '')).toString(CryptoJS.enc.Hex);
      let x = hash.substring(0, 8);
      if (x === "00000000") x = "00000001";
      return "x" + x + "00000000";
    });

    return line;
  }

  /**
   * 处理变量替换
   */
  private static processVariables(line: string, pdinfo: DebugInfo | null, globvar: DebugInfo | null): string {
    const variableRegex = /\\([0-9a-z_]+),/gi;
    
    return line.replace(variableRegex, (match, varName) => {
      let varloc = this.hasvar(pdinfo, varName);
      if (!varloc && globvar) {
        varloc = this.hasvar(globvar, varName);
      }
      if (varloc) {
        return varloc;
      } else {
        throw new Error(`Invalid variable in asm code: ${match}`);
      }
    });
  }

  /**
   * 查找变量位置
   */
  private static hasvar(info: DebugInfo | null, varName: string): string | null {
    if (!info?.vars) return null;
    for (const varObj of info.vars) {
      if (typeof varObj === 'object' && varObj !== null && varName in varObj) {
        // @ts-expect-error varObj结构为Record<string, {loc: string}>
        return varObj[varName].loc;
      }
    }
    return null;
  }

  /**
   * 替换操作码
   */
  private static replaceOpcodes(line: string): string {
    for (const [opcode, replacement] of Object.entries(stringToOp)) {
      // 匹配操作码后跟空格或@或单词边界
      const re = new RegExp(`\\b${this.escapeRegExp(opcode)}(?= |@|\\b)`, 'g');
      line = line.replace(re, replacement);
    }
    return line;
  }

  /**
   * 处理字符串转换为十六进制
   */
  private static processStrings(line: string): string {
    return line.replace(/"([^,"]+)"/g, (match, str) => {
      let hex = 'x';
      for (let i = 0; i < str.length; i++) {
        hex += str.charCodeAt(i).toString(16).padStart(2, '0');
      }
      return hex;
    });
  }

  /**
   * 处理相对地址
   */
  private static processRelativeAddresses(line: string, currentLine: number): string {
    return line.replace(/\.([0-9]+)/g, (match, target) => {
      const targetLine = parseInt(target);
      const dist = targetLine - currentLine;
      if (dist < 0) {
        return "n" + (-dist);
      }
      return dist.toString();
    });
  }

  /**
   * 生成字节码
   */
  private static generateBytecode(objectCode: string): string {
    // 将对象代码转换为二进制格式，然后转换为十六进制
    return Buffer.from(objectCode, 'utf8').toString('hex');
  }

  /**
   * 生成哈希
   */
  private static generateHash(bytecode: string): string {
    return CryptoJS.RIPEMD160(CryptoJS.enc.Hex.parse(bytecode)).toString(CryptoJS.enc.Hex);
  }

  /**
   * 转义正则表达式特殊字符
   */
  private static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 验证ASM代码语法
   */
  public static validateSyntax(code: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(';')) continue;

      // 检查基本语法错误
      if (line.includes('\\') && !line.match(/\\[0-9a-z_]+,/i)) {
        errors.push(`Line ${i + 1}: Invalid variable syntax`);
      }

      // 检查引号匹配
      const quotes = line.match(/"/g);
      if (quotes && quotes.length % 2 !== 0) {
        errors.push(`Line ${i + 1}: Unmatched quotes`);
      }

      // 检查括号匹配
      const openParens = (line.match(/\(/g) || []).length;
      const closeParens = (line.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push(`Line ${i + 1}: Unmatched parentheses`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取支持的操作码列表
   */
  public static getSupportedOpcodes(): string[] {
    return Object.keys(stringToOp);
  }

  /**
   * 格式化汇编代码
   * code
   */
  public static formatCode(code: string): string {
    return code
      .split('\n')
      .map(line => {
        line = line.trim();
        // 为标签和指令添加适当的缩进
        if (line.startsWith('define ') || line.match(/^[a-zA-Z_][a-zA-Z0-9_]*:$/)) {
          return line;
        } else if (line && !line.startsWith(';')) {
          return '  ' + line;
        }
        return line;
      })
      .join('\n');
  }
}

export default Asm; 