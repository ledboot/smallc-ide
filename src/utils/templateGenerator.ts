/**
 * Generates the executable JavaScript code for a contract based on its ABI.
 * This function runs in the browser.
 *
 * @param abi The JSON object representing the contract ABI.
 * @returns A string containing the full, executable JavaScript code.
 */
export function generateContractTemplate(abi: any): string {
  const contractAddress = abi.address;

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
const privateKey = ""; 
`;

  const methodNames: string[] = [];

  // Iterate over ABI entries
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
export function ${methodName}() { // Parameters from ABI: ${params.join(", ")}
    console.log("Generating params for ${methodName}...");
    
    // 1. Construct Transaction Data
    // Logic from deployeContractCard.tsx
    
    // Note: The example logic in deployeContractCard.tsx was specific to a "transfer" like Op.
    // "params" need to be encoded. 
    // In the example: 
    // const amountHex = Number(amount).toString(16).padStart(16, "0");
    // const txData = hashReverse(amountHex) + pkScript;
    
    // For general purpose we might need a generic encoder, but for this specific "store" template,
    // we will provide the raw placeholders as requested.
    
    // The user's request: "store方法的内容需要开发自己填写，返回rawTxHex"
    // So we generate the boilerplate but leave the specific encoding logic for them or provide a suggestion.
    
    const toAddress = contractAddress;
    const ops = getOps(toAddress);
    const pkScript = \`\${toAddress}\${ops}\`; // Simplified based on example

    // --- Developer Implementation Area ---
    // Encode your parameters here.
    // Example for 'store(int num)':
    // const numHex = Number(num).toString(16).padStart(16, "0");
    // const data = hashReverse(numHex); 
    
    // Placeholder Logic:
    const data = ""; // TODO: Implement parameter encoding
    
    const txData = \`\${data}\${pkScript}\`;
    
    // --- End Developer Implementation ---
}
`;
    methodNames.push(methodName);
  }

  return mainLogic;
}
