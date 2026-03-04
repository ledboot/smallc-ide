import LightningFS from '@isomorphic-git/lightning-fs';

/**
 * IndexedDB-backed file system using lightning-fs
 * Based on Remix Project's implementation
 */
export class IndexedDBStorage extends LightningFS {
  base: LightningFS.PromisifiedFS;
  extended: {
    exists: (path: string) => Promise<boolean>;
    rmdir: (path: string) => Promise<void>;
    readdir: (path: string) => Promise<string[]>;
    unlink: (path: string) => Promise<void>;
    mkdir: (path: string) => Promise<void>;
    readFile: (path: string, options?: any) => Promise<Uint8Array | string>;
    rename: (from: string, to: string) => Promise<void>;
    writeFile: (path: string, content: any, options?: any) => Promise<void>;
    stat: (path: string) => Promise<any>;
  };

  constructor(name: string = 'SmallCFileSystem') {
    super(name);
    this.base = this.promises;

    // Helper to ensure paths start with '/'
    const addSlash = (file: string) => {
      if (!file.startsWith('/')) file = '/' + file;
      return file;
    };

    // Extended API with path normalization
    this.extended = {
      exists: async (path: string) => {
        return new Promise(resolve => {
          this.base
            .stat(addSlash(path))
            .then(() => resolve(true))
            .catch(() => resolve(false));
        });
      },
      rmdir: async (path: string) => {
        return this.base.rmdir(addSlash(path));
      },
      readdir: async (path: string) => {
        return this.base.readdir(addSlash(path));
      },
      unlink: async (path: string) => {
        return this.base.unlink(addSlash(path));
      },
      mkdir: async (path: string) => {
        return this.base.mkdir(addSlash(path));
      },
      readFile: async (path: string, options?: any) => {
        return this.base.readFile(addSlash(path), options);
      },
      rename: async (from: string, to: string) => {
        return this.base.rename(addSlash(from), addSlash(to));
      },
      writeFile: async (path: string, content: any, options?: any) => {
        return this.base.writeFile(addSlash(path), content, options);
      },
      stat: async (path: string) => {
        return this.base.stat(addSlash(path));
      },
    };
  }

  /**
   * Initialize the file system
   */
  override async init(): Promise<void> {
    // Ensure root directory exists
    try {
      await this.extended.stat('/');
    } catch (e) {
      // Root should always exist, but just in case
      console.warn('Root directory check failed:', e);
    }
  }
}

// Singleton instance
let fsInstance: IndexedDBStorage | null = null;

/**
 * Get or create the file system instance
 */
export const getFS = async (): Promise<IndexedDBStorage> => {
  if (!fsInstance) {
    fsInstance = new IndexedDBStorage('SmallCFileSystem');
    await fsInstance.init();
  }
  return fsInstance;
};

/**
 * Test if IndexedDB is available
 */
export const testIndexedDB = async (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('No indexedDB on window'));
      return;
    }
    const request = window.indexedDB.open('SmallCTestDB');
    request.onerror = () => {
      reject(new Error('Error creating test database'));
    };
    request.onsuccess = () => {
      window.indexedDB.deleteDatabase('SmallCTestDB');
      resolve(true);
    };
  });
};
