'use client';

import {useEffect, useState, useRef} from 'react';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Button} from '@/components/ui/button';
import FileExplorer from '@/components/file-explorer';
import dynamic from 'next/dynamic';
import {HOME_TAB} from '@/lib/constants';

const Editor = dynamic(() => import('@/components/editor'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

import type {FileType} from '@/lib/types';
import {Loader2, X, ChevronUp} from 'lucide-react';
import Sidebar, {type SidebarTab} from '@/components/sidebar';
import DeployPanel from '@/components/deploy-panel';
import DebugPanel from '@/components/debug-panel';
import SearchPanel from '@/components/search-panel';
import SettingsPanel from '@/components/settings-panel';
import CompilePanel from '@/components/compile-panel';
import {initWasmCompiler} from '@/lib/wasm-compiler';
import ConsolePanel from '@/components/console-panel';
import EditorTabs from '@/components/editor-tabs';

export default function SmallcIDE() {
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<FileType[]>([]);
  const [currentFile, setCurrentFile] = useState<FileType | null>(HOME_TAB);
  const [openTabs, setOpenTabs] = useState<FileType[]>([HOME_TAB]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('files');

  // Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const isResizingRef = useRef(false);

  // compile result cache, key is file name
  // compile result cache handled by useCompilerStore now

  useEffect(() => {
    const initialize = async () => {
      await initWasmCompiler();
      setIsLoading(false);
    };

    initialize();
  }, []);

  // Sidebar resize logic
  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!isResizingRef.current) return;

      // 48px is the fixed width of the icon sidebar
      const newWidth = e.clientX - 48;
      // Min width 150px, Max width 800px
      if (newWidth >= 150 && newWidth <= 800) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = () => {
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Tab management functions
  const handleOpenFile = (file: FileType | null) => {
    if (!file) {
      setCurrentFile(null);
      return;
    }

    // Check if file is already open in a tab
    const existingTab = openTabs.find(tab => tab.id === file.id);

    if (existingTab) {
      // Switch to existing tab
      setCurrentFile(file);
    } else {
      // Open in new tab
      setOpenTabs(prev => [...prev, file]);
      setCurrentFile(file);
    }
  };

  const handleCloseTab = (fileId: string) => {
    const tabIndex = openTabs.findIndex(tab => tab.id === fileId);
    if (tabIndex === -1) return;

    const newTabs = openTabs.filter(tab => tab.id !== fileId);

    // If closing the active tab, switch to another tab
    if (currentFile?.id === fileId) {
      if (newTabs.length > 0) {
        // Switch to the previous tab, or the first tab if closing the first one
        const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
        setCurrentFile(newTabs[newActiveIndex] || HOME_TAB);
      } else {
        // No tabs left, fallback to home
        const updatedTabs = [HOME_TAB];
        setOpenTabs(updatedTabs);
        setCurrentFile(HOME_TAB);
        return;
      }
    }
    setOpenTabs(newTabs);
  };

  const handleSwitchTab = (file: FileType) => {
    setCurrentFile(file);
  };

  const renderSidebarContent = () => {
    switch (activeSidebarTab) {
      case 'files':
        return (
          <FileExplorer
            files={files}
            setFiles={setFiles}
            currentFile={currentFile}
            setCurrentFile={handleOpenFile}
            onFileDelete={file => {
              // If deleted file is currently open, close the tab
              if (file.isDirectory) {
                // For directory, close all tabs within that directory
                const tabsToClose = openTabs.filter(tab =>
                  tab.id.startsWith(file.id + '/'),
                );

                if (tabsToClose.length > 0) {
                  const idsToClose = new Set(tabsToClose.map(t => t.id));
                  const newTabs = openTabs.filter(
                    tab => !idsToClose.has(tab.id),
                  );
                  setOpenTabs(newTabs);

                  if (currentFile && idsToClose.has(currentFile.id)) {
                    if (newTabs.length > 0) {
                      setCurrentFile(newTabs[newTabs.length - 1] || HOME_TAB);
                    } else {
                      // Fallback to home
                      setOpenTabs([HOME_TAB]);
                      setCurrentFile(HOME_TAB);
                    }
                  }
                }
              } else {
                handleCloseTab(file.id);
              }
            }}
          />
        );
      case 'search':
        return <SearchPanel files={files} onFileSelect={handleOpenFile} />;
      case 'compile':
        return (
          <CompilePanel
            files={files}
            refreshFiles={async () => {
              const {getAllFiles} = await import('@/lib/db');
              const loadedFiles = await getAllFiles();
              setFiles(loadedFiles);
            }}
          />
        );
      case 'deploy':
        return <DeployPanel files={files} />;
      case 'debug':
        return <DebugPanel files={files} setCurrentFile={handleOpenFile} />;
      case 'settings':
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
        <aside
          className="border-r bg-muted/40 overflow-auto flex-shrink-0"
          style={{width: sidebarWidth}}
        >
          {renderSidebarContent()}
        </aside>

        {/* Resize Handle */}
        <div
          className="w-1 hover:bg-primary/50 cursor-col-resize flex-shrink-0 transition-colors"
          onMouseDown={startResizing}
        />

        <div className="flex flex-1 flex-col min-w-0">
          <div className="flex-1 overflow-auto flex flex-col">
            <EditorTabs
              openTabs={openTabs}
              currentFile={currentFile}
              onTabClick={handleSwitchTab}
              onTabClose={handleCloseTab}
            />
            {currentFile || openTabs.length > 0 ? (
              <div className="flex-1">
                <Editor
                  key={currentFile?.id || 'home'}
                  file={currentFile || HOME_TAB}
                  updateFile={(content: string) => {
                    if (currentFile?.id === 'home') return;
                    const updatedFiles = files.map(f =>
                      f.id === currentFile?.id ? {...f, content} : f,
                    );
                    setFiles(updatedFiles);
                    if (currentFile) {
                      setCurrentFile({...currentFile, content});
                    }

                    // Update the file in openTabs as well
                    setOpenTabs(prev =>
                      prev.map(tab =>
                        tab.id === currentFile?.id ? {...tab, content} : tab,
                      ),
                    );
                  }}
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
          {isConsoleOpen ? (
            <div className="h-1/3 min-h-[200px] flex flex-col border-t">
              <Tabs defaultValue="console" className="flex flex-col h-full">
                <div className="flex items-center justify-between bg-background px-4">
                  <TabsList className="p-0 bg-transparent mb-0 h-9">
                    <TabsTrigger
                      value="console"
                      className="data-[state=active]:bg-secondary rounded-none h-9 px-4"
                    >
                      Console
                    </TabsTrigger>
                    <TabsTrigger
                      value="testing"
                      className="ml-1 data-[state=active]:bg-secondary rounded-none  h-9 px-4"
                    >
                      Testing
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsConsoleOpen(false)}
                    title="Close Panel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  <TabsContent
                    value="console"
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <ConsolePanel />
                  </TabsContent>
                  <TabsContent
                    value="testing"
                    className="h-full m-0 p-4 overflow-auto data-[state=inactive]:hidden"
                  >
                    <div className="text-center text-muted-foreground">
                      Testing functionality will be implemented soon
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          ) : (
            <div className="flex justify-end border-t bg-background p-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={() => setIsConsoleOpen(true)}
              >
                <ChevronUp className="h-3 w-3" />
                Show Panel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
