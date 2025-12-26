// Path utility functions for file system operations

/**
 * Join path segments into a single path
 */
export const joinPath = (...segments: string[]): string => {
  return segments
    .filter(s => s && s !== '/')
    .join('/')
    .replace(/\/+/g, '/');
};

/**
 * Get the parent directory path
 */
export const getParentPath = (path: string): string => {
  const segments = path.split('/').filter(s => s);
  segments.pop();
  return segments.join('/') || '';
};

/**
 * Get the filename from a path
 */
export const getFileName = (path: string): string => {
  const segments = path.split('/').filter(s => s);
  return segments[segments.length - 1] || '';
};

/**
 * Check if a path is a child of another path
 */
export const isChildPath = (childPath: string, parentPath: string): boolean => {
  if (!parentPath) return true;
  return childPath.startsWith(parentPath + '/');
};

/**
 * Get the depth of a path (number of segments)
 */
export const getPathDepth = (path: string): number => {
  if (!path) return 0;
  return path.split('/').filter(s => s).length;
};

/**
 * Normalize a path (remove trailing slashes, etc.)
 */
export const normalizePath = (path: string): string => {
  return path
    .split('/')
    .filter(s => s)
    .join('/');
};
