"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { FileType } from "@/lib/types";
import { saveFile, deleteFile, getAllFiles } from "@/lib/db";
import { FolderIcon, FileIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

interface FileExplorerProps {
  files: FileType[];
  setFiles: (files: FileType[]) => void;
  currentFile: FileType | null;
  setCurrentFile: (file: FileType | null) => void;
}

export default function FileExplorer({
  files,
  setFiles,
  currentFile,
  setCurrentFile,
}: FileExplorerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  useEffect(() => {
    const loadFiles = async () => {
      const loadedFiles = await getAllFiles();
      setFiles(loadedFiles);
    };

    loadFiles();
  }, [setFiles]);

  const handleCreateFile = async () => {
    if (!newFileName) return;

    // 判断是否已存在
    if (files.some((file) => file.name === newFileName)) {
      toast.error("File already exists");
      return;
    }

    const fileExtension = newFileName.includes(".") ? "" : ".c";
    const fileName = newFileName + fileExtension;

    let defaultContent = "";

    if (fileName.endsWith(".c")) {
      defaultContent = `#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}`;
    } else if (
      fileName.endsWith(".cpp") ||
      fileName.endsWith(".cc") ||
      fileName.endsWith(".cxx")
    ) {
      defaultContent = `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`;
    } else if (fileName.endsWith(".h") || fileName.endsWith(".hpp")) {
      const headerGuard = fileName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
      defaultContent = `#ifndef ${headerGuard}
#define ${headerGuard}

// Header content goes here

#endif // ${headerGuard}`;
    } else if (fileName.endsWith(".sol")) {
      defaultContent = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ${fileName.replace(".sol", "")} {
    // Your contract code here
}`;
    }

    const newFile: FileType = {
      id: fileName,
      name: fileName,
      content: defaultContent,
      lastModified: new Date().toISOString(),
    };

    await saveFile(newFile);
    setFiles([...files, newFile]);
    setCurrentFile(newFile);
    setNewFileName("");
    setIsCreateDialogOpen(false);
  };

  const handleDeleteFile = async (id: string) => {
    await deleteFile(id);
    const updatedFiles = files.filter((file) => file.id !== id);
    setFiles(updatedFiles);

    if (currentFile && currentFile.id === id) {
      setCurrentFile(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="font-medium">Files</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <PlusIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New File</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="File name (e.g. main.c, app.cpp, header.h)"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFile();
                }}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreateFile}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="overflow-auto p-2">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
            <FolderIcon className="mb-2 h-8 w-8" />
            <p>No files yet</p>
            <p>Click + to create a new file</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {files.map((file) => (
              <ContextMenu key={file.id}>
                <ContextMenuTrigger>
                  <li
                    className={`flex cursor-pointer items-center rounded-md px-2 py-1 text-sm ${
                      currentFile?.id === file.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setCurrentFile(file)}
                  >
                    <FileIcon className="mr-2 h-4 w-4" />
                    <span className="truncate">{file.name}</span>
                  </li>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    className="text-destructive"
                    onClick={() => handleDeleteFile(file.id)}
                  >
                    <Trash2Icon className="mr-2 h-4 w-4" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
