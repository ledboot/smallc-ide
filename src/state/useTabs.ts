import {create} from 'zustand';
import type {FileType} from '@/types';
import {HOME_TAB} from '@/constants';

interface TabsStore {
  currentFile: FileType;
  openTabs: FileType[];
  activeTab: FileType;

  // Actions
  handleOpenFile: (file: FileType | null) => void;
  handleCloseTab: (fileId: string) => void;
  handleSwitchTab: (file: FileType) => void;
  setOpenTabs: (tabs: FileType[]) => void;
  setCurrentFile: (file: FileType) => void;
  setActiveTab: (file: FileType) => void;
}

export const useTabsStore = create<TabsStore>((set, get) => ({
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
}));
