"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { FileType } from "@/lib/types"
import { compileWithWasm, initWasmCompiler } from "@/lib/wasm-compiler"
import { PlayIcon, AlertCircleIcon, CheckCircleIcon, InfoIcon } from "lucide-react"

interface CompilationPanelProps {
  currentFile: FileType | null
  compilationOutput: string
  setCompilationOutput: (output: string) => void
}

export default function CompilationPanel({
  currentFile,
  compilationOutput,
  setCompilationOutput,
}: CompilationPanelProps) {
  const [isCompiling, setIsCompiling] = useState(false)
  const [compilationSuccess, setCompilationSuccess] = useState<boolean | null>(null)
  const [wasmReady, setWasmReady] = useState(false)
  const [initializingWasm, setInitializingWasm] = useState(true)

  useEffect(() => {
    const initializeCompiler = async () => {
      try {
        await initWasmCompiler()
        setWasmReady(true)
        setCompilationOutput("WebAssembly compiler initialized successfully")
      } catch (error) {
        console.warn("WASM compiler not available:", error)
        setCompilationOutput(`WebAssembly compiler not available: ${error}\n\nC/C++ files will use simulation mode.`)
        setWasmReady(false)
      } finally {
        setInitializingWasm(false)
      }
    }

    initializeCompiler()
  }, [setCompilationOutput])

  const handleCompile = async () => {
    if (!currentFile) {
      setCompilationOutput("Please select a file to compile")
      setCompilationSuccess(false)
      return
    }

    const fileName = currentFile.name
    const isC = fileName.endsWith(".c")
    const isCpp = fileName.endsWith(".cpp") || fileName.endsWith(".cc") || fileName.endsWith(".cxx")
    const isSol = fileName.endsWith(".sol")
    const isHeader = fileName.endsWith(".h") || fileName.endsWith(".hpp")

    if (isHeader) {
      setCompilationOutput("Header files cannot be compiled directly. Include them in a source file.")
      setCompilationSuccess(false)
      return
    }

    if (!isSol && !isC && !isCpp) {
      setCompilationOutput("Please select a C, C++, or Solidity file to compile")
      setCompilationSuccess(false)
      return
    }

    if (!wasmReady && (isC || isCpp)) {
      setCompilationOutput("WebAssembly compiler is not ready. Please wait for initialization.")
      setCompilationSuccess(false)
      return
    }

    setIsCompiling(true)
    setCompilationSuccess(null)

    try {
      if (isSol) {
        // Solidity compilation simulation (unchanged)
        await new Promise((resolve) => setTimeout(resolve, 1500))
        const mockOutput = {
          contracts: {
            [currentFile.name]: {
              [currentFile.name.replace(".sol", "")]: {
                abi: [
                  {
                    /* mock ABI */
                  },
                ],
                evm: { bytecode: { object: "0x..." } },
              },
            },
          },
        }
        setCompilationOutput(JSON.stringify(mockOutput, null, 2))
        setCompilationSuccess(true)
      } else if (isC || isCpp) {
        // Try to use WebAssembly compiler, fall back to simulation
        if (wasmReady) {
          try {
            const output = await compileWithWasm(fileName)
            setCompilationOutput(`Compilation successful for ${fileName}\n\n${output}`)
            setCompilationSuccess(true)
          } catch (error) {
            setCompilationOutput(`Compilation failed for ${fileName}\n\n${error}`)
            setCompilationSuccess(false)
          }
        } else {
          // Fallback to simulation
          await new Promise((resolve) => setTimeout(resolve, 1000))
          setCompilationOutput(`Compilation simulation for ${fileName}
Generated executable: ${fileName.replace(/\.(c|cpp|cc|cxx)$/, "")}
Compiler: ${isC ? "gcc" : "g++"}
Flags: -Wall -Wextra ${isC ? "-std=c99" : "-std=c++17"}

Note: This is a simulation. Add scc_wasm.js to public directory for real compilation.`)
          setCompilationSuccess(true)
        }
      }
    } catch (error) {
      setCompilationOutput(`Compilation error: ${error instanceof Error ? error.message : String(error)}`)
      setCompilationSuccess(false)
    } finally {
      setIsCompiling(false)
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium">Compiler</h3>
        <Button
          onClick={handleCompile}
          disabled={
            isCompiling ||
            !currentFile ||
            currentFile.name.endsWith(".h") ||
            currentFile.name.endsWith(".hpp") ||
            (initializingWasm && (currentFile.name.endsWith(".c") || currentFile.name.endsWith(".cpp")))
          }
          size="sm"
        >
          {isCompiling ? (
            <>
              <PlayIcon className="mr-2 h-4 w-4 animate-spin" />
              Compiling...
            </>
          ) : (
            <>
              <PlayIcon className="mr-2 h-4 w-4" />
              Compile
            </>
          )}
        </Button>
      </div>

      {initializingWasm && (
        <Alert className="mb-4">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>Initializing WebAssembly compiler... Please wait.</AlertDescription>
        </Alert>
      )}

      {!wasmReady && !initializingWasm && (
        <Alert className="mb-4" variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>
            WebAssembly compiler failed to initialize. C/C++ compilation is not available.
          </AlertDescription>
        </Alert>
      )}

      {compilationSuccess !== null && (
        <div
          className={`mb-4 flex items-center rounded-md p-2 text-sm ${
            compilationSuccess ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {compilationSuccess ? (
            <>
              <CheckCircleIcon className="mr-2 h-4 w-4" />
              Compilation successful
            </>
          ) : (
            <>
              <AlertCircleIcon className="mr-2 h-4 w-4" />
              Compilation failed
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto rounded-md border bg-muted p-2 font-mono text-sm whitespace-pre-wrap">
        {compilationOutput || "Compilation output will appear here"}
      </div>
    </div>
  )
}
