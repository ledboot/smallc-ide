import { getAllFiles } from "./db";
interface WasmModule {
  FS: {
    analyzePath: (path: string) => { exists: boolean };
    mkdir: (path: string) => void;
    isFile: (path: string) => boolean;
    readFile: (path: string, opts?: { encoding?: string, flags?: string }) => string;
    writeFile: (path: string, content: string) => void;
    readdir: (path: string) => string[];
    unlink: (path: string) => void;
    chdir?: (path: string) => void;
  };
  onRuntimeInitialized: () => void;
  callMain: (args: string[]) => number;
  print: (...args: unknown[]) => void;
  printErr: (...args: unknown[]) => void;
}
declare global {
  interface Window {
    Module: WasmModule;
  }
}

let wasmModule: WasmModule | null = null;
let isModuleReady = false;


export const initWasmCompiler = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isModuleReady && wasmModule) {
      resolve();
      return;
    }

    window.Module = {
      onRuntimeInitialized: () => {
        wasmModule = window.Module;
        isModuleReady = true;
        try {
          if (!wasmModule.FS.analyzePath('/workspace').exists) {
            wasmModule.FS.mkdir('/workspace');
          }
          if (!wasmModule.FS.isFile("/workspace/buildin.c")) {
            const builtInC = wasmModule.FS.readFile("/buildin.c", { encoding: "utf8" });
            wasmModule.FS.writeFile("/workspace/buildin.c", builtInC);
          }
          getAllFiles().then((files) => {
            files.forEach((file) => {
              wasmModule?.FS.writeFile(`/workspace/${file.name}`, file.content);
            });
          });
          const files = wasmModule.FS.readdir("/workspace");
          console.log("files", files);
        } catch (e) {
          console.error('wasmModule init error:', e);
          reject(e);
        }
        resolve();
      },
      print: function (...args: unknown[]) {
        // 可以自定义输出逻辑
        const text = args.join(" ");
        // 这里可以输出到控制台或页面元素
        console.log(text);
      },
      printErr: function (...args: unknown[]) {
        const text = args.join(" ");
        // 这里可以输出到控制台或页面元素
        console.log(text);
      }
    } as unknown as WasmModule;

    // 检查 scc_wasm.js 是否存在
    fetch("/smallc_wasm.js")
      .then((response) => {
        if (!response.ok) {
          throw new Error("smallc_wasm.js not found");
        }
        return response.text();
      })
      .then(() => {
        // 加载 smallc_wasm.js 脚本
        const script = document.createElement("script");
        script.src = "/smallc_wasm.js";
        script.onload = () => {
          console.log("smallc_wasm.js loaded");
        };
        script.onerror = () => {
          reject(new Error("Failed to load WebAssembly compiler"));
        };
        document.head.appendChild(script);
      })
      .catch(() => {
        reject(
          new Error(
            "smallc_wasm.js not found. Please add the WebAssembly compiler file to the public directory."
          )
        );
      });
  });
};

export const writeFileToMemFS = (filename: string, content: string): void => {
  if (!wasmModule || !isModuleReady) {
    // Silently fail if WASM is not ready
    return;
  }

  try {
    const path = `/workspace/${filename}`;
    wasmModule.FS.writeFile(path, content);
    console.log("writeFileToMemFS", path);
    const files = wasmModule.FS.readdir("/workspace");
    console.log("files", files);
  } catch (error) {
    console.warn("Failed to write file to MEMFS:", error);
  }
};

export const readFileFromMemFS = (filename: string): string => {
  if (!isWasmReady()) {
    return "";
  }
  return wasmModule?.FS.readFile(filename, { encoding: "utf8" }) || "";
};

export const deleteFileFromMemFS = (filename: string): void => {
  if (!wasmModule || !isModuleReady) {
    return;
  }

  try {
    const path = `/workspace/${filename}`;
    wasmModule.FS.unlink(path);
    console.log("deleteFileFromMemFS", path);
    const files = wasmModule.FS.readdir("/workspace");
    console.log("files", files);
  } catch (error) {
    // File might not exist, ignore error
    console.warn("Failed to delete file from MEMFS:", error);
  }
};

export const compileWithWasm = (filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!wasmModule || !isModuleReady) {
      reject(new Error("WebAssembly module not initialized"));
      return;
    }

    try {
      // Set working directory
      // wasmModule.FS.chdir("/workspace");

      // Prepare compilation arguments
      const args = [filename];

      // Capture output
      let output = "";
      const originalPrint = wasmModule.print;
      const originalPrintErr = wasmModule.printErr;

      wasmModule.print = (text: unknown) => {
        output += text + "\n";
      };

      wasmModule.printErr = (text: unknown) => {
        output += "Error: " + text + "\n";
      };

      try {
        // Call compiler
        console.log("callMain", args);
        const ret = wasmModule.callMain(args);
        console.log("ret", ret);
        const files = wasmModule.FS.readdir("/workspace");
        console.log("files", files);

        // Restore original output functions
        wasmModule.print = originalPrint;
        wasmModule.printErr = originalPrintErr;

        if (ret === 0) {
          resolve(output || "Compilation successful");
        } else {
          reject(
            new Error(output || `Compilation failed with exit code ${ret}`)
          );
        }
      } catch (error) {
        // Restore original output functions
        wasmModule.print = originalPrint;
        wasmModule.printErr = originalPrintErr;

        reject(new Error(`Compilation error: ${error}`));
      }
    } catch (error) {
      reject(new Error(`Failed to compile: ${error}`));
    }
  });
};

export const isWasmReady = (): boolean => {
  return isModuleReady && wasmModule !== null;
};
