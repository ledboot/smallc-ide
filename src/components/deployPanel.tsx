'use client';

import {useState, useEffect, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RocketIcon,
  FuelIcon as GasIcon,
  InfoIcon,
  FileIcon,
} from 'lucide-react';
import type {FileType, CompiledResult} from '@/types';

import {toast} from 'sonner';
import {MsgT} from '@/utils/msgTools';
import {bytesToHex2} from '@/utils/index';
import {TinDef, ToutDef} from '@/utils/defs';
import {Address} from '@/utils/address';
import {getFile, saveFile, createFolder} from '@/lib/db';
import {generateContractTemplate} from '@/utils/templateGenerator';
import {cn} from '@/utils/twMerge';
import {Asm} from '@/lib/asm';

import {useCompilerStore} from '@/state/useCompiler';
import {useDeployStore} from '@/state/useDeploy';
import {useConsoleStore, LogLevel} from '@/state/useConsole';
import {useFileStore} from '@/state/useFile';
import {useWalletStore} from '@/state/useWallet';

export default function DeployPanel() {
  const compiledResultMap = useCompilerStore(state => state.compiledResultMap);
  const setCompiledResult = useCompilerStore(state => state.setCompiledResult);
  const [isDeploying, setIsDeploying] = useState(false);
  const {files, refreshFiles} = useFileStore();

  const {
    isConnected,
    currentAccount,
    network,
    getCurrentAccountUtxos,
    signTransaction,
    sendTransaction,
  } = useWalletStore();

  const {selectedFileId, setSelectedFileId} = useDeployStore();

  const {addLog} = useConsoleStore();

  const cFiles = files.filter(
    file =>
      file.name.endsWith('.c') &&
      !file.isDirectory &&
      file.name !== 'buildin.c',
  );

  const selectedFile = cFiles.find(file => file.id === selectedFileId) ?? null;

  const handleContractSelect = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  const restoreCompiledResultFromStorage = useCallback(
    async (sourceFile: FileType): Promise<CompiledResult | null> => {
      try {
        const baseName = sourceFile.name.split('.').slice(0, -1).join('.');
        const lastSlashIndex = sourceFile.id.lastIndexOf('/');
        const parentDir =
          lastSlashIndex > 0 ? sourceFile.id.substring(0, lastSlashIndex) : '';
        const asmFileName = parentDir
          ? `${parentDir}/${baseName}.asm`
          : `/${baseName}.asm`;
        const abiFileName = parentDir
          ? `${parentDir}/${baseName}.abi`
          : `/${baseName}.abi`;

        const asmFile = await getFile(asmFileName);
        if (!asmFile || !asmFile.content) {
          return null;
        }

        const asm = Asm.assemble(asmFile.content);
        if (!asm.success) {
          console.error('Failed to assemble .asm file:', asm.error);
          return null;
        }

        const abiFile = await getFile(abiFileName);
        let abiContent = abiFile ? abiFile.content : '';
        if (abiFile) {
          try {
            const abiObj = JSON.parse(abiFile.content);
            abiObj.address = asm.hash;
            abiContent = JSON.stringify(abiObj);
          } catch (e) {
            console.error('Failed to parse ABI', e);
          }
        }

        const compiledResult: CompiledResult = {
          bytecode: asm.bytecode,
          abi: abiContent,
          hash: asm.hash,
        };

        setCompiledResult(sourceFile.name, compiledResult);
        return compiledResult;
      } catch (error) {
        console.error('Failed to restore compiled result:', error);
        return null;
      }
    },
    [setCompiledResult],
  );

  // Auto-select first contract if none selected
  useEffect(() => {
    if (cFiles.length > 0 && !selectedFileId && cFiles[0]) {
      setSelectedFileId(cFiles[0].id);
    }
  }, [cFiles, selectedFileId, setSelectedFileId]);

  // Try to restore compiled result from IndexedDB if missing in memory
  useEffect(() => {
    if (selectedFile && !compiledResultMap.has(selectedFile.name)) {
      restoreCompiledResultFromStorage(selectedFile);
    }
  }, [selectedFile, compiledResultMap, restoreCompiledResultFromStorage]);

  const generateTemplate = async (sourceFile: FileType, timestamp: string) => {
    try {
      const baseName = sourceFile.name.split('.').slice(0, -1).join('.');
      const lastSlashIndex = sourceFile.id.lastIndexOf('/');
      const parentDir =
        lastSlashIndex > 0 ? sourceFile.id.substring(0, lastSlashIndex) : '';
      const abiFileName = parentDir
        ? `${parentDir}/${baseName}.abi`
        : `/${baseName}.abi`;
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
      await createFolder(buildDir);

      // Save to .build directory
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
      return timestampFile.id;
    } catch (error) {
      console.error('Failed to generate template:', error);
      toast.error('Failed to generate template', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
      return '';
    }
  };

  const handleDeploy = async () => {
    if (!isConnected || !currentAccount) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!selectedFile || !selectedFile.name.endsWith('.c')) {
      toast.error('Please select a contract to deploy');
      return;
    }

    let result = compiledResultMap.get(selectedFile.name);
    if (!result) {
      result =
        (await restoreCompiledResultFromStorage(selectedFile)) ?? undefined;
      if (result) {
        addLog(
          `Restored compiled result from storage for ${selectedFile.name}`,
          {hash: result.hash},
          LogLevel.INFO,
        );
      }
    }

    if (!result) {
      toast.error('Please compile the contract first');
      return;
    }

    setIsDeploying(true);

    try {
      // 1. Fetch UTXOs from wallet
      // 2. Prepare the contract deployment script
      // SmallC Deployment format: 0x88 (OP_DEPLOY) + contractHash + 00000000 + bytecode
      const script = '88' + result.hash + '00000000' + result.bytecode;
      const fee = 1200 + script.length * 1000; // Legacy fee calculation
      const minRequiredValue = BigInt(fee + 1000);
      const utxos = await getCurrentAccountUtxos(minRequiredValue);

      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs found in your wallet');
      }

      // 3. Find a suitable UTXO (simplistic selection: first one with enough balance)
      // Note: SmallC UTXOs usually have tokenType 0 for ZENT.
      const selectedUtxo = utxos.find(u => BigInt(u.value) >= minRequiredValue);
      if (!selectedUtxo) {
        throw new Error(
          `Insufficient funds. Need at least ${fee + 1000} satoshis.`,
        );
      }

      const msg = new MsgT();
      msg.version = 0x11;
      msg.txDef = [];

      const tinDef = new TinDef();
      tinDef.previousOutPoint = {
        hash: selectedUtxo.txid,
        index: selectedUtxo.index,
      };
      tinDef.signatureIndex = 0;
      tinDef.sequence = 0xffffffff;
      msg.tIn.push(tinDef);

      // Output 1: Contract deployment script
      const toutDef = new ToutDef();
      toutDef.tokenType = 0n;
      toutDef.value = 0n;
      toutDef.pkScript = script;

      // Output 2: Change
      const changeToutDef = new ToutDef();
      changeToutDef.tokenType = 0n;
      const changeAmount = BigInt(selectedUtxo.value) - BigInt(fee);
      changeToutDef.value = changeAmount;
      // Use connected account address for change
      changeToutDef.pkScript = Address.toPkScript(currentAccount);

      msg.tOut.push(toutDef, changeToutDef);
      msg.lockTime = 0;
      msg.signatureScripts = [];
      const rawTx = msg.encode(0);
      const rawTxHex = bytesToHex2(rawTx);

      // 4. Sign via wallet extension
      addLog('Requesting signature from wallet...', null, LogLevel.INFO);
      const signedTxHex = await signTransaction(rawTxHex);
      addLog('Transaction signed', {signedTxHex}, LogLevel.SUCCESS);

      // 5. Broadcast via wallet extension
      addLog('Broadcasting transaction...', null, LogLevel.INFO);
      const txHash = await sendTransaction(signedTxHex);
      addLog('Transaction broadcasted!', {txHash}, LogLevel.SUCCESS);

      toast.success('Contract deployed successfully!');

      // 6. Post-deployment persistence
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const templateFileId = await generateTemplate(selectedFile, timestamp);

      const baseName = selectedFile.name.split('.').slice(0, -1).join('.');
      const lastSlashIndex = selectedFile.id.lastIndexOf('/');
      const parentDir =
        lastSlashIndex > 0 ? selectedFile.id.substring(0, lastSlashIndex) : '';
      const abiFileName = parentDir
        ? `${parentDir}/${baseName}.abi`
        : `/${baseName}.abi`;
      const abiFile = await getFile(abiFileName);

      const methodIdentifiers: Record<string, string> = {};
      if (abiFile) {
        try {
          const abi = JSON.parse(abiFile.content);
          Object.entries(abi).forEach(([key, value]) => {
            if (key !== 'address' && key !== '') {
              methodIdentifiers[key] = value as string;
            }
          });
        } catch (e) {
          console.error('Failed to parse ABI', e);
        }
      }

      const runData = {
        hash: txHash,
        contractAddress: result.hash,
        transaction: {
          from: currentAccount,
          gas: fee.toString(),
          input: rawTxHex,
          chainId: network?.chainId || 1,
        },
        tsFile: templateFileId,
        methodIdentifiers: methodIdentifiers,
      };

      const broadcastDir = `/.broadcast/${selectedFile.name}`;
      await createFolder(broadcastDir);
      const runJsonContent = JSON.stringify(runData, null, 2);

      await saveFile({
        id: `${broadcastDir}/run-${timestamp}.json`,
        name: `run-${timestamp}.json`,
        content: runJsonContent,
        path: `${broadcastDir}/run-${timestamp}.json`,
        isDirectory: false,
        lastModified: new Date().toISOString(),
      });

      await saveFile({
        id: `${broadcastDir}/run-latest.json`,
        name: 'run-latest.json',
        content: runJsonContent,
        path: `${broadcastDir}/run-latest.json`,
        isDirectory: false,
        lastModified: new Date().toISOString(),
      });
      refreshFiles();
    } catch (e: any) {
      console.error('Deployment failed:', e);
      addLog('Deployment Error', e.message || e, LogLevel.ERROR);
      toast.error(e.message || 'Deployment failed');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-2 pt-4 space-y-10">
      {/* Integrated Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <RocketIcon className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Deploy Contract</h2>
        </div>
      </div>

      <div className="flex-1 space-y-10 pr-1">
        {/* Deploy Section - Flat */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-1 border-t pt-8">
            <FileIcon className="h-4 w-4 text-primary/70" />
            <span className="text-sm font-bold tracking-widest">
              Contract Deployment
            </span>
          </div>

          {cFiles.length > 0 ? (
            <div className="space-y-6 px-1">
              <div className="space-y-2">
                <Label
                  htmlFor="contract-select"
                  className="text-xs font-semibold"
                >
                  SELECT CONTRACT
                </Label>
                <Select
                  value={selectedFile?.id || ''}
                  onValueChange={handleContractSelect}
                >
                  <SelectTrigger
                    id="contract-select"
                    className="h-12 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    <SelectValue placeholder="Ready artifacts..." />
                  </SelectTrigger>
                  <SelectContent className="border-none shadow-xl bg-background/95 backdrop-blur-md">
                    {cFiles.map(file => (
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
              <div className="flex justify-center">
                <Button
                  onClick={isConnected ? handleDeploy : undefined}
                  disabled={isDeploying || (isConnected && !selectedFile)}
                  className={cn(
                    'w-fit px-8 h-10 text-xs font-bold tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-primary/20 rounded-xl group relative overflow-hidden border-none',
                    !isConnected &&
                      'bg-muted text-muted-foreground cursor-not-allowed opacity-70',
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:animate-shimmer pointer-events-none" />
                  {!isConnected ? (
                    <>
                      <InfoIcon className="mr-2 h-4 w-4" />
                      Connect Wallet
                    </>
                  ) : isDeploying ? (
                    <>
                      <GasIcon className="mr-2 h-4 w-4 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <RocketIcon className="mr-2 h-4 w-4 fill-current transition-transform group-hover:scale-110" />
                      Deploy
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 bg-muted/10 rounded-3xl mx-1">
              <div className="rounded-full bg-muted/20 p-4 mb-4">
                <InfoIcon className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-bold text-muted-foreground/80">
                No Artifacts
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-50 text-center font-medium">
                Compile your contract first to generate deployable code.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
