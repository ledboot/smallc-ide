'use client';

import {useState, useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type {FileType} from '@/types';
import {
  saveFile,
  deleteFile,
  getAllFiles,
  createFolder,
  deleteFolder,
  renameFile,
} from '@/lib/db';
import {
  FolderIcon,
  FileIcon,
  PlusIcon,
  Trash2Icon,
  ChevronRightIcon,
  ChevronDownIcon,
  FolderPlusIcon,
  Edit2Icon,
  FileTextIcon,
} from 'lucide-react';
import {toast} from 'sonner';
import {useFileStore} from '@/state/useFile';

import {useTabsStore} from '@/state/useTabs';

interface FileExplorerProps {
  onFileDelete?: (file: FileType) => void;
}

const buildTreeFromFiles = (files: FileType[]): FileType[] => {
  const fileMap = new Map<string, FileType>();
  const root: FileType[] = [];

  // Create a map of all files
  files.forEach(file => {
    fileMap.set(file.id, {...file, children: []});
  });

  // Build the tree
  files.forEach(file => {
    const node = fileMap.get(file.id);
    if (!node) return;

    const pathParts = file.id.split('/').filter(Boolean);

    if (pathParts.length === 1) {
      // Top level file/folder
      root.push(node);
    } else {
      // Nested file/folder
      const parentPath = '/' + pathParts.slice(0, -1).join('/');
      const parent = fileMap.get(parentPath);

      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        // Parent not found, treat as root
        root.push(node);
      }
    }
  });

  // Sort: Folders first, then alphabetical
  const sortNodes = (nodes: FileType[]) => {
    nodes.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(root);
  return root;
};

export default function FileExplorer({onFileDelete}: FileExplorerProps) {
  const {currentFile, handleOpenFile} = useTabsStore();
  const [isCreateFileDialogOpen, setIsCreateFileDialogOpen] = useState(false);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] =
    useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [fileTree, setFileTree] = useState<FileType[]>([]);
  const [contextItem, setContextItem] = useState<FileType | null>(null);
  const [contextParentPath, setContextParentPath] = useState<string>('');
  const {files, addFile, refreshFiles} = useFileStore();

  useEffect(() => {
    const tree = buildTreeFromFiles(files);
    setFileTree(tree);
  }, [files]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleCreateFile = async (parentPath?: string) => {
    if (!newFileName) return;

    const fileExtension = newFileName.includes('.') ? '' : '.c';
    const fileName = newFileName + fileExtension;
    const filePath = parentPath ? `${parentPath}/${fileName}` : `/${fileName}`;

    // Check if file already exists
    if (files.some(file => file.id === filePath)) {
      toast.error('File already exists');
      return;
    }

    let defaultContent = '';

    if (fileName.endsWith('.c')) {
      defaultContent = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`;
    } else if (fileName.endsWith('.h') || fileName.endsWith('.hpp')) {
      const headerGuard = fileName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      defaultContent = `#ifndef ${headerGuard}
#define ${headerGuard}

// Header content goes here

#endif // ${headerGuard}`;
    }

    const newFile: FileType = {
      id: filePath,
      name: fileName,
      content: defaultContent,
      lastModified: new Date().toISOString(),
      isDirectory: false,
      path: filePath,
    };

    await saveFile(newFile);
    addFile(newFile);
    handleOpenFile(newFile);
    setNewFileName('');
    setIsCreateFileDialogOpen(false);
    toast.success(`Created ${fileName}`);
  };

  const handleCreateFolder = async (parentPath?: string) => {
    if (!newFolderName) return;

    const folderPath = parentPath
      ? `${parentPath}/${newFolderName}`
      : `/${newFolderName}`;

    // Check if folder already exists
    if (files.some(file => file.id === folderPath)) {
      toast.error('Folder already exists');
      return;
    }

    const newFolder: FileType = {
      id: folderPath,
      name: newFolderName,
      isDirectory: true,
      path: folderPath,
      content: '',
      lastModified: new Date().toISOString(),
    };

    await createFolder(folderPath);
    addFile(newFolder);
    setNewFolderName('');
    setIsCreateFolderDialogOpen(false);
  };

  const handleRename = async () => {
    if (!contextItem || !renameValue) return;

    const oldPath = contextItem.id;
    const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = parentPath
      ? `${parentPath}/${renameValue}`
      : `/${renameValue}`;

    if (oldPath === newPath) {
      setIsRenameDialogOpen(false);
      return;
    }

    // Check if new name already exists
    if (files.some(file => file.id === newPath)) {
      toast.error('A file or folder with this name already exists');
      return;
    }

    try {
      await renameFile(oldPath, newPath);
      await refreshFiles();

      if (currentFile && currentFile.id === oldPath) {
        handleOpenFile(null);
      }

      setIsRenameDialogOpen(false);
      setRenameValue('');
      toast.success(
        `Renamed ${contextItem.isDirectory ? 'folder' : 'file'} to ${renameValue}`,
      );
    } catch (error) {
      console.error('Rename error:', error);
      toast.error('Failed to rename');
    }
  };

  const handleDelete = async (item: FileType) => {
    try {
      if (item.isDirectory) {
        await deleteFolder(item.id);
      } else {
        await deleteFile(item.id);
      }
      await refreshFiles();

      if (currentFile && currentFile.id === item.id) {
        handleOpenFile(null);
      }

      // Notify parent about deletion
      if (onFileDelete) {
        onFileDelete(item);
      }

      toast.success(
        `Deleted ${item.isDirectory ? 'folder' : 'file'} ${item.name}`,
      );
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete');
    }
  };

  const openContextMenu = (item: FileType, parentPath: string = '') => {
    setContextItem(item);
    setContextParentPath(parentPath);
  };

  const renderFileTree = (items: FileType[], level = 0, parentPath = '') => {
    return items.map(item => {
      const isExpanded = expandedFolders.has(item.id);
      const isSelected = currentFile?.id === item.id;

      return (
        <div key={item.id}>
          <ContextMenu>
            <ContextMenuTrigger className="w-full">
              <div
                className={`flex cursor-pointer items-center rounded-md px-2 py-1 text-sm ${
                  isSelected
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
                }`}
                style={{paddingLeft: `${level * 16 + 8}px`}}
                onClick={e => {
                  e.stopPropagation();
                  if (item.isDirectory) {
                    toggleFolder(item.id);
                  } else {
                    handleOpenFile(item);
                  }
                }}
              >
                {item.isDirectory ? (
                  <>
                    {isExpanded ? (
                      <ChevronDownIcon className="mr-1 h-4 w-4" />
                    ) : (
                      <ChevronRightIcon className="mr-1 h-4 w-4" />
                    )}
                    <FolderIcon className="mr-2 h-4 w-4" />
                  </>
                ) : (
                  <FileIcon className="mr-2 h-4 w-4 ml-5" />
                )}
                <span className="truncate">{item.name}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {item.isDirectory && (
                <>
                  <ContextMenuItem
                    onClick={() => {
                      setContextParentPath(item.id);
                      setIsCreateFileDialogOpen(true);
                    }}
                  >
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    New File
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setContextParentPath(item.id);
                      setIsCreateFolderDialogOpen(true);
                    }}
                  >
                    <FolderPlusIcon className="mr-2 h-4 w-4" />
                    New Folder
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <ContextMenuItem
                onClick={() => {
                  setContextItem(item);
                  setRenameValue(item.name);
                  setIsRenameDialogOpen(true);
                }}
              >
                <Edit2Icon className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive"
                onClick={() => handleDelete(item)}
              >
                <Trash2Icon className="mr-2 h-4 w-4" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
          {item.isDirectory &&
            isExpanded &&
            item.children &&
            item.children.length > 0 && (
              <div>{renderFileTree(item.children, level + 1, item.id)}</div>
            )}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="font-medium">Files</h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="New Folder"
            onClick={() => {
              setContextParentPath('');
              setIsCreateFolderDialogOpen(true);
            }}
          >
            <FolderPlusIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="New File"
            onClick={() => {
              setContextParentPath('');
              setIsCreateFileDialogOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="overflow-auto p-2">
        {fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
            <FolderIcon className="mb-2 h-8 w-8" />
            <p>No files yet</p>
            <p>Click + to create a new file</p>
          </div>
        ) : (
          <div className="space-y-1">{renderFileTree(fileTree)}</div>
        )}
      </div>

      {/* Create File Dialog */}
      <Dialog
        open={isCreateFileDialogOpen}
        onOpenChange={setIsCreateFileDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New File
              {contextParentPath && (
                <span className="text-sm text-muted-foreground ml-2">
                  in {contextParentPath}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="File name (e.g. main.c, app.cpp, header.h)"
              value={newFileName}
              onChange={e => setNewFileName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFile(contextParentPath);
              }}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => handleCreateFile(contextParentPath)}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog
        open={isCreateFolderDialogOpen}
        onOpenChange={setIsCreateFolderDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create New Folder
              {contextParentPath && (
                <span className="text-sm text-muted-foreground ml-2">
                  in {contextParentPath}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder(contextParentPath);
              }}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => handleCreateFolder(contextParentPath)}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Rename {contextItem?.isDirectory ? 'Folder' : 'File'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="New name"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
