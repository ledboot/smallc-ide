import {create} from 'zustand';

interface DeployState {
  selectedFileId: string | null;
  setSelectedFileId: (id: string | null) => void;
}

export const useDeployStore = create<DeployState>(set => ({
  selectedFileId: null,
  setSelectedFileId: (id: string | null) => set({selectedFileId: id}),
}));
