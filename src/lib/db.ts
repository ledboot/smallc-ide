import type {FileType} from './types';
import {joinPath, getParentPath, getFileName} from './path-utils';
import {getFS} from './fs';

/**
 * Initialize the file system
 */
export const initDB = async (): Promise<void> => {
  await getFS();
};

/**
 * Save a file to the file system
 */
export const saveFile = async (file: FileType): Promise<void> => {
  const fs = await getFS();
  const path = file.path || file.name;

  // Ensure parent directory exists
  const parentPath = getParentPath(path);
  if (parentPath) {
    await ensureDir(parentPath);
  }

  await fs.extended.writeFile(path, file.content, 'utf8');
};

/**
 * Alias for saveFile
 */
export const saveFileToIndexedDBOnly = async (
  file: FileType,
): Promise<void> => {
  return saveFile(file);
};

/**
 * Get a file from the file system
 */
export const getFile = async (id: string): Promise<FileType> => {
  const fs = await getFS();
  const content = await fs.extended.readFile(id, 'utf8');
  const stat = await fs.extended.stat(id);

  return {
    id,
    name: getFileName(id),
    content:
      typeof content === 'string' ? content : new TextDecoder().decode(content),
    lastModified: new Date(stat.mtimeMs).toISOString(),
    isDirectory: stat.isDirectory(),
    path: id,
  };
};

/**
 * Get all files recursively
 */
export const getAllFiles = async (): Promise<FileType[]> => {
  const fs = await getFS();
  const files: FileType[] = [];

  async function traverse(dirPath: string = '/'): Promise<void> {
    try {
      const entries = await fs.extended.readdir(dirPath);

      for (const entry of entries) {
        const fullPath = dirPath === '/' ? `/${entry}` : `${dirPath}/${entry}`;
        const stat = await fs.extended.stat(fullPath);

        if (stat.isDirectory()) {
          files.push({
            id: fullPath,
            name: entry,
            content: '',
            lastModified: new Date(stat.mtimeMs).toISOString(),
            isDirectory: true,
            path: fullPath,
          });
          await traverse(fullPath);
        } else {
          const content = await fs.extended.readFile(fullPath, 'utf8');
          files.push({
            id: fullPath,
            name: entry,
            content:
              typeof content === 'string'
                ? content
                : new TextDecoder().decode(content),
            lastModified: new Date(stat.mtimeMs).toISOString(),
            isDirectory: false,
            path: fullPath,
          });
        }
      }
    } catch (e) {
      // Directory doesn't exist or is empty
      console.warn(`Error traversing ${dirPath}:`, e);
    }
  }

  await traverse('/');
  return files;
};

/**
 * Delete a file
 */
export const deleteFile = async (id: string): Promise<void> => {
  const fs = await getFS();
  await fs.extended.unlink(id);
};

/**
 * Create a folder
 */
export const createFolder = async (path: string): Promise<void> => {
  const fs = await getFS();

  // Ensure parent directories exist
  const parentPath = getParentPath(path);
  if (parentPath) {
    await ensureDir(parentPath);
  }

  // Check if directory already exists
  const exists = await fs.extended.exists(path);
  if (exists) {
    return;
  }

  await fs.extended.mkdir(path);
};

/**
 * Rename a file or folder
 */
export const renameFile = async (
  oldPath: string,
  newPath: string,
): Promise<void> => {
  const fs = await getFS();
  await fs.extended.rename(oldPath, newPath);
};

/**
 * Delete a folder and all its contents recursively
 */
export const deleteFolder = async (path: string): Promise<void> => {
  const fs = await getFS();

  async function deleteDirRecursive(dirPath: string): Promise<void> {
    const entries = await fs.extended.readdir(dirPath);

    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry}`;
      const stat = await fs.extended.stat(fullPath);

      if (stat.isDirectory()) {
        await deleteDirRecursive(fullPath);
      } else {
        await fs.extended.unlink(fullPath);
      }
    }

    await fs.extended.rmdir(dirPath);
  }

  await deleteDirRecursive(path);
};

/**
 * Get files in a specific folder (non-recursive)
 */
export const getFilesByPath = async (
  folderPath: string,
): Promise<FileType[]> => {
  const fs = await getFS();
  const files: FileType[] = [];

  try {
    const entries = await fs.extended.readdir(folderPath || '/');

    for (const entry of entries) {
      const fullPath =
        folderPath === '/' || !folderPath
          ? `/${entry}`
          : `${folderPath}/${entry}`;
      const stat = await fs.extended.stat(fullPath);

      if (stat.isDirectory()) {
        files.push({
          id: fullPath,
          name: entry,
          content: '',
          lastModified: new Date(stat.mtimeMs).toISOString(),
          isDirectory: true,
          path: fullPath,
        });
      } else {
        const content = await fs.extended.readFile(fullPath, 'utf8');
        files.push({
          id: fullPath,
          name: entry,
          content:
            typeof content === 'string'
              ? content
              : new TextDecoder().decode(content),
          lastModified: new Date(stat.mtimeMs).toISOString(),
          isDirectory: false,
          path: fullPath,
        });
      }
    }
  } catch (e) {
    // Directory doesn't exist
    console.warn(`Error reading ${folderPath}:`, e);
  }

  return files;
};

/**
 * Build a tree structure from the file system
 */
export const buildFileTree = async (): Promise<FileType[]> => {
  const fs = await getFS();

  async function buildTree(dirPath: string = '/'): Promise<FileType[]> {
    const items: FileType[] = [];

    try {
      const entries = await fs.extended.readdir(dirPath);

      for (const entry of entries) {
        const fullPath = dirPath === '/' ? `/${entry}` : `${dirPath}/${entry}`;
        const stat = await fs.extended.stat(fullPath);

        if (stat.isDirectory()) {
          const children = await buildTree(fullPath);
          items.push({
            id: fullPath,
            name: entry,
            content: '',
            lastModified: new Date(stat.mtimeMs).toISOString(),
            isDirectory: true,
            path: fullPath,
            children,
          });
        } else {
          const content = await fs.extended.readFile(fullPath, 'utf8');
          items.push({
            id: fullPath,
            name: entry,
            content:
              typeof content === 'string'
                ? content
                : new TextDecoder().decode(content),
            lastModified: new Date(stat.mtimeMs).toISOString(),
            isDirectory: false,
            path: fullPath,
          });
        }
      }
    } catch (e) {
      // Directory doesn't exist or is empty
      console.warn(`Error building tree for ${dirPath}:`, e);
    }

    return items;
  }

  return buildTree('/');
};

/**
 * Ensure a directory exists (create if it doesn't)
 */
async function ensureDir(path: string): Promise<void> {
  const fs = await getFS();

  // Split path and create each segment
  const segments = path.split('/').filter(s => s);
  let currentPath = '';

  for (const segment of segments) {
    currentPath += '/' + segment;
    const exists = await fs.extended.exists(currentPath);
    if (!exists) {
      await fs.extended.mkdir(currentPath);
    }
  }
}
