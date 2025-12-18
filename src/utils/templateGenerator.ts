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
    if (key === 'address' || key === '') continue;

    const signature = key;
    const methodHash = value as string;
    const methodHexWithx = (value as string).slice(1);
    // Parse signature: "void store(int num)"
    const match = signature.match(/\s*(\w+)\s*\((.*)\)/);
    if (!match) continue;

    const methodName = match[1];
    if (!methodName) continue;

    const paramsStr = match[2];
    const params = paramsStr
      ? paramsStr.split(',').map(p => p.trim().split(' ')[1])
      : [];

    mainLogic += `
/**
 * ${signature}
 * Method Hash: ${methodHash}
 */
export function ${methodName}() { // Parameters from ABI: ${params.join(', ')}
    // --- Developer Implementation ---
    console.log("Generating params for ${methodName}...");
    const methodHex = "${methodHexWithx}";
    const revMethodHex = hashReverse(methodHex.padStart(8, "0"));   
    // --- End Developer Implementation ---
}
`;
    methodNames.push(methodName);
  }

  return mainLogic;
}
