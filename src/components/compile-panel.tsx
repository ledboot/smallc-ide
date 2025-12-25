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
import type {CompiledResult, FileType} from '@/lib/types';
import {compilerService, isWasmReady} from '@/lib/wasm-compiler';
import {createFolder, getFile, saveFile} from '@/lib/db';
import {toast} from 'sonner';

import {Asm} from '@/lib/asm';

import {generateContractTemplate} from '@/utils/templateGenerator';
import {runContractMethod} from '@/utils/contractRunner';
import {LogLevel, useConsoleStore} from '@/lib/console-store';
import {rpcClient} from '@/lib/api';
import {useRootStore} from '@/state';
import {useCompilerStore} from '@/state/compiler';
import {Input} from './ui/input';

interface CompilePanelProps {
  files: FileType[];
  refreshFiles?: () => Promise<void>;
}

export default function CompilePanel({files, refreshFiles}: CompilePanelProps) {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isCompiling, setIsCompiling] = useState(false);

  const [compiledData, setCompiledData] = useState<CompiledResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const {addLog} = useConsoleStore();
  const {chainType} = useRootStore().settings;
  const compiledResultMap = useCompilerStore(state => state.compiledResultMap);
  const setCompiledResult = useCompilerStore(state => state.setCompiledResult);
  const [executeMethod, setExecuteMethod] = useState('');

  // Filter out .c and .ts files
  const sourceFiles = files.filter(
    file =>
      (file.name.endsWith('.c') || file.name.endsWith('.ts')) &&
      !file.isDirectory,
  );
  // Automatically select first file
  useEffect(() => {
    if (sourceFiles.length > 0 && !selectedFile) {
      setSelectedFile(sourceFiles[0]!.id);
    }
  }, [sourceFiles, selectedFile]);

  useEffect(() => {
    const file = sourceFiles.find(f => f.id === selectedFile);
    if (file) {
      const compiledResult = compiledResultMap.get(file.name);
      if (compiledResult) {
        setCompiledData(compiledResult);
      } else {
        setCompiledData(null);
      }
    }
  }, [compiledResultMap, selectedFile, sourceFiles]);

  const handleCompile = async () => {
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

    // Handle TypeScript files separately
    if (file.name.endsWith('.ts')) {
      try {
        const rawTx = await runContractMethod(file.content, executeMethod);
        if (!rawTx) {
          return;
        }
        console.log('rawTx', rawTx);
        const privateKey =
          'cUPvqzYW2anTXKp2eARPTAxQfP5x2dMNg9bndqCPRiPtrrbo8BT4';
        // signrawtransaction
        const signedTx = await rpcClient
          .getClient(chainType)
          .signRawTransaction(rawTx, [], [privateKey], false);
        if (!signedTx.hex) {
          toast.error('Sign raw transaction failed');
          return;
        }
        console.log('sign raw transaction result', signedTx);

        // sendrawtransaction
        const txHash = await rpcClient
          .getClient(chainType)
          .sendRawTransaction(signedTx.hex);
        if (!txHash) {
          toast.error('Send raw transaction failed');
          return;
        }
        addLog('TypeScript executed successfully');
      } catch (e) {
        addLog('Execution failed');
        toast.error('Execution failed');
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
        args.push('-debug');
      }
      args.push(file.name);

      const compilationFiles: FileType[] = [];
      files.some(f => {
        if (
          (f.name.endsWith('.c') ||
          f.name.endsWith('.h') ||
          f.name.endsWith('.abi')) && !f.isDirectory
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

        // 刷新文件列表
        if (refreshFiles) {
          await refreshFiles();
        }
        // generateTemplate(file.name);
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
      setIsCompiling(false);
    }
  };

  const generateTemplate = async (sourceFileName: string) => {
    try {
      const baseName = sourceFileName.split('.').slice(0, -1).join('.');
      const abiFileName = `/${baseName}.abi`;
      const abiFile = await getFile(abiFileName);
      console.log('abiFile', abiFile);
      if (!abiFile) {
        toast.error('ABI file not found');
        return;
      }
      // Parse ABI to create the template

      // Generate template JS
      const templateCode = generateContractTemplate(
        JSON.parse(abiFile.content),
      );

      // Ensure .build directory exists
      const buildDir = '/.build';
      try {
        await createFolder(buildDir);
      } catch (e) {
        // Directory might already exist, ignore
      }

      // Save to .build directory
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const timestampFilename = `${baseName}_${timestamp}.ts`;
      const latestFilename = `${baseName}_latest.ts`;

      const timestampFile: FileType = {
        id: `${buildDir}/${timestampFilename}`,
        name: timestampFilename,
        content: templateCode,
        path: `${buildDir}/${timestampFilename}`,
        isDirectory: false,
        lastModified: new Date().toISOString(),
      };

      const latestFile: FileType = {
        id: `${buildDir}/${latestFilename}`,
        name: latestFilename,
        content: templateCode,
        path: `${buildDir}/${latestFilename}`,
        isDirectory: false,
        lastModified: new Date().toISOString(),
      };

      await saveFile(timestampFile);
      await saveFile(latestFile);

      toast.success('Template generated', {
        description: `Saved to .build/${latestFilename}`,
      });
    } catch (error) {
      console.error('Failed to generate template:', error);
      toast.error('Failed to generate template', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
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
      console.log('asm', asm);

      if (asm.success) {
        const abiContent = JSON.parse(abiFile.content);
        abiContent.address = asm.hash;
        abiFile.content = JSON.stringify(abiContent);

        if (debugMode) {
          await saveFile({
            id: sourceFile.name.split('.')[0] + '.dbg',
            name: sourceFile.name.split('.')[0] + '.dbg',
            content: asm.debugInfo,
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

                <div className="space-y-2">
                  <Label htmlFor="method-input" className="text-xs font-medium">
                    Entry Point Method
                  </Label>
                  <Input
                    id="method-input"
                    type="text"
                    value={executeMethod}
                    onChange={e => setExecuteMethod(e.target.value)}
                    placeholder="e.g. main"
                    className="h-12 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
            className="w-[220px] h-14 text-sm font-black uppercase tracking-widest bg-primary text-primary-foreground transition-all hover:scale-[1.01] active:scale-[0.98] shadow-lg shadow-primary/20"
          >
            {isCompiling ? (
              <>
                <PlayIcon className="mr-3 h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <PlayIcon className="mr-3 h-5 w-5 fill-current" />
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
