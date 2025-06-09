"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RocketIcon, WalletIcon, FuelIcon as GasIcon, NetworkIcon, InfoIcon, ExternalLinkIcon } from "lucide-react"
import type { FileType } from "@/lib/types"

interface DeployPanelProps {
  files: FileType[]
  currentFile: FileType | null
}

export default function DeployPanel({ files, currentFile }: DeployPanelProps) {
  const [selectedNetwork, setSelectedNetwork] = useState("sepolia")
  const [gasLimit, setGasLimit] = useState("3000000")
  const [gasPrice, setGasPrice] = useState("20")
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentResult, setDeploymentResult] = useState<string | null>(null)

  const solidityFiles = files.filter((file) => file.name.endsWith(".sol"))
  const networks = [
    { id: "mainnet", name: "Ethereum Mainnet", chainId: 1 },
    { id: "sepolia", name: "Sepolia Testnet", chainId: 11155111 },
    { id: "goerli", name: "Goerli Testnet", chainId: 5 },
    { id: "polygon", name: "Polygon Mainnet", chainId: 137 },
    { id: "mumbai", name: "Polygon Mumbai", chainId: 80001 },
  ]

  const handleDeploy = async () => {
    if (!currentFile || !currentFile.name.endsWith(".sol")) {
      setDeploymentResult("Please select a Solidity contract to deploy")
      return
    }

    setIsDeploying(true)
    setDeploymentResult(null)

    try {
      // Simulate deployment process
      await new Promise((resolve) => setTimeout(resolve, 3000))

      const mockTxHash = "0x" + Math.random().toString(16).substr(2, 64)
      const mockAddress = "0x" + Math.random().toString(16).substr(2, 40)

      setDeploymentResult(`Deployment successful!
Contract Address: ${mockAddress}
Transaction Hash: ${mockTxHash}
Network: ${networks.find((n) => n.id === selectedNetwork)?.name}
Gas Used: ${Math.floor(Math.random() * 1000000 + 500000)}`)
    } catch (error) {
      setDeploymentResult(`Deployment failed: ${error}`)
    } finally {
      setIsDeploying(false)
    }
  }

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
            <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {networks.map((network) => (
                  <SelectItem key={network.id} value={network.id}>
                    <div className="flex items-center gap-2">
                      <NetworkIcon className="h-4 w-4" />
                      {network.name}
                      <Badge variant="outline" className="text-xs">
                        {network.chainId}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <WalletIcon className="h-4 w-4" />
            <span>Wallet: Not Connected</span>
            <Button variant="outline" size="sm">
              Connect
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Gas Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gasLimit">Gas Limit</Label>
              <Input
                id="gasLimit"
                value={gasLimit}
                onChange={(e) => setGasLimit(e.target.value)}
                placeholder="3000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gasPrice">Gas Price (Gwei)</Label>
              <Input id="gasPrice" value={gasPrice} onChange={(e) => setGasPrice(e.target.value)} placeholder="20" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Deploy Contract</CardTitle>
          <CardDescription>
            {currentFile?.name.endsWith(".sol")
              ? `Ready to deploy: ${currentFile.name}`
              : "Select a Solidity file to deploy"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {solidityFiles.length > 0 ? (
            <div className="space-y-2">
              <Label>Available Contracts</Label>
              <div className="space-y-1">
                {solidityFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between rounded-md border p-2 text-sm ${
                      currentFile?.id === file.id ? "bg-accent" : ""
                    }`}
                  >
                    <span>{file.name}</span>
                    <Badge variant="secondary">Contract</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Alert>
              <InfoIcon className="h-4 w-4" />
              <AlertDescription>No Solidity contracts found. Create a .sol file to get started.</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleDeploy}
            disabled={isDeploying || !currentFile?.name.endsWith(".sol")}
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
            <pre className="whitespace-pre-wrap text-xs font-mono bg-muted p-2 rounded">{deploymentResult}</pre>
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
  )
}
