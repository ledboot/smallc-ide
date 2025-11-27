"use client";

import { useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { FileType } from "@/lib/types";

interface EditorTabsProps {
  openTabs: FileType[];
  currentFile: FileType | null;
  onTabClick: (file: FileType) => void;
  onTabClose: (fileId: string) => void;
}

export default function EditorTabs({
  openTabs,
  currentFile,
  onTabClick,
  onTabClose,
}: EditorTabsProps) {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (activeTabRef.current && tabsContainerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentFile?.id]);

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="border-b bg-muted/30">
      <div
        ref={tabsContainerRef}
        className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
        style={{
          scrollbarWidth: "thin",
        }}
      >
        {openTabs.map((file) => {
          const isActive = currentFile?.id === file.id;
          return (
            <div
              key={file.id}
              ref={isActive ? activeTabRef : null}
              className={`
                group flex items-center gap-2 px-4 py-2 text-sm border-r cursor-pointer
                transition-colors duration-150 flex-shrink-0 min-w-[120px] max-w-[200px]
                ${
                  isActive
                    ? "bg-background text-foreground border-b-2 border-b-primary"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
              onClick={() => onTabClick(file)}
            >
              <span className="truncate flex-1" title={file.name}>
                {file.name}
              </span>
              <button
                className={`
                  rounded-sm p-0.5 hover:bg-muted-foreground/20 transition-colors
                  ${
                    isActive
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(file.id);
                }}
                title="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 3px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.3);
        }
      `}</style>
    </div>
  );
}
