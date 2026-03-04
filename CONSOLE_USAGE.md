# Enhanced Console Component - 使用指南

## 快速开始

### 在任何组件中添加日志

```typescript
import { useConsoleStore } from '@/lib/console-store';

function YourComponent() {
  const { addLog } = useConsoleStore();
  
  // 添加不同级别的日志
  addLog('编译开始...', 'info');
  addLog('发现警告', 'warn');
  addLog('编译失败', 'error');
  addLog('编译成功！', 'success');
}
```

### 日志级别

- `info` - 普通信息（蓝色）
- `warn` - 警告（黄色）
- `error` - 错误（红色）
- `success` - 成功（绿色）

## 功能特性

### 1. 搜索
在搜索框中输入关键词，实时过滤日志内容，匹配文本会高亮显示。

### 2. 复制
点击"复制"按钮，将当前显示的所有日志复制到剪贴板（包含时间戳和级别）。

### 3. 清空
点击"清空"按钮，清除所有历史日志。

### 4. 自动滚动
- 默认开启：新日志自动滚动到底部
- 可切换：点击箭头图标禁用/启用

## 集成示例

### compile-panel.tsx
```typescript
import { useConsoleStore } from '@/lib/console-store';

const CompilePanel = () => {
  const { addLog } = useConsoleStore();
  
  const handleCompile = async () => {
    addLog('开始编译...', 'info');
    
    try {
      const result = await compilerService.compile(files, args);
      if (result.code === 0) {
        addLog(`编译成功: ${result.output}`, 'success');
      } else {
        addLog(`编译失败: ${result.error}`, 'error');
      }
    } catch (error) {
      addLog(`编译异常: ${error.message}`, 'error');
    }
  };
};
```

### deploy-panel.tsx
```typescript
const handleDeploy = async () => {
  addLog('开始部署合约...', 'info');
  
  try {
    const txHash = await sendTransaction();
    addLog(`部署成功! TxHash: ${txHash}`, 'success');
  } catch (error) {
    addLog(`部署失败: ${error.message}`, 'error');
  }
};
```

## API 文档

### useConsoleStore()

返回的方法：

- `addLog(message: string, level?: LogLevel)` - 添加日志
- `clearLogs()` - 清空所有日志
- `setSearchTerm(term: string)` - 设置搜索词
- `setAutoScroll(enabled: boolean)` - 设置自动滚动
- `getFilteredLogs()` - 获取过滤后的日志

返回的状态：

- `logs: LogEntry[]` - 所有日志
- `searchTerm: string` - 当前搜索词
- `autoScroll: boolean` - 自动滚动状态
