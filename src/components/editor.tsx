"use client"

import { useEffect, useRef, useCallback } from "react"
import type { Breakpoint, CompiledResult, FileType } from "@/lib/types"
import { saveFile } from "@/lib/db"
import { Editor as MonacoEditor } from "@monaco-editor/react"
import * as monaco from 'monaco-editor'

interface EditorProps {
  file: FileType
  updateFile: (content: string) => void
  compiledResultMap: Map<string, CompiledResult>
  setCompiledResultMap: (map: Map<string, CompiledResult>) => void
  onBreakpointsChange?: (breakpoints: Breakpoint[]) => void
  currentLine?: number
}

export default function Editor({ 
  file, 
  updateFile, 
  compiledResultMap, 
  setCompiledResultMap, 
  onBreakpointsChange,
  currentLine
}: EditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)


  const getLanguage = (fileName: string) => {
    if (fileName.endsWith(".sol")) return "sol"
    if (fileName.endsWith(".c")) return "c"
    if (fileName.endsWith(".cpp") || fileName.endsWith(".cc") || fileName.endsWith(".cxx")) return "cpp"
    if (fileName.endsWith(".h") || fileName.endsWith(".hpp")) return "cpp"
    if (fileName.endsWith(".js")) return "javascript"
    if (fileName.endsWith(".json")) return "json"
    return "plaintext"
  }

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco
  ) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance
    
    const setupBreakpoints = () => {
      const model = editor.getModel()
      if (!model) return
      
      // Set breakpoints from file
      if (file.breakpoints?.length) {
        const breakpoints = file.breakpoints.filter(bp => 
          bp.lineNumber > 0 && bp.lineNumber <= model.getLineCount()
        )
        
        // Add breakpoint decorations for valid breakpoints
        const decorations = breakpoints.map(bp => ({
          range: new monaco.Range(bp.lineNumber, 1, bp.lineNumber, 1),
          options: {
            isWholeLine: false,
            glyphMarginClassName: `breakpoint-glyph ${bp.enabled === false ? 'breakpoint-disabled' : ''}`,
            glyphMarginHoverMessage: bp.condition ? { value: `Condition: ${bp.condition}` } : undefined,
            stickiness: 1 /* NeverGrowsWhenTypingAtEdges */
          }
        }))
        
        if (decorations.length > 0) {
          editor.deltaDecorations([], decorations)
        }
      }
    }
    
    // Initial setup
    setupBreakpoints()
    
    // Handle gutter clicks for breakpoints
    editor.onMouseDown(async (e) => {
      if (!e.target || e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        return
      }
      
      const model = editor.getModel()
      if (!model) return
      
      const lineNumber = e.target.position?.lineNumber
      if (!lineNumber || lineNumber < 1 || lineNumber > model.getLineCount()) return
      
      // Toggle breakpoint
      const decorations = editor.getLineDecorations(lineNumber) || []
      const existingBreakpoint = decorations.find(d => 
        d.options.glyphMarginClassName?.includes('breakpoint-glyph')
      )
      
      try {
        if (existingBreakpoint) {
          // Remove breakpoint
          editor.deltaDecorations([existingBreakpoint.id], [])
        } else {
          // Add breakpoint
          const range = new monaco.Range(lineNumber, 1, lineNumber, 1)
          editor.deltaDecorations([], [{
            range,
            options: {
              isWholeLine: false,
              glyphMarginClassName: 'breakpoint-glyph',
              stickiness: 1 /* NeverGrowsWhenTypingAtEdges */
            }
          }])
        }
        
        // Trigger breakpoint change handler
        handleBreakpointChange({} as monaco.editor.IModelDecorationsChangedEvent)
      } catch (error) {
        console.error('Error toggling breakpoint:', error)
      }
    })
    
    // Re-setup breakpoints when model changes
    const disposable = editor.onDidChangeModel(() => {
      setupBreakpoints()
    })
    
    // Cleanup
    return () => {
      disposable.dispose()
    }
  }

  // Update breakpoint decorations when currentLine changes
  useEffect(() => {
    if (!editorRef.current || currentLine === undefined) return

    const decorations = editorRef.current.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: 'current-line',
            glyphMarginClassName: 'current-line-glyph'
          }
        }
      ]
    )

    return () => {
      if (editorRef.current) {
        editorRef.current.deltaDecorations(decorations, [])
      }
    }
  }, [currentLine])

  // Handle editor content changes
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
      
      if (compiledResultMap.has(file.name)) {
        const newMap = new Map(compiledResultMap)
        newMap.delete(file.name)
        setCompiledResultMap(newMap)
      }
    }, 1000)
  }

  // Handle breakpoint changes
  const handleBreakpointChange = useCallback((_e: monaco.editor.IModelDecorationsChangedEvent) => {
    if (!editorRef.current || !onBreakpointsChange) return
    
    try {
      const model = editorRef.current.getModel()
      if (!model) return
      
      const decorations = model.getAllDecorations()
      const breakpointDecorations = decorations.filter(d => 
        d.options.glyphMarginClassName?.includes('breakpoint-glyph')
      )
      
      const breakpoints: Breakpoint[] = []
      
      for (const d of breakpointDecorations) {
        const lineNumber = d.range.startLineNumber
        // Skip invalid line numbers
        if (lineNumber < 1 || lineNumber > model.getLineCount()) continue
        
        breakpoints.push({
          lineNumber,
          enabled: !d.options.glyphMarginClassName?.includes('breakpoint-disabled'),
          condition: typeof d.options.glyphMarginHoverMessage === 'object' && d.options.glyphMarginHoverMessage && 'value' in d.options.glyphMarginHoverMessage 
            ? String(d.options.glyphMarginHoverMessage.value).replace('Condition: ', '')
            : undefined
        })
      }
      
      onBreakpointsChange(breakpoints)
    } catch (error) {
      console.error('Error handling breakpoint change:', error)
    }
  }, [onBreakpointsChange])


  // Update breakpoint decorations when currentLine changes
  useEffect(() => {
    if (!editorRef.current || currentLine === undefined) return

    const decorations = editorRef.current.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: 'current-line',
            glyphMarginClassName: 'current-line-glyph'
          }
        }
      ]
    )

    return () => {
      if (editorRef.current) {
        editorRef.current.deltaDecorations(decorations, [])
      }
    }
  }, [currentLine])

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        language={getLanguage(file.name)}
        value={file.content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          glyphMargin: true,
          lineNumbersMinChars: 3,
          folding: true,
          lineDecorationsWidth: 10,
          contextmenu: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'line',
          renderWhitespace: 'selection',
          guides: { indentation: true }
        }}
      />
      <style jsx global>{`
        .current-line {
          background-color: rgba(38, 79, 120, 0.25);
        }
        .current-line-glyph {
          background: #0d6efd;
        }
        .monaco-editor .breakpoint-glyph::before {
          content: '';
          display: block;
          position: absolute;
          width: 10px;
          height: 10px;
          background: #f14c4c;
          border-radius: 50%;
          left: 2px;
          top: 50%;
          transform: translateY(-50%);
        }
        
        .monaco-editor .breakpoint-disabled::before {
          opacity: 0.5;
        }
        .monaco-editor .margin {
          cursor: pointer;
        }
        .monaco-editor .line-numbers {
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
