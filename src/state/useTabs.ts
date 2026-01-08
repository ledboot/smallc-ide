import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {FileType} from '@/types';
import {HOME_TAB} from '@/constants';

interface TabsStore {
  currentFile: FileType;
  openTabs: FileType[];
  activeTab: FileType;
  _persistedTabIds?: {
    currentFileId?: string;
    openTabIds: string[];
  };

  // Actions
  handleOpenFile: (file: FileType | null) => void;
  handleCloseTab: (fileId: string) => void;
  handleSwitchTab: (file: FileType) => void;
  setOpenTabs: (tabs: FileType[]) => void;
  setCurrentFile: (file: FileType) => void;
  setActiveTab: (file: FileType) => void;
  cleanupInvalidTabs: (validFileIds: string[]) => void;
  restoreTabsFromIds: (files: FileType[]) => void;
}

export const useTabsStore = create<TabsStore>()(
  persist(
    (set, get) => ({
      currentFile: HOME_TAB,
      openTabs: [HOME_TAB],
      activeTab: HOME_TAB,

      setOpenTabs: tabs => set({openTabs: tabs}),

      setCurrentFile: file => set({currentFile: file}),

      setActiveTab: file => set({activeTab: file}),

      handleOpenFile: file => {
        const {openTabs} = get();
        if (!file) {
          set({currentFile: HOME_TAB, activeTab: HOME_TAB});
          return;
        }

        // Check if file is already open in a tab
        const existingTab = openTabs.find(tab => tab.id === file.id);

        if (existingTab) {
          // Switch to existing tab
          set({currentFile: file, activeTab: file});
        } else {
          // Open in new tab
          set({
            openTabs: [...openTabs, file],
            currentFile: file,
            activeTab: file,
          });
        }
      },

      handleCloseTab: fileId => {
        const {openTabs, currentFile} = get();
        const tabIndex = openTabs.findIndex(tab => tab.id === fileId);
        if (tabIndex === -1) return;

        const newTabs = openTabs.filter(tab => tab.id !== fileId);

        // If closing the active tab, switch to another tab
        if (currentFile?.id === fileId) {
          if (newTabs.length > 0) {
            // Switch to the previous tab, or the first tab if closing the first one
            const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
            set({
              openTabs: newTabs,
              currentFile: newTabs[newActiveIndex] || HOME_TAB,
            });
          } else {
            // No tabs left, fallback to home
            const updatedTabs = [HOME_TAB];
            set({
              openTabs: updatedTabs,
              currentFile: HOME_TAB,
            });
          }
        } else {
          set({openTabs: newTabs});
        }
      },

      handleSwitchTab: file => {
        set({currentFile: file});
      },

      cleanupInvalidTabs: validFileIds => {
        const {openTabs, currentFile} = get();
        const validFileIdsSet = new Set([HOME_TAB.id, ...validFileIds]);

        // Filter out tabs for files that no longer exist
        const validTabs = openTabs.filter(tab => validFileIdsSet.has(tab.id));

        // If no valid tabs remain, add HOME_TAB
        const newTabs = validTabs.length > 0 ? validTabs : [HOME_TAB];

        // Check if current file is still valid
        const isCurrentFileValid = validFileIdsSet.has(currentFile.id);
        const newCurrentFile = isCurrentFileValid
          ? currentFile
          : newTabs[0] || HOME_TAB;

        // Only update if something changed
        if (
          openTabs.length !== newTabs.length ||
          currentFile.id !== newCurrentFile.id
        ) {
          set({
            openTabs: newTabs,
            currentFile: newCurrentFile,
            activeTab: newCurrentFile,
          });
        }
      },

      restoreTabsFromIds: files => {
        const {_persistedTabIds} = get();
        if (!_persistedTabIds) return;

        const fileMap = new Map(files.map(f => [f.id, f]));
        const {currentFileId, openTabIds} = _persistedTabIds;

        // Restore open tabs from IDs, always include HOME_TAB
        const restoredTabs = [HOME_TAB];
        openTabIds.forEach(id => {
          if (id !== HOME_TAB.id) {
            const file = fileMap.get(id);
            if (file) {
              restoredTabs.push(file);
            }
          }
        });

        // Restore current file
        let restoredCurrentFile = HOME_TAB;
        if (currentFileId) {
          const file = fileMap.get(currentFileId);
          if (file) {
            restoredCurrentFile = file;
          }
        }

        set({
          openTabs: restoredTabs,
          currentFile: restoredCurrentFile,
          activeTab: restoredCurrentFile,
        });
      },
    }),
    {
      name: 'tabs-storage',
      partialize: state => ({
        currentFileId: state.currentFile?.id,
        openTabIds: state.openTabs.map(tab => tab.id),
      }),
      merge: (persistedState: any, currentState) => {
        // We'll restore the actual file objects when files are loaded
        // For now, just return the current state
        return {
          ...currentState,
          _persistedTabIds: {
            currentFileId: persistedState?.currentFileId,
            openTabIds: persistedState?.openTabIds || [],
          },
        };
      },
    },
  ),
);
