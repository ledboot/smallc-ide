import { getMonacoInstance } from "@/lib/monaco-instance";
import { useConsoleStore, LogLevel } from "@/lib/console-store";
import { createRequireShim } from "./contractRunner";

export const runTSCode = async (
  code: string,
  methodName: string = "testHash",
  ...args: any[]
) => {
  const monaco = getMonacoInstance();
  const { addLog } = useConsoleStore.getState();

  if (!monaco) {
    addLog("Monaco editor not initialized", LogLevel.ERROR);
    return;
  }

  try {
    // Create a temporary model for compilation
    // We use a unique URI to avoid conflicts
    const uri = monaco.Uri.parse("file:///temp_runner.ts");
    let model = monaco.editor.getModel(uri);

    if (model) {
      model.setValue(code);
    } else {
      model = monaco.editor.createModel(code, "typescript", uri);
    }

    // Ensure we compile to CommonJS so we can capture exports
    const defaults = monaco.languages.typescript.typescriptDefaults;
    const originalOptions = defaults.getCompilerOptions();
    defaults.setCompilerOptions({
      ...originalOptions,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      target: monaco.languages.typescript.ScriptTarget.ES2016,
      noEmit: false,
    });

    // Get the worker proxy
    const workerGetter =
      await monaco.languages.typescript.getTypeScriptWorker();
    const client = await workerGetter(uri);

    // Compile
    const result = await client.getEmitOutput(uri.toString());

    // Restore options (optional, maybe we want to keep it?)
    // defaults.setCompilerOptions(originalOptions);

    const invokeFile = result.outputFiles.find((o: any) =>
      o.name.endsWith(".js")
    );

    if (!invokeFile) {
      addLog("Compilation failed: No output file generated", LogLevel.ERROR);
      return;
    }

    const jsCode = invokeFile.text;

    // Execute
    addLog(`Running method '${methodName}'...`, LogLevel.INFO);
    await executeJS(jsCode, methodName, args);
    // addLog("Execution finished", LogLevel.SUCCESS);
  } catch (e: any) {
    addLog(`Error: ${e.message}`, LogLevel.ERROR);
    console.error(e);
  }
};

const executeJS = async (code: string, methodName: string, args: any[]) => {
  const { addLog } = useConsoleStore.getState();

  // Hijack console
  const originalConsole = console;

  // Helper to format args
  const formatArgs = (args: any[]) => {
    return args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
  };

  const hijackedConsole = {
    ...originalConsole,
    log: (...args: any[]) => {
      addLog(formatArgs(args), LogLevel.INFO);
      originalConsole.log(...args);
    },
    error: (...args: any[]) => {
      addLog(formatArgs(args), LogLevel.ERROR);
      // originalConsole.error(...args);
    },
    warn: (...args: any[]) => {
      addLog(formatArgs(args), LogLevel.WARN);
      // originalConsole.warn(...args);
    },
    info: (...args: any[]) => {
      addLog(formatArgs(args), LogLevel.INFO);
      // originalConsole.info(...args);
    },
  };

  // Evaluate
  try {
    const exports: any = {};
    const require = createRequireShim();

    // We intentionally don't "use strict" globally here so that new Function behaves a bit more loosely,
    // but the emitted code might have it.
    // We pass exports and require to simulate CommonJS environment.
    const fun = new Function("console", "require", "exports", code);
    fun(hijackedConsole, require, exports);

    if (methodName) {
      if (exports[methodName] && typeof exports[methodName] === "function") {
        const result = await exports[methodName](...args);
        if (result !== undefined) {
          addLog(`Result: ${formatArgs([result])}`, LogLevel.SUCCESS);
        } else {
          addLog(
            `Method '${methodName}' executed successfully (no return value)`,
            LogLevel.SUCCESS
          );
        }
      } else {
        const available = Object.keys(exports).filter(
          (k) => typeof exports[k] === "function"
        );
        addLog(
          `Method '${methodName}' not found or not exported. Available: ${available.join(
            ", "
          )}`,
          LogLevel.WARN
        );

        // Fallback: Check if there's a default export?
        // CommonJS: exports.default...
        if (
          exports.default &&
          typeof exports.default[methodName] === "function"
        ) {
          addLog(
            `Found '${methodName}' in default export, executing...`,
            LogLevel.INFO
          );
          const result = await exports.default[methodName](...args);
          if (result !== undefined) {
            addLog(`Result: ${formatArgs([result])}`, LogLevel.SUCCESS);
          }
        }
      }
    }
  } catch (e: any) {
    addLog(`Runtime Error: ${e.message}`, LogLevel.ERROR);
    throw e;
  }
};
