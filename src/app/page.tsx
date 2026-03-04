'use client';

import {useEffect, useState, useRef} from 'react';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Button} from '@/components/ui/button';
import FileExplorer from '@/components/fileExplorer';
import dynamic from 'next/dynamic';
import {HOME_TAB} from '@/constants';

const Editor = dynamic(() => import('@/components/editor'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
});

import type {FileType} from '@/types';
import {Loader2, X, ChevronUp} from 'lucide-react';
import Sidebar, {type SidebarTab} from '@/components/sidebar';
import DeployPanel from '@/components/deployPanel';
import DebugPanel from '@/components/debugPanel';
import SearchPanel from '@/components/searchPanel';
import SettingsPanel from '@/components/settingsPanel';
import CompilePanel from '@/components/compilePanel';
import {initWasmCompiler} from '@/lib/wasm-compiler';
import ConsolePanel from '@/components/consolePanel';
import DebugControlPanel from '@/components/debugControlPanel';
import EditorTabs from '@/components/editorTabs';
import Header from '@/components/header';
import {useTabsStore} from '@/state/useTabs';
import {useFileStore} from '@/state/useFile';

export default function SmallcIDE() {
  const [isLoading, setIsLoading] = useState(true);
  const {files, setFiles, refreshFiles} = useFileStore();
  const {
    currentFile,
    openTabs,
    handleOpenFile,
    handleCloseTab,
    handleSwitchTab,
    cleanupInvalidTabs,
    restoreTabsFromIds,
  } = useTabsStore();
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('files');

  // Sidebar State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const isResizingRef = useRef(false);
  const hasRestoredTabsRef = useRef(false);

  // compile result cache, key is file name
  // compile result cache handled by useCompilerStore now

  useEffect(() => {
    const initialize = async () => {
      await initWasmCompiler();
      await refreshFiles();
      setIsLoading(false);
    };

    initialize();
  }, [refreshFiles]);

  // Restore tabs only once when files are loaded
  useEffect(() => {
    if (files.length > 0 && !hasRestoredTabsRef.current) {
      hasRestoredTabsRef.current = true;

      // Restore tabs from persisted IDs
      restoreTabsFromIds(files);

      // Clean up tabs for files that no longer exist
      const validFileIds = files.map(f => f.id);
      cleanupInvalidTabs(validFileIds);
    }
  }, [files, restoreTabsFromIds, cleanupInvalidTabs]);

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

  const renderSidebarContent = () => {
    switch (activeSidebarTab) {
      case 'files':
        return (
          <FileExplorer
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
                  useTabsStore.getState().setOpenTabs(newTabs);

                  if (currentFile && idsToClose.has(currentFile.id)) {
                    if (newTabs.length > 0) {
                      useTabsStore
                        .getState()
                        .setCurrentFile(
                          newTabs[newTabs.length - 1] || HOME_TAB,
                        );
                    } else {
                      // Fallback to home
                      useTabsStore.getState().setOpenTabs([HOME_TAB]);
                      useTabsStore.getState().setCurrentFile(HOME_TAB);
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
        return <SearchPanel />;
      case 'compile':
        return <CompilePanel />;
      case 'deploy':
        return <DeployPanel />;
      case 'debug':
        return <DebugPanel />;
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
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeSidebarTab}
          onTabChange={setActiveSidebarTab}
        />
        <aside
          className="border-r bg-muted/40 overflow-auto shrink-0"
          style={{width: sidebarWidth}}
        >
          {renderSidebarContent()}
        </aside>

        {/* Resize Handle */}
        <div
          className="w-1 hover:bg-primary/50 cursor-col-resize shrink-0 transition-colors"
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
                <Editor key={currentFile?.id || 'home'} />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
          </div>
          {isConsoleOpen ? (
            <div className="h-1/3 min-h-50 flex flex-col border-t">
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
                      value="debug"
                      className="ml-1 data-[state=active]:bg-secondary rounded-none h-9 px-4"
                    >
                      Debug
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
                    value="debug"
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <DebugControlPanel />
                  </TabsContent>
                  <TabsContent
                    value="console"
                    className="h-full m-0 data-[state=inactive]:hidden"
                  >
                    <ConsolePanel />
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
