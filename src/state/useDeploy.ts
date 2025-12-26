import {create} from 'zustand';

interface DeployState {
  privateKey: string;
  utxo: string;
  utxoValueStr: string;
  selectedFileId: string | null;

  setPrivateKey: (key: string) => void;
  setUtxo: (utxo: string) => void;
  setUtxoValueStr: (value: string) => void;
  setSelectedFileId: (id: string | null) => void;
}

export const useDeployStore = create<DeployState>(set => ({
  privateKey: '',
  utxo: '',
  utxoValueStr: '',
  selectedFileId: null,

  setPrivateKey: (key: string) => set({privateKey: key}),
  setUtxo: (utxo: string) => set({utxo: utxo}),
  setUtxoValueStr: (value: string) => set({utxoValueStr: value}),
  setSelectedFileId: (id: string | null) => set({selectedFileId: id}),
}));
