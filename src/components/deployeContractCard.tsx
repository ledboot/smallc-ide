import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { bytesToHex2, hashReverse } from "@/utils/index";
import { MsgT } from "@/utils/msgTools";
import { rpcClient } from "@/lib/api";
import { ToutDef } from "@/utils/defs";
import { useRootStore } from "@/state";

export interface ContractMethod {
  signature: string;
  name: string;
  methodHash: string;
  parameters: string[];
}

export interface DeployedContractCardProps {
  contractAddress: string;
  abi: string;
  contractName: string;
}

export const DeployedContractCard = ({
  contractAddress,
  abi,
  contractName,
}: DeployedContractCardProps) => {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const { chainType } = useRootStore().settings;

  const handleInputChange = (methodSignature: string, value: string) => {
    setInputValues((prev) => ({
      ...prev,
      [methodSignature]: value,
    }));
  };

  if (!abi) return null;

  const parseABI = (abiString: string): ContractMethod[] => {
    try {
      const abiObj = JSON.parse(abiString);
      return Object.entries(abiObj)
        .filter(([key]) => key !== "address" && key !== "")
        .map(([signature, methodHash]) => {
          // Extract method name from signature (everything before the first parenthesis)
          const name = signature.split("(")[0].trim().split(" ")[1];
          const parameters = signature.split("(")[1].split(")")[0].split(",");
          return {
            name,
            signature,
            methodHash: methodHash as string,
            parameters,
          };
        });
    } catch (e) {
      console.error("Failed to parse ABI:", e);
      return [];
    }
  };

  const hasParameters = (method: ContractMethod) => {
    return (
      method.signature.includes("(") &&
      !method.signature.endsWith("()") &&
      !method.signature.endsWith("( )")
    );
  };

  const handleMethodClick = (method: ContractMethod) => async () => {
    const inputParams = inputValues[method.signature];
    const defParams = method.parameters;
    if (defParams.length !== inputParams.split(",").length) {
      toast.error("Parameter count mismatch");
      return;
    }
    console.log(
      `Calling ${method.signature} with params:`,
      inputParams,
      "defParams",
      defParams
    );
    // TODO: Implement actual contract method call
    const params = inputParams.split(",");

    const toAddress = contractAddress;
    const ops: Record<string, string> = {
      "00": "41000000",
      "6f": "41000000",
      "3f": "41000000",
      "7b": "42000000",
      "c4": "42000000",
      "05": "42000000",
      "78": "43000000",
      "67": "43000000",
      "60": "43000000",
      "88": "",
    };
    const pkScript = `${toAddress}${ops[toAddress.slice(0, 2).toLowerCase()]}`;

    const amount = BigInt(1);
    // $t = sprintf("%s%s%s%s%s", rev64(sprintf("%016x", $amount)), rev64(sprintf("%016x", 12+24)), rev64(sprintf("%016x", 12+24+25)), $pkScript, $sig);
    const amountHex = Number(amount).toString(16).padStart(16, "0");
    const revAmountHex = hashReverse(amountHex); // rev64(sprintf("%016x", $amount))

    // const txData = `${revAmount}${revPkScript}`;

    const amountReversed = hashReverse(amountHex);
    const txData = `${amountReversed}${pkScript}`;

    const msg = new MsgT();
    msg.version = 0x11;
    msg.txDef = [];
    msg.tIn = [];
    const toutDef = new ToutDef();
    toutDef.tokenType = 0n;
    toutDef.value = 0n;
    toutDef.pkScript = "88" + contractAddress + txData;
    msg.tOut.push(toutDef);
    msg.lockTime = 0;
    msg.signatureScripts = [];
    const rawTx = msg.encode(0);
    const rawTxHex = bytesToHex2(rawTx);
    const [result, err] = await rpcClient
      .getClient(chainType)
      .contractCall(toAddress, rawTxHex);
    if (err) {
      toast.error("Contract call failed", { description: err });
      return;
    }
    console.log("result", result);
  };

  const methods = parseABI(abi);

  if (methods.length === 0) return null;

  return (
    <Card className=" border-gray-700">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-mono">{contractName}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-xs font-mono">
              {contractAddress.slice(0, 7)}...{contractAddress.slice(-4)}
            </div>
            <Copy
              className="w-3 h-3 font-mono hover:text-blue-500 hover:cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(contractAddress);
                toast.success("Address copied to clipboard");
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="space-y-2">
          {methods.map((method, index) => {
            const methodHasParams = hasParameters(method);
            return (
              <div key={index} className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleMethodClick(method)}
                    className={`px-3 py-1.5 text-xs cursor-pointer font-mono rounded bg-gray-700 hover:bg-gray-600 text-gray-200`}
                  >
                    {method.name}
                  </button>

                  {methodHasParams && (
                    <>
                      <input
                        type="text"
                        value={inputValues[method.signature] || ""}
                        onChange={(e) =>
                          handleInputChange(method.signature, e.target.value)
                        }
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-600 rounded text-black placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder={
                          method.signature.match(/\(([^)]+)\)/)?.[1] || "value"
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
