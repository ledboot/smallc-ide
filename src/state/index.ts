import {create} from 'zustand';
import {settingsStore} from './settings';

export type AppState = {
  settings: ReturnType<typeof settingsStore.getState>;
};

export const useRootStore = create<AppState>()(() => ({
  settings: settingsStore.getState(),
}));
