"use client"

import { useRef } from "react"
import type { CompiledResult, FileType } from "@/lib/types"
import { saveFile } from "@/lib/db"
import { Editor as MonacoEditor } from "@monaco-editor/react"

interface EditorProps {
  file: FileType
  updateFile: (content: string) => void
  compiledResultMap: Map<string, CompiledResult>
  setCompiledResultMap: (map: Map<string, CompiledResult>) => void
}

export default function Editor({ file, updateFile, compiledResultMap, setCompiledResultMap }: EditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return

    updateFile(value)

    // Debounce save operation
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveFile({
        ...file,
        content: value,
        lastModified: new Date().toISOString(),
      })
      // 关键：创建新 Map 并 set
      if (compiledResultMap.has(file.name)) {
        const newMap = new Map(compiledResultMap)
        newMap.delete(file.name)
        setCompiledResultMap(newMap)
      }
    }, 1000)
  }

  const getLanguage = (fileName: string) => {
    if (fileName.endsWith(".sol")) return "sol"
    if (fileName.endsWith(".c")) return "c"
    if (fileName.endsWith(".cpp") || fileName.endsWith(".cc") || fileName.endsWith(".cxx")) return "cpp"
    if (fileName.endsWith(".h") || fileName.endsWith(".hpp")) return "cpp"
    if (fileName.endsWith(".js")) return "javascript"
    if (fileName.endsWith(".json")) return "json"
    return "plaintext"
  }

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        language={getLanguage(file.name)}
        value={file.content}
        onChange={handleEditorChange}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    </div>
  )
}
