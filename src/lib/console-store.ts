import {create} from 'zustand';

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SUCCESS = 'success',
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

interface ConsoleStore {
  logs: LogEntry[];
  searchTerm: string;
  autoScroll: boolean;

  addLog: (message: string, level?: LogLevel) => void;
  clearLogs: () => void;
  setSearchTerm: (term: string) => void;
  setAutoScroll: (enabled: boolean) => void;
  getFilteredLogs: () => LogEntry[];
}

export const useConsoleStore = create<ConsoleStore>((set, get) => ({
  logs: [],
  searchTerm: '',
  autoScroll: true,

  addLog: (message: string, level: LogLevel = LogLevel.INFO) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      message,
    };

    set(state => ({
      logs: [...state.logs, newLog],
    }));
  },

  clearLogs: () => set({logs: []}),

  setSearchTerm: (term: string) => set({searchTerm: term}),

  setAutoScroll: (enabled: boolean) => set({autoScroll: enabled}),

  getFilteredLogs: () => {
    const {logs, searchTerm} = get();
    if (!searchTerm) return logs;

    return logs.filter(log =>
      log.message.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  },
}));
