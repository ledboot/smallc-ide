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
  ChevronDown,
  ChevronUp,
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
import { TinDef, ToutDef } from "@/utils/defs";
import {
  DeployedContractCardProps,
  DeployedContractCard,
} from "./deployeContractCard";

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
  const [privateKey, setPrivateKey] = useState("");
  const [utxo, setUtxo] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const cFiles = files.filter((file) => file.name.endsWith(".c"));
  const selectedFile = files.find((file) => file.id === selectedFileId) || null;

  // const [deployedContracts, setDeployedContracts] = useState<
  //   Map<string, DeployedContractCardProps[]>
  // >(new Map());

  const [deployedContractsMap, setDeployedContractsMap] = useState<
    Map<string, DeployedContractCardProps[]>
  >(() => {
    return new Map([
      [
        "storage.c",
        [
          {
            contractAddress: "0x1234567890123456789012345678901234567890",
            abi: JSON.stringify({
              "void store(int num)": "xb792d88c",
              "void retrieve()": "x60352ae4",
            }),
            contractName: "storage.c",
          },
        ],
      ],
    ]);
  });

  const [currentDeployedContract, setCurrentDeployedContract] = useState<
    DeployedContractCardProps[] | null
  >(null);

  // Auto-select first .c file if none selected and files are available
  useEffect(() => {
    const deployedContracts = deployedContractsMap.get(selectedFileId || "");
    console.log("deployedContracts", deployedContracts);
    if (deployedContracts) {
      setCurrentDeployedContract(deployedContracts);
    }

    // setCurrentDeployedContract(deployedContracts.get(cFiles[0].name) ?? null);
    // setCurrentDeployedContract(mockContracts.get(cFiles[0].name) ?? null);
  }, [selectedFileId]);

  const handleContractSelect = (fileId: string) => {
    console.log("fileId", fileId);
    setSelectedFileId(fileId);
  };

  const [isDeployedContractsExpanded, setIsDeployedContractsExpanded] =
    useState(true);

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

    const result = compiledResultMap.get(selectedFile.name);
    if (!result) {
      toast.error("Please compile the contract first");
      return;
    }
    console.log("compiledResult", result);

    setIsDeploying(true);
    setDeploymentResult(null);

    const script = "88" + result.hash + "00000000" + result.bytecode;

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
    console.log("script size", script.length * 1000);

    toutDef.pkScript = script;
    msg.tOut.push(toutDef);
    msg.lockTime = 0;
    msg.signatureScripts = [];
    const rawTx = msg.encode(0);
    const rawTxHex = bytesToHex2(rawTx);

    // signrawtransaction
    const [signedTx, signErr] = await rpcClient
      .getClient(chainType)
      .signRawTransaction(rawTxHex, [], [privateKey], false);
    if (signErr) {
      toast.error("Sign raw transaction failed:", { description: signErr });
      setIsDeploying(false);
      return;
    }
    console.log("sign raw transaction result", signedTx);
    if (!signedTx.hex) {
      toast.error("Sign raw transaction failed");
      setIsDeploying(false);
      return;
    }

    // sendrawtransaction
    const [txHash, sendErr] = await rpcClient
      .getClient(chainType)
      .sendRawTransaction(signedTx.hex);
    if (sendErr) {
      toast.error("Send raw transaction failed:", { description: sendErr });
      setIsDeploying(false);
      return;
    }
    console.log("txHash", txHash);
    setIsDeploying(false);

    // After successful deployment
    const newContract = {
      contractAddress: result.hash, // or the actual contract address
      abi: result.abi,
      contractName: selectedFile.name,
    };
    setDeployedContractsMap((prev) => {
      const newMap = new Map(prev);
      const contracts = newMap.get(selectedFile.name) || [];
      newMap.set(selectedFile.name, [...contracts, newContract]);
      return newMap;
    });

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

          <div className="flex-col items-center space-y-2 text-sm">
            <Input
              type="text"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Enter your wallet private key"
            />
            <Input
              type="text"
              value={utxo}
              onChange={(e) => setUtxo(e.target.value)}
              placeholder="Enter UTXO"
            />
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
                value={selectedFileId || cFiles[0].id}
                onValueChange={handleContractSelect}
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

      <Card className="mt-6">
        <CardHeader
          className="pb-2 cursor-pointer hover:bg-muted/50 rounded-t-lg transition-colors"
          onClick={() =>
            setIsDeployedContractsExpanded(!isDeployedContractsExpanded)
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CardTitle>Deployed Contracts</CardTitle>
            </div>
            {isDeployedContractsExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {isDeployedContractsExpanded && (
          <CardContent className="px-2">
            {currentDeployedContract &&
              Array.from(currentDeployedContract).map((contract, index) => (
                <DeployedContractCard
                  contractAddress={contract.contractAddress}
                  abi={contract.abi}
                  contractName={contract.contractName}
                  key={`${contract.contractAddress}-${index}`}
                />
              ))}
          </CardContent>
        )}
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
