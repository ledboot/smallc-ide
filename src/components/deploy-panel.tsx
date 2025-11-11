"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  RocketIcon,
  FuelIcon as GasIcon,
  NetworkIcon,
  InfoIcon,
  ExternalLinkIcon,
  FileIcon,
} from "lucide-react";
import type { FileType } from "@/lib/types";
import { ChainType, CHAIN_INFO } from "@/constants";
import { useRootStore } from "@/state";
import { settingsStore } from "@/state/settings";
import { CompiledResult } from "@/lib/types";
import { toast } from "sonner";
import { MsgT } from "@/utils/msgTools";
import { rpcClient } from "@/lib/api";
import { bytesToHex2 } from "@/utils/index";

interface DeployPanelProps {
  files: FileType[];
  compiledResultMap: Map<string, CompiledResult>;
}

export default function DeployPanel({
  files,
  compiledResultMap,
}: DeployPanelProps) {
  const { chainType } = useRootStore().settings;
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<string>("");
  const [utxo, setUtxo] = useState<string>("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const cFiles = files.filter((file) => file.name.endsWith(".c"));
  const selectedFile = files.find((file) => file.id === selectedFileId) || null;
  const selectedNetwork = CHAIN_INFO[chainType];

  // Auto-select first .c file if none selected and files are available
  useEffect(() => {
    if (cFiles.length > 0 && !selectedFileId) {
      setSelectedFileId(cFiles[0].id);
    }
  }, [cFiles, selectedFileId]);

  const handleDeploy = async () => {
    if (!selectedFile || !selectedFile.name.endsWith(".c")) {
      toast.error("Please select a contract to deploy");
      return;
    }

    if (!privateKey || !utxo) {
      toast.error("Please enter a private key and UTXO");
      return;
    }

    if (!utxo.includes(":")) {
      toast.error("Please enter a valid UTXO");
      return;
    }
    const [hash, index] = utxo.split(":");
    if (!hash || !index) {
      toast.error("Please enter a valid UTXO");
      return;
    }

    const compiledResult = compiledResultMap.get(selectedFile.name);
    if (!compiledResult) {
      toast.error("Please compile the contract first");
      return;
    }
    console.log("compiledResult", compiledResult);

    setIsDeploying(true);
    setDeploymentResult(null);


    const script = "88" + compiledResult.hash + "00000000" + compiledResult.bytecode;

    const msg = new MsgT();
    msg.version = 0x11;
    msg.txDef = [];
    if (utxo) {
      msg.tIn = [
        {
          previousOutPoint: {
            hash,
            index: parseInt(index),
          },
          signatureIndex: 0,
          sequence: 0xffffffff,
        },
      ];
    } else {
      msg.tIn = [];
    }
    msg.tOut = [
      {
        tokenType: 0,
        value: 0,
        pkScript: script,
      },
    ];
    msg.lockTime=0;
    msg.signatureScripts=[];
    const rawTx = msg.encode(0);
    const rawTxHex = bytesToHex2(rawTx);

    // signrawtransaction
    const signedTx = await rpcClient.getClient(chainType).signRawTransaction(rawTxHex, [], [privateKey], "ALL");

    console.log("signedTx", signedTx);

    // sendrawtransaction
    const txHash = await rpcClient.getClient(chainType).sendRawTransaction(signedTx);

    console.log("txHash", txHash);
    setIsDeploying(false);

    toast.success("Transaction sent successfully");
  };

  const handleSetChainType = (chainType: ChainType) => {
    settingsStore.setState({ chainType });
  };

  return (
    <div className="flex h-full flex-col p-4 space-y-4">
      <div className="flex items-center gap-2">
        <RocketIcon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Deploy & Run Transactions</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Environment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="network">Network</Label>
            <Select value={chainType} onValueChange={handleSetChainType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHAIN_INFO).map(([chainType, chainInfo]) => (
                  <SelectItem key={chainType} value={chainType}>
                    <div className="flex items-center gap-2">
                      <NetworkIcon className="h-4 w-4" />
                      {chainInfo.label}
                      <Badge variant="outline" className="text-xs">
                        {chainInfo.chainId}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-col items-center space-y-2 text-sm text-muted-foreground">
            <Input
              type="text"
              value={privateKey}
              placeholder="Enter your wallet private key"
            />
            <Input type="text" value={utxo} placeholder="Enter UTXO" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Deploy Contract</CardTitle>
          <CardDescription>
            {selectedFile
              ? `Ready to deploy: ${selectedFile.name}`
              : "Select a C file to deploy"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cFiles.length > 0 ? (
            <div className="space-y-2">
              <Label>Available Contracts</Label>
              <Select
                value={selectedFileId || ""}
                onValueChange={setSelectedFileId}
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select a file..." />
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
          ) : (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>
                No C contracts found. Create a .c file to get started.
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleDeploy}
            disabled={isDeploying || !selectedFile}
            className="w-full"
          >
            {isDeploying ? (
              <>
                <GasIcon className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <RocketIcon className="mr-2 h-4 w-4" />
                Deploy
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {deploymentResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Deployment Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-2 rounded">
              {deploymentResult}
            </pre>
            {deploymentResult.includes("successful") && (
              <Button variant="outline" size="sm" className="mt-2">
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                View on Explorer
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
