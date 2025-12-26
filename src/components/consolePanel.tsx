'use client';

import {useEffect, useRef} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Trash2, Search, ChevronDown, ChevronUp} from 'lucide-react';
import {toast} from 'sonner';
import {useConsoleStore, type LogEntry} from '@/state/useConsole';
import {cn} from '@/utils';

const ConsolePanel = () => {
  const {
    logs,
    searchTerm,
    autoScroll,
    clearLogs,
    setSearchTerm,
    setAutoScroll,
    getFilteredLogs,
  } = useConsoleStore();

  const logEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredLogs = getFilteredLogs();

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({behavior: 'smooth'});
    }
  }, [logs, autoScroll]);

  const handleClear = () => {
    clearLogs();
    toast.success('日志已清空');
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
        return 'text-yellow-400';
      case 'success':
        return 'text-green-400';
      default:
        return 'text-gray-300';
    }
  };

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'bg-red-900/30 text-red-400';
      case 'warn':
        return 'bg-yellow-900/30 text-yellow-400';
      case 'success':
        return 'bg-green-900/30 text-green-400';
      default:
        return 'bg-blue-900/30 text-blue-400';
    }
  };

  const highlightSearch = (text: string) => {
    if (!searchTerm) return text;

    const parts = text.split(
      new RegExp(
        `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'gi',
      ),
    );
    return parts.map((part, i) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <span key={i} className="bg-yellow-500 text-black px-0.5">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* Header with controls */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索日志..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-8 h-8"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setAutoScroll(!autoScroll)}
          title={autoScroll ? '禁用自动滚动' : '启用自动滚动'}
        >
          {autoScroll ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleClear}
          disabled={logs.length === 0}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          清空
        </Button>

        <div className="text-xs text-muted-foreground ml-auto">
          {filteredLogs.length} / {logs.length} 条日志
        </div>
      </div>

      {/* Log display */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-black rounded-md p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-muted-foreground text-center py-8">
            {logs.length === 0 ? '暂无日志' : '没有匹配的日志'}
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className={cn(
                'py-1 hover:bg-gray-900/50 px-2 -mx-2 rounded',
                getLevelColor(log.level),
              )}
            >
              <span className="text-gray-500 mr-2">
                {log.timestamp.toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  'inline-block px-1.5 py-0.5 rounded text-[10px] mr-2',
                  getLevelBadge(log.level),
                )}
              >
                {log.level.toUpperCase()}
              </span>
              <span>{highlightSearch(log.message)}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default ConsolePanel;
