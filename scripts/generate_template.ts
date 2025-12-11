import * as fs from "fs";
import * as path from "path";

// Configuration
const projectRoot = path.resolve(__dirname, "..");
const abiPath = path.join(projectRoot, "contract-example", "storage.abi.json");
const outputPath = path.join(
  projectRoot,
  "contract-example",
  "storage_runner.js"
);

function generateRunner() {
  console.log("Generating runner...");

  // 1. Read ABI
  if (!fs.existsSync(abiPath)) {
    console.error(`ABI file not found: ${abiPath}`);
    return;
  }
  const abiContent = fs.readFileSync(abiPath, "utf8");
  const abi = JSON.parse(abiContent);
  const contractAddress = abi.address;

  // 2. Generate Contract Definitions
  let mainLogic = `
const contractAddress = "${contractAddress}";

// Example Input Helpers
function getOps(addr) {
    const ops = {
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
    return ops[addr.slice(0, 2).toLowerCase()] || "";
}

// User to fill this
const privateKey = ""; // Mock for signing if needed, but example only returned rawTxHex
`;

  const methodNames: string[] = [];
  for (const [key, value] of Object.entries(abi)) {
    if (key === "address" || key === "") continue;

    const signature = key;
    const methodHash = value;
    // Parse signature: "void store(int num)"
    const match = signature.match(/\s*(\w+)\s*\((.*)\)/);
    if (!match) continue;

    const methodName = match[1];
    const paramsStr = match[2];
    const params = paramsStr
      ? paramsStr.split(",").map((p) => p.trim().split(" ")[1])
      : [];

    mainLogic += `
/**
 * ${signature}
 * Method Hash: ${methodHash}
 */
async function ${methodName}(${params.join(", ")}) { // Parameters from ABI
    console.log("Generating params for ${methodName}...");
    
    // --- Developer Implementation Area ---
    // Encode your parameters here.
    // Example for 'store(int num)':
    // const numHex = Number(num).toString(16).padStart(16, "0");
    // const data = hashReverse(numHex); 
    
    // Placeholder Logic:
    const data = ""; // TODO: Implement parameter encoding
    
    const toAddress = contractAddress;
    const ops = getOps(toAddress);
    const pkScript = \`\${toAddress}\${ops}\`; 
    const txData = \`\${data}\${pkScript}\`;

    const msg = new MsgT();
    msg.version = 0x11;
    msg.txDef = [];
    msg.tIn = [];
    
    const toutDef = new ToutDef();
    toutDef.tokenType = 0n;
    toutDef.value = 0n;
    // Magic prefix "88" + contractAddress + txData
    toutDef.pkScript = "88" + contractAddress + txData; 
    
    msg.tOut.push(toutDef);
    msg.lockTime = 0;
    msg.signatureScripts = [];
    
    const rawTx = msg.encode(0);
    // bytesToHex2 needs to be available in bundled utils
    const rawTxHex = bytesToHex2(rawTx);
    
    return rawTxHex;
}
`;
    methodNames.push(methodName);
  }

  // Add return statement to export methods
  mainLogic += `
return {
    ${methodNames.join(",\n    ")}
};
`;

  fs.writeFileSync(outputPath, mainLogic);
  console.log(`Generated ${outputPath}`);
}

generateRunner();
