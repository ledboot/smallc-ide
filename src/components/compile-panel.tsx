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
  Copy,
  Bug,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { CompiledResult, FileType } from "@/lib/types";
import { compilerService, isWasmReady } from "@/lib/wasm-compiler";
import { createFolder, getFile, saveFile } from "@/lib/db";
import { toast } from "sonner";

import { Asm } from "@/lib/asm";

import { generateContractTemplate } from "@/utils/templateGenerator";
import { runContractMethod } from "@/utils/contractRunner";
import { useConsoleStore } from "@/lib/console-store";
import { LogLevel } from "@/lib/console-store";
import { runTSCode } from "@/utils/tsRunner";

interface CompilePanelProps {
  files: FileType[];
  compiledResultMap: Map<string, CompiledResult>;
  setCompiledResultMap: (map: Map<string, CompiledResult>) => void;
  refreshFiles?: () => Promise<void>;
}

export default function CompilePanel({
  files,
  compiledResultMap,
  setCompiledResultMap,
  refreshFiles,
}: CompilePanelProps) {
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationSuccess, setCompilationSuccess] = useState<boolean | null>(
    null
  );

  const [bytecodeAvailable, setBytecodeAvailable] = useState<boolean>(false);
  const [abiAvailable, setAbiAvailable] = useState<boolean>(false);
  const [executeJSAvailable, setExecuteJSAvailable] = useState<boolean>(false);
  const [compiledData, setCompiledData] = useState<CompiledResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [executeJSFile, setExecuteJSFile] = useState<FileType | null>(null);

  const { addLog } = useConsoleStore();

  // Filter out .c and .ts files
  const sourceFiles = files.filter(
    (file) => file.name.endsWith(".c") || file.name.endsWith(".ts")
  );

  // Automatically select first file
  useEffect(() => {
    if (sourceFiles.length > 0 && !selectedFile) {
      setSelectedFile(sourceFiles[0].id);
    }
  }, [sourceFiles, selectedFile]);

  useEffect(() => {
    const file = sourceFiles.find((f) => f.id === selectedFile);
    console.log("compiledResultMap", compiledResultMap);
    if (file) {
      const compiledResult = compiledResultMap.get(file.name);
      if (compiledResult) {
        setCompiledData(compiledResult);
      } else {
        setCompiledData(null);
      }
      setBytecodeAvailable(!!compiledResult?.bytecode);
      setAbiAvailable(!!compiledResult?.abi);
    }
  }, [compiledResultMap, selectedFile, sourceFiles]);

  // 复制到剪切板
  const handleCopy = async (text: string) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success("复制成功");
  };

  const executeJS = async () => {
    if (!executeJSFile) return;
    const result = await runContractMethod(executeJSFile.content, "store");
    addLog(`Execution successful: ${result}`, LogLevel.SUCCESS);
  };

  const handleCompile = async () => {
    if (!selectedFile) {
      // setCompilationOutput("Please select a file to compile");
      setCompilationSuccess(false);
      return;
    }

    const file = sourceFiles.find((f) => f.id === selectedFile);
    if (!file) {
      // setCompilationOutput("Selected file not found");
      setCompilationSuccess(false);
      return;
    }

    setIsCompiling(true);
    setCompilationSuccess(null);

    // Handle TypeScript files separately
    if (file.name.endsWith(".ts")) {
      try {
        await runTSCode(file.content);
        setCompilationSuccess(true);
        toast.success("TypeScript executed successfully");
      } catch (e) {
        setCompilationSuccess(false);
        toast.error("Execution failed");
      } finally {
        setIsCompiling(false);
      }
      return;
    }

    try {
      // 构建编译参数
      const args = [];
      // 添加--debug参数（如果启用）
      if (debugMode) {
        args.push("-debug");
      }
      args.push(file.name);

      const compilationFiles: FileType[] = [];
      files.some((f) => {
        if (
          f.name.endsWith(".c") ||
          f.name.endsWith(".h") ||
          f.name.endsWith(".abi")
        ) {
          compilationFiles.push(f);
        }
      });
      if (compilationFiles.length === 0) {
        // setCompilationOutput("No C files found");
        setCompilationSuccess(false);
        return;
      }

      console.log("compilationFiles", compilationFiles, "args ", args);

      const result = await compilerService.compile(compilationFiles, args);
      console.log("compile result", result);

      if (result.code === 0) {
        // setCompilationOutput(
        //   result.output || `Compilation successful for ${file.name}`
        // );
        setCompilationSuccess(true);

        // 处理输出文件
        await processOutputFiles(file, result.outputFiles);

        // 刷新文件列表
        if (refreshFiles) {
          await refreshFiles();
        }
        generateTemplate(file);
      } else {
        // setCompilationOutput(
        //   result.output || `Compilation failed for ${file.name}`
        // );
        setCompilationSuccess(false);
      }
    } catch (error) {
      // setCompilationOutput(
      //   `Compilation error: ${
      //     error instanceof Error ? error.message : String(error)
      //   }`
      // );
      setCompilationSuccess(false);
    } finally {
      setIsCompiling(false);
    }
  };

  const generateTemplate = async (sourceFile: FileType) => {
    try {
      const baseName = sourceFile.name.split(".").slice(0, -1).join(".");
      const abiFileName = `/${baseName}.abi`;
      const abiFile = await getFile(abiFileName);
      console.log("abiFile", abiFile);
      if (!abiFile) {
        toast.error("ABI file not found");
        return;
      }
      // Parse ABI to create the template

      // Generate template JS
      const templateCode = generateContractTemplate(
        JSON.parse(abiFile.content)
      );
      console.log("templateCode", templateCode);

      // Ensure .build directory exists
      const buildDir = "/.build";
      try {
        await createFolder(buildDir);
      } catch (e) {
        // Directory might already exist, ignore
      }

      // Save to .build directory
      const filename = `${baseName}_runner.ts`;
      const filePath = `${buildDir}/${filename}`;
      const file: FileType = {
        id: filePath,
        name: filename,
        content: templateCode,
        path: filePath,
        isDirectory: false,
        lastModified: new Date().toISOString(),
      };
      await saveFile(file);
      setExecuteJSAvailable(true);
      setExecuteJSFile(file);

      toast.success("Template generated", {
        description: `Saved to .build/${filename}`,
      });
    } catch (error) {
      console.error("Failed to generate template:", error);
      toast.error("Failed to generate template", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  const processOutputFiles = async (
    sourceFile: FileType,
    outputFiles: { name: string; content: string }[]
  ) => {
    const baseName = sourceFile.name.split(".").slice(0, -1).join(".");

    const asmFile = outputFiles.find((f) => f.name === `${baseName}.asm`);
    const abiFile = outputFiles.find((f) => f.name === `${baseName}.abi`);

    if (asmFile && abiFile) {
      const asm = Asm.assemble(asmFile.content);
      console.log("asm", asm);

      if (asm.success) {
        const compiledResult = compiledResultMap.get(sourceFile.name);
        if (compiledResult) {
          compiledResultMap.delete(sourceFile.name);
        }
        const abiContent = JSON.parse(abiFile.content);
        abiContent.address = asm.hash;
        abiFile.content = JSON.stringify(abiContent);

        if (debugMode) {
          await writeDbgFile(sourceFile.name, asm.debugInfo);
        }

        const newMap = new Map(compiledResultMap);
        newMap.set(sourceFile.name, {
          bytecode: asm.bytecode,
          abi: abiFile.content,
          hash: asm.hash,
        });
        setCompiledResultMap(newMap);
      }
      // 保存所有输出文件到DB
      await saveFile({
        id: asmFile.name,
        name: asmFile.name,
        content: asmFile.content,
        lastModified: new Date().toISOString(),
      });
      await saveFile({
        id: abiFile.name,
        name: abiFile.name,
        content: abiFile.content,
        lastModified: new Date().toISOString(),
      });
    }
  };

  const writeDbgFile = async (fileName: string, dbgContent: string) => {
    const dbgFile: FileType = {
      id: fileName.split(".")[0] + ".dbg",
      name: fileName.split(".")[0] + ".dbg",
      content: dbgContent,
      lastModified: new Date().toISOString(),
    };
    await saveFile(dbgFile);
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
          {sourceFiles.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fileSelect" className="text-xs">
                  Select Source File
                </Label>
                <Select value={selectedFile} onValueChange={setSelectedFile}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceFiles.map((file) => (
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

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="debug-mode"
                  checked={debugMode}
                  onCheckedChange={setDebugMode}
                />
                <Label
                  htmlFor="debug-mode"
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <Bug className="h-3.5 w-3.5" />
                  Debug Mode
                </Label>
              </div>
            </div>
          ) : (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription className="text-xs">
                No source files found. Create a .c or .ts file to get started.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleCompile}
        disabled={isCompiling || !selectedFile || sourceFiles.length === 0}
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
            {selectedFile.endsWith(".ts") ? "Run TS" : "Compile"}
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
                {selectedFile.endsWith(".ts")
                  ? "Execution successful!"
                  : "Compilation successful!"}
              </AlertDescription>
            </>
          ) : (
            <>
              <AlertCircleIcon className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-xs">
                {selectedFile.endsWith(".ts")
                  ? "Execution failed."
                  : "Compilation failed."}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Action</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={!abiAvailable}
              onClick={() => handleCopy(compiledData?.abi || "")}
            >
              <Copy className="h-4 w-4" />
              ABI
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={!bytecodeAvailable}
              onClick={() => handleCopy(compiledData?.bytecode || "")}
            >
              <Copy className="h-4 w-4" />
              Bytecode
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={!abiAvailable}
              onClick={() => executeJS()}
            >
              <Copy className="h-4 w-4" />
              ExecuteJS
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
