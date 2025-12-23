'use client';

import {useState, useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {Badge} from '@/components/ui/badge';
import {
  RocketIcon,
  FuelIcon as GasIcon,
  NetworkIcon,
  InfoIcon,
  FileIcon,
} from 'lucide-react';
import type {FileType} from '@/lib/types';
import {ChainType, CHAIN_INFO} from '@/constants';
import {useRootStore} from '@/state';
import {settingsStore} from '@/state/settings';
import {toast} from 'sonner';
import {MsgT} from '@/utils/msgTools';
import {rpcClient} from '@/lib/api';
import {bytesToHex2} from '@/utils/index';
import {TinDef, ToutDef} from '@/utils/defs';
import {Address} from '@/utils/address';
import {getFile, saveFile, createFolder} from '@/lib/db';
import {generateContractTemplate} from '@/utils/templateGenerator';

import {useCompilerStore} from '@/state/compiler';

interface DeployPanelProps {
  files: FileType[];
}

export default function DeployPanel({files}: DeployPanelProps) {
  const {chainType} = useRootStore().settings;
  const compiledResultMap = useCompilerStore(state => state.compiledResultMap);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState('');
  const [utxo, setUtxo] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileType | null>(null);
  const [utxoValueStr, setUtxoValueStr] = useState<string>('');

  const cFiles = files.filter(file => file.name.endsWith('.c'));

  const handleContractSelect = (fileId: string) => {
    setSelectedFile(cFiles.find(file => file.id === fileId) ?? null);
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

  const [isDeployedContractsExpanded, setIsDeployedContractsExpanded] =
    useState(true);

  const handleDeploy = async () => {
    if (!selectedFile || !selectedFile.name.endsWith('.c')) {
      toast.error('Please select a contract to deploy');
      return;
    }

    if (!privateKey || !utxo) {
      toast.error('Please enter a private key and UTXO');
      return;
    }

    if (!utxo.includes(':')) {
      toast.error('Please enter a valid UTXO');
      return;
    }
    const [hash, index] = utxo.split(':');
    if (!hash || !index) {
      toast.error('Please enter a valid UTXO');
      return;
    }

    const result = compiledResultMap.get(selectedFile.name);
    if (!result) {
      toast.error('Please compile the contract first');
      return;
    }
    console.log('compiledResult', result);

    setIsDeploying(true);
    setDeploymentResult(null);

    const script = '88' + result.hash + '00000000' + result.bytecode;

    const msg = new MsgT();
    msg.version = 0x11;
    msg.txDef = [];
    const tinDef = new TinDef();
    if (utxo) {
      tinDef.previousOutPoint = {
        hash,
        index: parseInt(index),
      };
      tinDef.signatureIndex = 0;
      tinDef.sequence = 0xffffffff;
    }
    msg.tIn.push(tinDef);

    const toutDef = new ToutDef();
    toutDef.tokenType = 0n;
    toutDef.value = 0n;
    toutDef.pkScript = script;

    const fee = 1200 + script.length * 1000;
    console.log('fee', fee);

    const changeToutDef = new ToutDef();
    changeToutDef.tokenType = 0n;
    const changeAmount = BigInt(utxoValueStr) - BigInt(fee);
    console.log('changeAmount', changeAmount);
    console.log('utxoValueStr', utxoValueStr);
    console.log('fee', fee);

    if (changeAmount < 0) {
      toast.error('Insufficient funds for deployment and fee.');
      setIsDeploying(false);
      return;
    }
    changeToutDef.value = changeAmount;
    changeToutDef.pkScript = Address.toPkScript(
      'mszzWYjHEpmGx2LmdZLtud64PADqFHNhHD',
    );

    msg.tOut.push(toutDef, changeToutDef);
    msg.lockTime = 0;
    msg.signatureScripts = [];
    const rawTx = msg.encode(0);
    const rawTxHex = bytesToHex2(rawTx);

    // signrawtransaction
    const signedTx = await rpcClient
      .getClient(chainType)
      .signRawTransaction(rawTxHex, [], [privateKey], false);
    if (!signedTx.hex) {
      toast.error('Sign raw transaction failed');
      setIsDeploying(false);
      return;
    }
    console.log('sign raw transaction result', signedTx);

    // sendrawtransaction
    const txHash = await rpcClient
      .getClient(chainType)
      .sendRawTransaction(signedTx.hex);
    if (!txHash) {
      toast.error('Send raw transaction failed');
      setIsDeploying(false);
      return;
    }
    console.log('txHash', txHash);
    setIsDeploying(false);

    toast.success('Transaction sent successfully');

    toast.success('Transaction sent successfully');

    await generateTemplate(selectedFile.name);

    // --- Persistence Logic ---
    try {
      const baseName = selectedFile.name.split('.').slice(0, -1).join('.');
      const abiFileName = `/${baseName}.abi`;
      const abiFile = await getFile(abiFileName);

      let methodIdentifiers: Record<string, string> = {};
      if (abiFile) {
        try {
          const abi = JSON.parse(abiFile.content);
          // Filter out address and extract method signatures and hashes
          Object.entries(abi).forEach(([key, value]) => {
            if (key !== 'address' && key !== '') {
              methodIdentifiers[key] = value as string;
            }
          });
        } catch (e) {
          console.error('Failed to parse ABI for persistence', e);
        }
      }

      // We assume generateTemplate creates this file. Ideally we'd get the path returned,
      // but constructing it here matches the logic in generateTemplate.
      const timestamp = Math.floor(Date.now() / 1000).toString();
      // Note: generateTemplate typically runs *after* this, but we are inside handleDeploy.
      // Actually generateTemplate generates the file we need to reference.
      // We should use the path that generateTemplate WILL create or HAS created.
      // Since we await generateTemplate above, the file should exist.
      // However, generateTemplate uses a timestamp generated inside it.
      // Wait, generateTemplate is defined below and uses `Math.floor(Date.now() / 1000)`.
      // If we want the exact same timestamp, we might need to modify generateTemplate or pass it in.
      // For now, let's assume "run-latest.json" points to the "latest" ts file.

      const tsFile = `/.build/${baseName}_latest.ts`;
      // The requirement says: tsFile is the generated ts file.
      // Since generateTemplate generates both timestamped and latest, referencing latest is safer/easier.

      const runData = {
        hash: txHash,
        contractAddress: '', // Requested to be empty
        transaction: {
          from: Address.toPkScript('mszzWYjHEpmGx2LmdZLtud64PADqFHNhHD'), // Using the specific change address logic from earlier
          gas: fee.toString(),
          input: rawTxHex,
          chainId: chainType, // or specific ID if needed, using chainType string for now
        },
        tsFile: tsFile,
        methodIdentifiers: methodIdentifiers,
      };

      const broadcastDir = `/.broadcast/${selectedFile.name}`;
      await createFolder(broadcastDir);

      const runJsonContent = JSON.stringify(runData, null, 2);

      // Save timestamped version (using current time, might slightly differ from generateTemplate's time but that is creating the TS file, this describes the RUN)
      const runTimestampFilename = `${broadcastDir}/run-${timestamp}.json`;
      await saveFile({
        id: runTimestampFilename,
        name: `run-${timestamp}.json`,
        content: runJsonContent,
        path: runTimestampFilename,
        isDirectory: false,
        lastModified: new Date().toISOString(),
      });

      // Save latest version
      const runLatestFilename = `${broadcastDir}/run-latest.json`;
      await saveFile({
        id: runLatestFilename,
        name: 'run-latest.json',
        content: runJsonContent,
        path: runLatestFilename,
        isDirectory: false,
        lastModified: new Date().toISOString(),
      });

      console.log('Deployment info saved to', runLatestFilename);
    } catch (e) {
      console.error('Failed to persist deployment info', e);
      toast.error('Failed to save deployment info');
    }
    // --- End Persistence Logic ---
  };

  const handleSetChainType = (chainType: ChainType) => {
    settingsStore.setState({chainType});
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

      <div className="flex-1 space-y-10 overflow-y-auto pr-1">
        {/* Environment Section - Flat */}
        <div className="space-y-6">
          <div className="space-y-6 px-1">
            <div className="space-y-2">
              <Label htmlFor="network" className="text-xs font-semibold">
                TARGET NETWORK
              </Label>
              <Select value={chainType} onValueChange={handleSetChainType}>
                <SelectTrigger
                  id="network"
                  className="h-12 transition-all hover:bg-muted/40 focus:ring-0 focus:ring-offset-0 focus:ring-primary/20"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-none shadow-xl bg-background/95 backdrop-blur-md">
                  {Object.entries(CHAIN_INFO).map(([type, info]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-3 py-1">
                        <NetworkIcon className="h-4 w-4 opacity-50" />
                        <span className="font-medium">{info.label}</span>
                        <Badge
                          variant="outline"
                          className="ml-auto text-[9px] font-black tracking-tighter h-4 border-muted-foreground/20"
                        >
                          {info.chainId}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="private-key" className="text-xs font-semibold">
                  WALLET CREDENTIALS
                </Label>
                <Input
                  id="private-key"
                  type="password"
                  value={privateKey}
                  onChange={e => setPrivateKey(e.target.value)}
                  placeholder="Enter private key (WIF)"
                  className="h-12 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="utxo" className="text-xs font-semibold ">
                    INPUT UTXO
                  </Label>
                  <Input
                    id="utxo"
                    type="text"
                    value={utxo}
                    onChange={e => setUtxo(e.target.value)}
                    placeholder="txid:index"
                    className="h-12 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="utxo-value"
                    className="text-xs font-semibold "
                  >
                    AMOUNT
                  </Label>
                  <Input
                    id="utxo-value"
                    type="text"
                    value={utxoValueStr}
                    onChange={e => setUtxoValueStr(e.target.value)}
                    placeholder="Value"
                    className="h-12 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Deploy Section - Flat */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-1 border-t pt-8">
            <FileIcon className="h-4 w-4 text-primary/70" />
            <span className="text-sm font-bold uppercase tracking-widest">
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
                {selectedFile && (
                  <p className="text-[10px] font-bold text-primary/60 mt-2 px-2 uppercase tracking-widest animate-pulse">
                    Target: {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying || !selectedFile}
                  className="w-[220px] h-14 text-sm font-black uppercase tracking-widest bg-primary text-primary-foreground transition-all hover:scale-[1.01] active:scale-[0.98] shadow-lg shadow-primary/20"
                >
                  {isDeploying ? (
                    <>
                      <GasIcon className="mr-3 h-5 w-5 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <RocketIcon className="mr-3 h-5 w-5 fill-current" />
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
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px] text-center font-medium">
                Compile your contract first to generate deployable code.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
