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
import {
  PlayIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  FileIcon,
  Bug,
} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import type {CompiledResult, FileType} from '@/lib/types';
import {compilerService, isWasmReady} from '@/lib/wasm-compiler';
import {createFolder, getFile, saveFile} from '@/lib/db';
import {toast} from 'sonner';

import {Asm} from '@/lib/asm';

import {generateContractTemplate} from '@/utils/templateGenerator';
import {runContractMethod} from '@/utils/contractRunner';
import {useConsoleStore} from '@/lib/console-store';
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
  const [compilationSuccess, setCompilationSuccess] = useState<boolean | null>(
    null,
  );

  const [compiledData, setCompiledData] = useState<CompiledResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const {addLog} = useConsoleStore();
  const {chainType} = useRootStore().settings;
  const compiledResultMap = useCompilerStore(state => state.compiledResultMap);
  const setCompiledResult = useCompilerStore(state => state.setCompiledResult);
  const [executeMethod, setExecuteMethod] = useState('');

  // Filter out .c and .ts files
  const sourceFiles = files.filter(
    file => file.name.endsWith('.c') || file.name.endsWith('.ts'),
  );

  // Automatically select first file
  useEffect(() => {
    if (sourceFiles.length > 0 && !selectedFile) {
      setSelectedFile(sourceFiles[0]!.id);
    }
  }, [sourceFiles, selectedFile]);

  useEffect(() => {
    const file = sourceFiles.find(f => f.id === selectedFile);
    console.log('compiledResultMap', compiledResultMap);
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
      // setCompilationOutput("Please select a file to compile");
      setCompilationSuccess(false);
      return;
    }

    const file = sourceFiles.find(f => f.id === selectedFile);
    if (!file) {
      // setCompilationOutput("Selected file not found");
      setCompilationSuccess(false);
      return;
    }

    setIsCompiling(true);
    setCompilationSuccess(null);

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
        // const result = await rpcClient
        //   .getClient(chainType)
        //   .sendRawTransaction(rawTx);
        // console.log("result", result);
        setCompilationSuccess(true);
        toast.success('TypeScript executed successfully');
      } catch (e) {
        setCompilationSuccess(false);
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
          f.name.endsWith('.c') ||
          f.name.endsWith('.h') ||
          f.name.endsWith('.abi')
        ) {
          compilationFiles.push(f);
        }
      });
      if (compilationFiles.length === 0) {
        // setCompilationOutput("No C files found");
        setCompilationSuccess(false);
        return;
      }

      console.log('compilationFiles', compilationFiles, 'args ', args);

      const result = await compilerService.compile(compilationFiles, args);
      console.log('compile result', result);

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
        // generateTemplate(file.name);
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
        // const compiledResult = compiledResultMap.get(sourceFile.name);
        // if (compiledResult) {
        //   compiledResultMap.delete(sourceFile.name);
        // }
        const abiContent = JSON.parse(abiFile.content);
        abiContent.address = asm.hash;
        abiFile.content = JSON.stringify(abiContent);

        if (debugMode) {
          await writeDbgFile(sourceFile.name, asm.debugInfo);
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

  const writeDbgFile = async (fileName: string, dbgContent: string) => {
    const dbgFile: FileType = {
      id: fileName.split('.')[0] + '.dbg',
      name: fileName.split('.')[0] + '.dbg',
      content: dbgContent,
      lastModified: new Date().toISOString(),
    };
    await saveFile(dbgFile);
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

          {compilationSuccess !== null && (
            <div
              className={`flex items-start gap-4 p-5 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 ${
                compilationSuccess
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {compilationSuccess ? (
                <div className="p-2 bg-emerald-500/20 rounded-full shrink-0">
                  <CheckCircleIcon className="h-5 w-5" />
                </div>
              ) : (
                <div className="p-2 bg-destructive/20 rounded-full shrink-0">
                  <AlertCircleIcon className="h-5 w-5" />
                </div>
              )}
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-wider">
                  {compilationSuccess ? 'Build Complete' : 'Build Error'}
                </p>
                <p className="text-xs font-medium leading-relaxed opacity-80">
                  {selectedFile?.endsWith('.ts')
                    ? compilationSuccess
                      ? 'The script executed successfully and the transaction was broadcast to the network.'
                      : 'Something went wrong during script execution. Please check the logs below.'
                    : compilationSuccess
                      ? 'Your contract has been built successfully and all debug symbols are ready.'
                      : 'There was an error in your source code. Check the console for precise line numbers.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
