import type { FileType } from "./types";
import {
  writeFileToMemFS,
  deleteFileFromMemFS,
  isWasmReady,
  readFileFromMemFS,
} from "./wasm-compiler";

const DB_NAME = "smallc-ide-db";
const STORE_NAME = "files";
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve();
      return;
    }

    if (!window.indexedDB) {
      reject(new Error("Your browser doesn't support IndexedDB"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      reject(new Error("Failed to open database"));
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

export const saveFile = async (file: FileType): Promise<void> => {
  await initDB();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file);

    request.onsuccess = () => {
      // Try to write to MEMFS, but don't fail if it's not available
      try {
        if (isWasmReady()) {
          writeFileToMemFS(file.name, file.content);
        }
      } catch (error) {
        console.warn("Failed to write to MEMFS:", error);
      }
      resolve();
    };

    request.onerror = () => reject(new Error("Failed to save file"));
  });
};

export const saveFileToIndexedDBOnly = async (file: FileType): Promise<void> => {
  await initDB();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("Failed to save file"));
  });
};

export const getFile = async (id: string): Promise<FileType> => {
  await initDB();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        reject(new Error("File not found"));
      }
    };

    request.onerror = () => reject(new Error("Failed to get file"));
  });
};

export const getAllFiles = async (): Promise<FileType[]> => {
  await initDB();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const files = request.result;

      // Try to write all files to MEMFS if available
      if (isWasmReady()) {
        files.forEach((file) => {
          try {
            writeFileToMemFS(file.name, file.content);
          } catch (error) {
            console.warn(`Failed to write ${file.name} to MEMFS:`, error);
          }
        });
      }

      resolve(files);
    };

    request.onerror = () => reject(new Error("Failed to get files"));
  });
};

export const deleteFile = async (id: string): Promise<void> => {
  await initDB();
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    // 先获取文件名用于从MEMFS删除
    const getTransaction = db.transaction([STORE_NAME], "readonly");
    const getStore = getTransaction.objectStore(STORE_NAME);
    const getRequest = getStore.get(id);

    getRequest.onsuccess = () => {
      const file = getRequest.result;

      // 从IndexedDB删除
      const deleteTransaction = db.transaction([STORE_NAME], "readwrite");
      const deleteStore = deleteTransaction.objectStore(STORE_NAME);
      const deleteRequest = deleteStore.delete(id);

      deleteRequest.onsuccess = () => {
        // 同时从MEMFS删除
        if (file && isWasmReady()) {
          try {
            deleteFileFromMemFS(file.name);
          } catch (error) {
            console.warn("Failed to delete from MEMFS:", error);
          }
        }
        resolve();
      };

      deleteRequest.onerror = () => reject(new Error("Failed to delete file"));
    };

    getRequest.onerror = () =>
      reject(new Error("Failed to get file for deletion"));
  });
};

export const getFileFromMemFS = async (filename: string): Promise<FileType> => {
  console.log("getFileFromMemFS", filename);
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database not initialized"));
      return;
    }

    const content = readFileFromMemFS(filename);
    if (!content) {
      reject(new Error("File not found in MEMFS"));
      return;
    }
    const newFile: FileType = {
      id: filename.split("/").pop() || filename,
      name: filename.split("/").pop() || filename,
      content: content,
      lastModified: new Date().toISOString(),
    };
    console.log("newFile", newFile);

    resolve(newFile);
  });
};
