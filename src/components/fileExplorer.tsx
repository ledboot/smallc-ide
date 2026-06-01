'use client';

import {useState, useEffect, useRef} from 'react';
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
  createFolder,
  deleteFolder,
  renameFile,
  clearWorkspace,
} from '@/lib/db';
import {
  FolderIcon,
  FileIcon,
  PlusIcon,
  UploadIcon,
  Trash2Icon,
  ChevronRightIcon,
  ChevronDownIcon,
  FolderPlusIcon,
  Edit2Icon,
  FileTextIcon,
  DownloadIcon,
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
  const {currentFile, handleOpenFile, cleanupInvalidTabs} = useTabsStore();
  const [isCreateFileDialogOpen, setIsCreateFileDialogOpen] = useState(false);
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] =
    useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [fileTree, setFileTree] = useState<FileType[]>([]);
  const [contextItem, setContextItem] = useState<FileType | null>(null);
  const [contextParentPath, setContextParentPath] = useState<string>('');
  const [uploadParentPath, setUploadParentPath] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    files,
    addFile,
    refreshFiles,
    expandedFolders,
    toggleFolder,
    setExpandedFolders,
  } = useFileStore();
  const [conflict, setConflict] = useState<{
    file: File;
    path: string;
    resolve: (action: 'keep' | 'replace' | 'skip') => void;
  } | null>(null);

  const resolveConflict = (
    file: File,
    path: string,
  ): Promise<'keep' | 'replace' | 'skip'> => {
    return new Promise(resolve => {
      setConflict({file, path, resolve});
    });
  };

  const getUniquePath = (path: string) => {
    const lastDotIndex = path.lastIndexOf('.');
    const extension = lastDotIndex !== -1 ? path.slice(lastDotIndex) : '';
    const baseName = lastDotIndex !== -1 ? path.slice(0, lastDotIndex) : path;

    // First try "xx copy.xx"
    let newPath = `${baseName} copy${extension}`;
    if (!files.some(f => f.id === newPath)) {
      return newPath;
    }

    // Then try "xx copy 2.xx", "xx copy 3.xx", etc.
    let counter = 2;
    while (true) {
      newPath = `${baseName} copy ${counter}${extension}`;
      if (!files.some(f => f.id === newPath)) {
        return newPath;
      }
      counter++;
    }
  };

  useEffect(() => {
    if (currentFile && currentFile.id !== 'home') {
      setSelectedItemId(currentFile.id);
    } else {
      setSelectedItemId(null);
    }
  }, [currentFile]);

  useEffect(() => {
    const tree = buildTreeFromFiles(files);
    setFileTree(tree);
  }, [files]);

  const getUploadFolderPath = (): string => {
    if (!selectedItemId) return '';
    const item = files.find(f => f.id === selectedItemId);
    if (!item) return '';
    if (item.isDirectory) {
      return item.id;
    } else {
      const parentPath = item.id.substring(0, item.id.lastIndexOf('/'));
      return parentPath || '';
    }
  };

  const handleUploadTrigger = (parentPath = '') => {
    setUploadParentPath(parentPath);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const allowedExtensions = new Set(['.c', '.h', '.abi']);
    let uploadedCount = 0;
    let skippedCount = 0;

    for (const selectedFile of Array.from(selectedFiles)) {
      const extension = selectedFile.name
        .slice(selectedFile.name.lastIndexOf('.'))
        .toLowerCase();
      if (!allowedExtensions.has(extension)) {
        skippedCount += 1;
        continue;
      }

      let filePath = uploadParentPath
        ? `${uploadParentPath}/${selectedFile.name}`
        : `/${selectedFile.name}`;

      if (files.some(file => file.id === filePath)) {
        const action = await resolveConflict(selectedFile, filePath);
        if (action === 'skip') {
          skippedCount += 1;
          continue;
        } else if (action === 'keep') {
          filePath = getUniquePath(filePath);
        }
        // for 'replace', filePath remains the same
      }

      const content = await selectedFile.text();
      const uploadedFile: FileType = {
        id: filePath,
        name: filePath.substring(filePath.lastIndexOf('/') + 1),
        content,
        lastModified: new Date().toISOString(),
        isDirectory: false,
        path: filePath,
      };

      await saveFile(uploadedFile);
      addFile(uploadedFile);
      uploadedCount += 1;
    }

    if (uploadedCount > 0) {
      toast.success(
        `Uploaded ${uploadedCount} file${uploadedCount > 1 ? 's' : ''}`,
      );
    }
    if (skippedCount > 0) {
      toast.error(`Skipped ${skippedCount} file${skippedCount > 1 ? 's' : ''}`);
    }

    event.target.value = '';
    setUploadParentPath('');
    setConflict(null);
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

  const handleClearWorkspace = async () => {
    try {
      await clearWorkspace();
      await refreshFiles();
      setExpandedFolders(new Set());
      cleanupInvalidTabs([]);
      toast.success('Workspace cleared successfully');
    } catch (error) {
      console.error('Failed to clear workspace:', error);
      toast.error('Failed to clear workspace');
    }
  };

  const handleDragStart = (e: React.DragEvent, item: FileType) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: FileType) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetFolder.id) return;

    const itemToMove = files.find(f => f.id === sourceId);
    if (!itemToMove) return;

    const fileName = itemToMove.name;
    const newPath =
      targetFolder.id === '/'
        ? `/${fileName}`
        : `${targetFolder.id}/${fileName}`;

    if (sourceId === newPath) return;

    if (files.some(f => f.id === newPath)) {
      toast.error('A file with this name already exists in the destination');
      return;
    }

    try {
      await renameFile(sourceId, newPath);
      await refreshFiles();

      if (currentFile && currentFile.id === sourceId) {
        handleOpenFile(null);
      }

      toast.success(`Moved ${fileName} to ${targetFolder.name}`);
    } catch (error) {
      console.error('Failed to move file:', error);
      toast.error('Failed to move file');
    }
  };

  const handleDownload = (item: FileType) => {
    if (item.isDirectory) return;

    const blob = new Blob([item.content || ''], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${item.name}`);
  };

  const renderFileTree = (items: FileType[], level = 0, _parentPath = '') => {
    return items.map(item => {
      const isExpanded = expandedFolders.has(item.id);
      const isSelected = selectedItemId === item.id;
      const isDragOver = dragOverFolderId === item.id;

      return (
        <div key={item.id}>
          <ContextMenu>
            <ContextMenuTrigger className="w-full">
              <div
                className={`flex cursor-pointer items-center rounded-md px-2 py-1 text-sm transition-all ${
                  isSelected
                    ? 'bg-accent text-accent-foreground'
                    : isDragOver
                      ? 'bg-primary/10 border border-dashed border-primary text-primary scale-105'
                      : 'hover:bg-muted'
                }`}
                style={{paddingLeft: `${level * 12 + 6}px`}}
                draggable={!item.isDirectory}
                onDragStart={e => handleDragStart(e, item)}
                onDragOver={e => {
                  if (item.isDirectory) {
                    e.preventDefault();
                    if (dragOverFolderId !== item.id) {
                      setDragOverFolderId(item.id);
                    }
                  }
                }}
                onDragLeave={() => {
                  if (item.isDirectory && dragOverFolderId === item.id) {
                    setDragOverFolderId(null);
                  }
                }}
                onDrop={e => {
                  if (item.isDirectory) {
                    handleDrop(e, item);
                  }
                }}
                onClick={e => {
                  e.stopPropagation();
                  if (item.isDirectory) {
                    toggleFolder(item.id);
                    setSelectedItemId(
                      item.id === selectedItemId ? null : item.id,
                    );
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
                  <ContextMenuItem onClick={() => handleUploadTrigger(item.id)}>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Upload Files (.c, .h, .abi)
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
              {!item.isDirectory && (
                <ContextMenuItem onClick={() => handleDownload(item)}>
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Download
                </ContextMenuItem>
              )}
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
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".c,.h,.abi"
            multiple
            onChange={handleFileUpload}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            title="Clear Workspace"
            onClick={() => setIsClearDialogOpen(true)}
            disabled={fileTree.length === 0}
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Upload Files (.c, .h, .abi)"
            onClick={() => handleUploadTrigger(getUploadFolderPath())}
          >
            <UploadIcon className="h-4 w-4" />
          </Button>
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
      <div
        className="flex-1 overflow-auto py-2 pl-1 pr-2"
        onDragOver={e => {
          e.preventDefault();
        }}
        onDrop={async e => {
          e.preventDefault();
          const mockRoot: FileType = {
            id: '/',
            name: 'Root',
            isDirectory: true,
            path: '/',
            content: '',
            lastModified: '',
          };
          await handleDrop(e, mockRoot);
        }}
      >
        {fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
            <FolderIcon className="mb-2 h-8 w-8" />
            <p>No files yet</p>
            <p>Click + to create or upload a new file</p>
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
              placeholder="File name (e.g. main.c, header.h)"
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

      {/* Conflict Resolution Dialog */}
      <Dialog
        open={!!conflict}
        onOpenChange={open => {
          if (!open) conflict?.resolve('skip');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File Already Exists</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            A file named &quot;{conflict?.file.name}&quot; already exists. What
            would you like to do?
          </div>
          <DialogFooter className="sm:justify-start flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => conflict?.resolve('keep')}
            >
              Keep both
            </Button>
            <Button
              variant="secondary"
              onClick={() => conflict?.resolve('replace')}
            >
              Replace
            </Button>
            <Button onClick={() => conflict?.resolve('skip')}>Skip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Clear Workspace Confirmation Dialog */}
      <Dialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Workspace</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            Are you sure you want to delete all files and folders in your
            workspace? This action cannot be undone.
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsClearDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setIsClearDialogOpen(false);
                await handleClearWorkspace();
              }}
            >
              Delete All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
