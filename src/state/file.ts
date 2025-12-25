import {create} from 'zustand';
import type {FileType} from '@/lib/types';
import {getAllFiles} from '@/lib/db';

interface FileStore {
  files: FileType[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setFiles: (files: FileType[]) => void;
  refreshFiles: () => Promise<void>;
  addFile: (file: FileType) => void;
  updateFile: (file: FileType) => void;
  removeFile: (fileId: string) => void;
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  isLoading: false,
  error: null,

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
        error: error instanceof Error ? error.message : 'Failed to fetch files',
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
}));
