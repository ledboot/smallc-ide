import React, { useRef, useImperativeHandle, useState, forwardRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ConsolePanelRef {
  appendLog: (text: string) => void;
  clear: () => void;
}

const ConsolePanel = forwardRef<ConsolePanelRef>((props, ref) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    appendLog: (text: string) => {
      setLogs((prev) => [...prev, ...text.split("\n")]);
    },
    clear: () => setLogs([]),
  }));

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const highlight = (line: string) => {
    if (!search) return line;
    const parts = line.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === search.toLowerCase() ? (
        <span key={i} className="bg-yellow-300 text-black">{part}</span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <Input
          placeholder="查找..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-40"
        />
        <Button variant="outline" size="sm" onClick={() => setLogs([])}>
          清除
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-black text-green-300 rounded p-2 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-muted-foreground">无输出</div>
        ) : (
          logs.map((line, idx) => (
            <div key={idx}>{highlight(line)}</div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
});

ConsolePanel.displayName = "ConsolePanel";
export default ConsolePanel; 