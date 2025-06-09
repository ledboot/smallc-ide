"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PlayIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  FileIcon,
} from "lucide-react";
import type { FileType } from "@/lib/types";
import { compileWithWasm, isWasmReady } from "@/lib/wasm-compiler";
import { getFileFromMemFS, saveFileToIndexedDBOnly } from "@/lib/db";

interface CompilePanelProps {
  files: FileType[];
  setFiles: (files: FileType[]) => void;
  compilationOutput: string;
  setCompilationOutput: (output: string) => void;
}

export default function CompilePanel({
  files,
  setFiles,
  compilationOutput,
  setCompilationOutput,
}: CompilePanelProps) {
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationSuccess, setCompilationSuccess] = useState<boolean | null>(
    null
  );

  // 过滤出.c文件
  const cFiles = files.filter((file) => file.name.endsWith(".c"));

  // 当文件列表变化时，自动选择第一个.c文件
  useEffect(() => {
    if (cFiles.length > 0 && !selectedFile) {
      setSelectedFile(cFiles[0].id);
    }
  }, [cFiles, selectedFile]);


  const handleCompile = async () => {
    if (!selectedFile) {
      setCompilationOutput("Please select a C file to compile");
      setCompilationSuccess(false);
      return;
    }

    const file = cFiles.find((f) => f.id === selectedFile);
    if (!file) {
      setCompilationOutput("Selected file not found");
      setCompilationSuccess(false);
      return;
    }

    setIsCompiling(true);
    setCompilationSuccess(null);

    try {
      if (isWasmReady()) {
        // 构建编译参数
        const args = [];
        args.push(`/workspace/${file.name}`);

        const output = await compileWithWasm(args.join(" "));
        if (output) {
          setCompilationOutput(`Compilation successful for ${file.name}`);
          setCompilationSuccess(true);
          await getCompileOutput(file);
        } else {
          setCompilationOutput(`Compilation failed for ${file.name}`);
          setCompilationSuccess(false);
        }
      } else {
        console.log("isWasmReady", isWasmReady());
      }
    } catch (error) {
      setCompilationOutput(
        `Compilation error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setCompilationSuccess(false);
    } finally {
      setIsCompiling(false);
    }
  };

  const getCompileOutput = async (file: FileType) => {
    const asmFile = await getFileFromMemFS(
      `/workspace/${file.name.split(".")[0]}.asm`
    );
    await saveFileToIndexedDBOnly(asmFile);
    const abiFile = await getFileFromMemFS(
      `/workspace/${file.name.split(".")[0]}.abi`
    );
    await saveFileToIndexedDBOnly(abiFile);
    setFiles([...files, asmFile, abiFile]);
  };

  return (
    <div className="flex h-full flex-col p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">SmallC Compiler</h3>
        <Badge
          variant={isWasmReady() ? "default" : "secondary"}
          className="text-xs"
        >
          {isWasmReady() ? "WASM" : "SIM"}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileIcon className="h-4 w-4" />
            Source File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cFiles.length > 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="fileSelect" className="text-xs">
                  Select C File
                </Label>
                <Select value={selectedFile} onValueChange={setSelectedFile}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cFiles.map((file) => (
                      <SelectItem key={file.id} value={file.id}>
                        <div className="flex items-center gap-2">
                          <FileIcon className="h-3 w-3" />
                          <span className="truncate">{file.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* {selectedFile && (
                <div className="space-y-2">
                  <Label htmlFor="outputName" className="text-xs">
                    Output Name
                  </Label>
                  <Input
                    id="outputName"
                    value={outputName}
                    onChange={(e) => setOutputName(e.target.value)}
                    placeholder="executable"
                    className="h-8"
                  />
                </div>
              )} */}
            </>
          ) : (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription className="text-xs">
                No C files found. Create a .c file to get started.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="optimization" className="text-xs">
              Optimization
            </Label>
            <Select value={optimizationLevel} onValueChange={setOptimizationLevel}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="O0">-O0 (None)</SelectItem>
                <SelectItem value="O1">-O1 (Basic)</SelectItem>
                <SelectItem value="O2">-O2 (Full)</SelectItem>
                <SelectItem value="O3">-O3 (Aggressive)</SelectItem>
                <SelectItem value="Os">-Os (Size)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="compilerFlags" className="text-xs">
              Flags
            </Label>
            <Input
              id="compilerFlags"
              value={compilerFlags}
              onChange={(e) => setCompilerFlags(e.target.value)}
              placeholder="-Wall -Wextra"
              className="h-8"
            />
          </div>
        </CardContent>
      </Card> */}

      <Button
        onClick={handleCompile}
        disabled={isCompiling || !selectedFile || cFiles.length === 0}
        className="w-full"
      >
        {isCompiling ? (
          <>
            <PlayIcon className="mr-2 h-4 w-4 animate-spin" />
            Compiling...
          </>
        ) : (
          <>
            <PlayIcon className="mr-2 h-4 w-4" />
            Compile
          </>
        )}
      </Button>

      {compilationSuccess !== null && (
        <Alert
          className={`${
            compilationSuccess
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          {compilationSuccess ? (
            <>
              <CheckCircleIcon className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-xs">
                Compilation successful!
              </AlertDescription>
            </>
          ) : (
            <>
              <AlertCircleIcon className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-xs">
                Compilation failed.
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Output</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 overflow-auto rounded-md border bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
            {compilationOutput || "Compilation output will appear here..."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
