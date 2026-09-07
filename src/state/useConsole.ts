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

  addLog: (message?: any, ...optionalParams: any[]) => void;
  clearLogs: () => void;
  setSearchTerm: (term: string) => void;
  setAutoScroll: (enabled: boolean) => void;
  getFilteredLogs: () => LogEntry[];
}

export const useConsoleStore = create<ConsoleStore>((set, get) => ({
  logs: [],
  searchTerm: '',
  autoScroll: true,

  addLog: (message?: any, ...optionalParams: any[]) => {
    // Combine arguments
    const args = [message, ...optionalParams].filter(arg => arg !== undefined);

    let level = LogLevel.INFO;

    // Simplified logic: If last arg is a LogLevel, pop it and use it.
    if (args.length > 0) {
      const lastArg = args[args.length - 1];
      if (Object.values(LogLevel).includes(lastArg as LogLevel)) {
        level = args.pop(); // Remove the level from args, so args only contains messages
      }
    }

    const logMessage = args
      .map(m => {
        if (typeof m === 'string') return m;
        try {
          return JSON.stringify(m, null, 2);
        } catch {
          return String(m);
        }
      })
      .join(' ');

    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      level,
      message: logMessage,
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
