'use client';

import {useState, useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Label} from '@/components/ui/label';
import {Badge} from '@/components/ui/badge';
import {PlayIcon, InfoIcon, FileIcon, Bug} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import type {FileType} from '@/types';
import {compilerService, isWasmReady} from '@/lib/wasm-compiler';
import {saveFile} from '@/lib/db';
import {toast} from 'sonner';

import {Asm} from '@/lib/asm';

import {LogLevel, useConsoleStore} from '@/state/useConsole';
import {useCompilerStore} from '@/state/useCompiler';

import {useFileStore} from '@/state/useFile';

export default function CompilePanel() {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState(false);

  const [debugMode, setDebugMode] = useState(false);

  const {addLog} = useConsoleStore();
  const setCompiledResult = useCompilerStore(state => state.setCompiledResult);
  const {files, refreshFiles} = useFileStore();

  // Filter out .c and .ts files, excluding buildin.c
  const sourceFiles = files.filter(
    file =>
      file.name.endsWith('.c') &&
      !file.isDirectory &&
      file.name !== 'buildin.c',
  );
  // Automatically select first file
  useEffect(() => {
    if (sourceFiles.length > 0 && !selectedFile) {
      setSelectedFile(sourceFiles[0]!.id);
    }
  }, [sourceFiles, selectedFile]);

  const handleCompile = async () => {
    if (isCompiling || compilerService.isBusy()) {
      return;
    }

    if (!selectedFile) {
      toast.error('Please select a file to compile');
      return;
    }

    const file = sourceFiles.find(f => f.id === selectedFile);
    if (!file) {
      toast.error('Selected file not found');
      return;
    }

    setIsCompiling(true);

    try {
      // 构建编译参数
      const args = [];
      // 添加--debug参数（如果启用）
      if (debugMode) {
        args.push('-debug');
      }
      args.push(file.name);

      const compilationFiles: FileType[] = [];
      files.some(f => {
        if (
          (f.name.endsWith('.c') ||
            f.name.endsWith('.h') ||
            f.name.endsWith('.abi')) &&
          !f.isDirectory
        ) {
          compilationFiles.push(f);
        }
      });
      if (compilationFiles.length === 0) {
        toast.error('No C files found');
        return;
      }

      const result = await compilerService.compile(compilationFiles, args);
      console.log('compiler result', result);
      if (result.output.includes('Error')) {
        addLog(
          'Compilation failed for ' + file.name,
          result.output,
          LogLevel.ERROR,
        );
        return;
      }

      if (result.code === 0) {
        toast.success('Compilation successful for ' + file.name);
        addLog('Compilation successful for ' + file.name);

        // 处理输出文件
        await processOutputFiles(file, result.outputFiles);
      } else {
        toast.error('Compilation failed for ' + file.name);
        addLog('Compilation failed for ' + file.name, result, LogLevel.ERROR);
      }
    } catch (error) {
      toast.error('Compilation failed for ' + file.name);
      addLog(
        `Compilation error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      if (!compilerService.isBusy()) {
        setIsCompiling(false);
      }
    }
  };

  const processOutputFiles = async (
    sourceFile: FileType,
    outputFiles: {name: string; content: string}[],
  ) => {
    const baseName = sourceFile.name.split('.').slice(0, -1).join('.');

    const asmFile = outputFiles.find(f => f.name === `${baseName}.asm`);
    const abiFile = outputFiles.find(f => f.name === `${baseName}.abi`);

    if (asmFile && abiFile) {
      const asm = Asm.assemble(asmFile.content);

      const lastSlashIndex = sourceFile.id.lastIndexOf('/');
      const parentDir =
        lastSlashIndex > 0 ? sourceFile.id.substring(0, lastSlashIndex) : '';

      const asmPath = parentDir
        ? `${parentDir}/${asmFile.name}`
        : `/${asmFile.name}`;
      const abiPath = parentDir
        ? `${parentDir}/${abiFile.name}`
        : `/${abiFile.name}`;
      const dbgPath = parentDir
        ? `${parentDir}/${sourceFile.name.split('.')[0]}.dbg`
        : `/${sourceFile.name.split('.')[0]}.dbg`;

      if (asm.success) {
        const abiContent = JSON.parse(abiFile.content);
        abiContent.address = asm.hash;
        abiFile.content = JSON.stringify(abiContent);

        if (debugMode) {
          await saveFile({
            id: dbgPath,
            name: sourceFile.name.split('.')[0] + '.dbg',
            content: asm.debugInfo,
            path: dbgPath,
            lastModified: new Date().toISOString(),
          });
        }

        setCompiledResult(sourceFile.name, {
          bytecode: asm.bytecode,
          abi: abiFile.content,
          hash: asm.hash,
        });
      }
      // 保存所有输出文件到DB
      await saveFile({
        id: asmPath,
        name: asmFile.name,
        content: asmFile.content,
        path: asmPath,
        lastModified: new Date().toISOString(),
      });
      await saveFile({
        id: abiPath,
        name: abiFile.name,
        content: abiFile.content,
        path: abiPath,
        lastModified: new Date().toISOString(),
      });
      await refreshFiles();
    }
  };

  return (
    <div className="flex h-full flex-col p-2 pt-4 space-y-10">
      {/* Header section - Flat and integrated */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <PlayIcon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">Compiler</h3>
        </div>
        <Badge
          variant={isWasmReady() ? 'default' : 'secondary'}
          className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider"
        >
          {isWasmReady() ? 'Wasm Engine' : 'Sim Engine'}
        </Badge>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto pr-1">
        {/* Source File Selection Section - No Card */}
        <div className="space-y-6">
          {sourceFiles.length > 0 ? (
            <div className="space-y-6">
              <div className="flex items-center space-y-2">
                <Label
                  htmlFor="fileSelect"
                  className="w-18 h-12 min-w-18 text-xs font-semibold m-0"
                >
                  Source File
                </Label>
                <Select value={selectedFile} onValueChange={setSelectedFile}>
                  <SelectTrigger
                    id="fileSelect"
                    className="h-12 w-full px-2 hover:bg-muted/40 focus:ring-0 focus:ring-offset-0"
                  >
                    <SelectValue placeholder="Select a contract..." />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    className="w-[var(--radix-select-trigger-width)] border-none shadow-xl bg-background/95 backdrop-blur-md"
                  >
                    {sourceFiles.map(file => (
                      <SelectItem key={file.id} value={file.id}>
                        <div className="flex items-center gap-3 py-1">
                          <FileIcon className="h-4 w-4 opacity-50" />
                          <span className="font-medium">{file.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl hover:bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-primary/10 p-2.5">
                      <Bug className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <Label
                        htmlFor="debug-mode"
                        className="text-sm font-bold cursor-pointer"
                      >
                        Debug Flag
                      </Label>
                      <p className="text-[12px] text-muted-foreground font-medium">
                        Generate dbs file.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="debug-mode"
                    checked={debugMode}
                    onCheckedChange={setDebugMode}
                    className="scale-90"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-muted/10 rounded-3xl">
              <div className="rounded-full bg-muted/20 p-4 mb-4">
                <InfoIcon className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-muted-foreground/80">
                Workspace Empty
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1 text-center">
                Create a .c or .ts file in the explorer to begin.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-center items-center pt-4 space-y-4">
          <Button
            onClick={handleCompile}
            disabled={isCompiling || !selectedFile || sourceFiles.length === 0}
            className="w-fit px-8 h-10 text-xs font-bold tracking-widest bg-primary text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-primary/20 rounded-xl group relative overflow-hidden border-none"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer pointer-events-none" />
            {isCompiling ? (
              <>
                <PlayIcon className="mr-3 h-5 w-5 animate-pulse" />
                Processing...
              </>
            ) : (
              <>
                <PlayIcon className="mr-3 h-5 w-5 fill-current transition-transform group-hover:scale-110" />
                {selectedFile?.endsWith('.ts')
                  ? 'Execute Script'
                  : 'Build Contract'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
