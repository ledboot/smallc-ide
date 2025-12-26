import {create} from 'zustand';
import {useSettingsStore} from './useSettings';

export type AppState = {
  settings: ReturnType<typeof useSettingsStore.getState>;
};

export const useRootStore = create<AppState>()(() => ({
  settings: useSettingsStore.getState(),
}));
