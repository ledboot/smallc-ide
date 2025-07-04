"use client";

import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import FileExplorer from "@/components/file-explorer";
import Editor from "@/components/editor";
import type { FileType } from "@/lib/types";
import { Loader2 } from "lucide-react";
import Sidebar, { type SidebarTab } from "@/components/sidebar";
import DeployPanel from "@/components/deploy-panel";
import DebugPanel from "@/components/debug-panel";
import SearchPanel from "@/components/search-panel";
import SettingsPanel from "@/components/settings-panel";
import CompilePanel from "@/components/compile-panel";
import { initWasmCompiler } from "@/lib/wasm-compiler";
import ConsolePanel, { ConsolePanelRef } from "@/components/console-panel";

export default function SmallcIDE() {
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<FileType[]>([]);
  const [currentFile, setCurrentFile] = useState<FileType | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("files");
  const consoleRef = useRef<ConsolePanelRef>(null);

  useEffect(() => {
    const initialize = async () => {
      await initWasmCompiler();
      setIsLoading(false);
    };

    initialize();
  }, []);

  const renderSidebarContent = () => {
    switch (activeSidebarTab) {
      case "files":
        return (
          <FileExplorer
            files={files}
            setFiles={setFiles}
            currentFile={currentFile}
            setCurrentFile={setCurrentFile}
          />
        );
      case "search":
        return <SearchPanel files={files} onFileSelect={setCurrentFile} />;
      case "git":
        return (
          <div className="p-4 text-center text-muted-foreground">
            <p>Git integration coming soon</p>
          </div>
        );
      case "compile":
        return (
          <CompilePanel
            files={files}
          />
        );
      case "deploy":
        return <DeployPanel files={files} currentFile={currentFile} />;
      case "debug":
        return <DebugPanel files={files} currentFile={currentFile} />;
      case "settings":
        return <SettingsPanel />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading SmallC IDE...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center border-b px-4 lg:px-6">
        <h1 className="text-lg font-semibold">SmallC IDE Web</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm">
            Connect Wallet
          </Button>
          <Button size="sm">Deploy</Button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
        />
        <aside className="w-80 border-r bg-muted/40 overflow-auto">
          {renderSidebarContent()}
        </aside>
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-auto">
            {currentFile ? (
              <Editor
                file={currentFile}
                updateFile={(content) => {
                  const updatedFiles = files.map((f) =>
                    f.id === currentFile.id ? { ...f, content } : f
                  );
                  setFiles(updatedFiles);
                  setCurrentFile({ ...currentFile, content });
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <h3 className="text-lg font-medium mb-2">
                    Welcome to Remix IDE Web
                  </h3>
                  <p>Select or create a file to start coding</p>
                </div>
              </div>
            )}
          </div>
          <Separator />
          <div className="h-1/3 min-h-[200px] overflow-auto">
            <Tabs defaultValue="console" className="rounded-none">
              <TabsList className="px-4 pt-2">
                <TabsTrigger value="console">Console</TabsTrigger>
                <TabsTrigger value="testing">Testing</TabsTrigger>
              </TabsList>
              <TabsContent value="console">
                <ConsolePanel ref={consoleRef} />
              </TabsContent>
              <TabsContent value="testing" className="p-4">
                <div className="text-center text-muted-foreground">
                  Testing functionality will be implemented soon
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
