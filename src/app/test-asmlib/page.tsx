'use client';

import React, { useState } from 'react';
import { Asm } from '@/lib/asm';

interface TestResults {
  totalTests: number;
  [key: string]: boolean | number;
}

export default function TestAsmLibPage() {
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [customCode, setCustomCode] = useState<string>(
    `define BODY .\nMALLOC 0,100,\nEVAL32 gi0,42,\nSTOP\n`
  );

  // 重写console.log来捕获输出
  const originalConsoleLog = console.log;
  const captureConsoleLog = (...args: unknown[]) => {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    setLogs(prev => [...prev, message]);
    originalConsoleLog(...args);
  };

  const runTests = async () => {
    setIsRunning(true);
    setLogs([]);
    setTestResults(null);
    console.log = captureConsoleLog;
    try {
      // const results = runAsmLibTests();
      // setTestResults(results);
    } catch (error) {
      console.log('测试运行出错:', error);
    } finally {
      console.log = originalConsoleLog;
      setIsRunning(false);
    }
  };

  const runDemo = async () => {
    setIsRunning(true);
    setLogs([]);
    console.log = captureConsoleLog;
    try {
      // demonstrateAsmLib();
    } catch (error) {
      console.log('演示运行出错:', error);
    } finally {
      console.log = originalConsoleLog;
      setIsRunning(false);
    }
  };

  const testCustomCode = () => {
    setLogs([]);
    console.log = captureConsoleLog;
    try {
      console.log('🔧 编译自定义ASM代码...');
      const result = Asm.assemble(customCode);
      if (result.success) {
        console.log('✅ 编译成功!');
        console.log(`字节码: ${result.bytecode.substring(0, 50)}...`);
        console.log(`哈希: ${result.hash}`);
      } else {
        console.log('❌ 编译失败:', result.error);
      }
    } catch (error) {
      console.log('自定义代码测试出错:', error);
    } finally {
      console.log = originalConsoleLog;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 text-center">
        🧪 AsmLib 测试套件
      </h1>

      <div className="grid gap-4 mb-6">
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={runTests}
            disabled={isRunning}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? '⏳ 运行中...' : '🚀 运行完整测试'}
          </button>

          <button
            onClick={runDemo}
            disabled={isRunning}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? '⏳ 运行中...' : '🎨 运行演示'}
          </button>
        </div>

        {/* 自定义代码输入区 */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border flex flex-col gap-2">
          <label htmlFor="custom-asm" className="font-semibold text-gray-700 mb-1">自定义ASM源码：</label>
          <textarea
            id="custom-asm"
            className="w-full font-mono p-2 rounded border border-gray-300 min-h-[120px]"
            value={customCode}
            onChange={e => setCustomCode(e.target.value)}
            placeholder="输入你的SmallC ASM源码..."
            disabled={isRunning}
          />
          <button
            onClick={testCustomCode}
            disabled={isRunning}
            className="mt-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? '⏳ 编译中...' : '⚡ 编译自定义代码'}
          </button>
        </div>

        <button
          onClick={() => {setLogs([]); setTestResults(null);}}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 mx-auto"
        >
          🧹 清空日志
        </button>
      </div>

      {/* 测试结果摘要 */}
      {testResults && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h2 className="text-xl font-semibold mb-3">📊 测试结果摘要</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{testResults.totalTests}</div>
              <div className="text-sm text-gray-600">总测试数</div>
            </div>
            {Object.entries(testResults).map(([key, value]) => {
              if (key === 'totalTests') return null;
              const passed = Boolean(value);
              return (
                <div key={key} className="text-center">
                  <div className={`text-lg font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                    {passed ? '✅' : '❌'}
                  </div>
                  <div className="text-xs text-gray-600 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 控制台输出 */}
      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
        <div className="flex items-center mb-2">
          <span className="text-yellow-400">📟 控制台输出</span>
          <span className="ml-auto text-gray-500">{logs.length} 行</span>
        </div>
        <hr className="border-gray-600 mb-2" />
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">点击上方按钮开始测试...</div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap break-words">
                <span className="text-gray-500 mr-2">{(index + 1).toString().padStart(3, '0')}:</span>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">💡 使用说明</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li><strong>完整测试</strong>: 运行所有9个测试用例，验证AsmLib的各项功能</li>
          <li><strong>演示</strong>: 展示AsmLib的基本使用方法和功能特性</li>
          <li><strong>自定义代码</strong>: 编译一个简单的ASM代码示例</li>
          <li><strong>控制台输出</strong>: 显示详细的测试过程和结果</li>
        </ul>
      </div>

      {/* 开发者工具提示 */}
      <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
        <h3 className="font-semibold text-yellow-800 mb-1">🛠️ 开发者提示</h3>
        <p className="text-sm text-yellow-700">
          你也可以打开浏览器开发者工具(F12)，在控制台中运行：
        </p>
        <code className="block mt-1 p-2 bg-gray-100 rounded text-xs">
          import(&apos;./lib/asmlib.test&apos;).then(module =&gt; module.runAsmLibTests())
        </code>
      </div>
    </div>
  );
}