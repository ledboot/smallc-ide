import {create} from 'zustand';
import {persist} from 'zustand/middleware';
import type {FileType} from '@/types';
import {getAllFiles} from '@/lib/db';

interface FileStore {
  files: FileType[];
  isLoading: boolean;
  error: string | null;
  expandedFolders: Set<string>;
  // Actions
  setFiles: (files: FileType[]) => void;
  refreshFiles: () => Promise<void>;
  addFile: (file: FileType) => void;
  updateFile: (file: FileType) => void;
  removeFile: (fileId: string) => void;
  toggleFolder: (folderId: string) => void;
  setExpandedFolders: (folders: Set<string>) => void;
}

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      files: [],
      isLoading: false,
      error: null,
      expandedFolders: new Set<string>(),

      setFiles: files => set({files}),

      refreshFiles: async () => {
        set({isLoading: true, error: null});
        try {
          const files = await getAllFiles();
          // Deduplicate files by ID just in case
          const uniqueFiles = Array.from(
            new Map(files.map(f => [f.id, f])).values(),
          );
          set({files: uniqueFiles, isLoading: false});
          console.log('Files refreshed:', uniqueFiles.length);
        } catch (error) {
          console.error('Failed to refresh files:', error);
          set({
            error:
              error instanceof Error ? error.message : 'Failed to fetch files',
            isLoading: false,
          });
        }
      },

      addFile: file =>
        set(state => {
          // Check if file already exists
          if (state.files.some(f => f.id === file.id)) {
            return state;
          }
          return {files: [...state.files, file]};
        }),

      updateFile: file =>
        set(state => ({
          files: state.files.map(f => (f.id === file.id ? file : f)),
        })),

      removeFile: fileId =>
        set(state => ({
          files: state.files.filter(f => f.id !== fileId),
        })),

      toggleFolder: folderId =>
        set(state => {
          const newSet = new Set(state.expandedFolders);
          if (newSet.has(folderId)) {
            newSet.delete(folderId);
          } else {
            newSet.add(folderId);
          }
          return {expandedFolders: newSet};
        }),

      setExpandedFolders: folders => set({expandedFolders: folders}),
    }),
    {
      name: 'file-storage',
      partialize: state => ({
        expandedFolders: Array.from(state.expandedFolders),
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        expandedFolders: new Set(persistedState?.expandedFolders || []),
      }),
    },
  ),
);
