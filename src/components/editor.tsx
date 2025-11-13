"use client";

import { useEffect, useRef } from "react";
import type { Breakpoint, CompiledResult, FileType } from "@/lib/types";
import { saveFile } from "@/lib/db";
import { Editor as MonacoEditor } from "@monaco-editor/react";
import * as monaco from "monaco-editor";

interface EditorProps {
  file: FileType;
  updateFile: (content: string) => void;
  compiledResultMap: Map<string, CompiledResult>;
  setCompiledResultMap: (map: Map<string, CompiledResult>) => void;
  // onBreakpointsChange?: (breakpoints: Breakpoint[]) => void
  currentLine?: number;
}

export default function Editor({
  file,
  updateFile,
  compiledResultMap,
  setCompiledResultMap,
  // onBreakpointsChange,
  currentLine,
}: EditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  const getLanguage = (fileName: string) => {
    if (fileName.endsWith(".sol")) return "sol";
    if (fileName.endsWith(".c")) return "c";
    if (
      fileName.endsWith(".cpp") ||
      fileName.endsWith(".cc") ||
      fileName.endsWith(".cxx")
    )
      return "cpp";
    if (fileName.endsWith(".h") || fileName.endsWith(".hpp")) return "cpp";
    if (fileName.endsWith(".js")) return "javascript";
    if (fileName.endsWith(".json")) return "json";
    return "plaintext";
  };

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco
  ) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    const setupBreakpoints = () => {
      const model = editor.getModel();
      if (!model) return;

      // Set breakpoints from file
      if (file.breakpoints?.length) {
        const breakpoints = file.breakpoints.filter(
          (bp) => bp.lineNumber > 0 && bp.lineNumber <= model.getLineCount()
        );

        // Add breakpoint decorations for valid breakpoints
        const decorations = breakpoints.map((bp) => ({
          range: new monaco.Range(bp.lineNumber, 1, bp.lineNumber, 1),
          options: {
            isWholeLine: false,
            glyphMarginClassName: `breakpoint-glyph ${
              bp.enabled === false ? "breakpoint-disabled" : ""
            }`,
            glyphMarginHoverMessage: bp.condition
              ? { value: `Condition: ${bp.condition}` }
              : undefined,
            stickiness: 1 /* NeverGrowsWhenTypingAtEdges */,
          },
        }));

        if (decorations.length > 0) {
          editor.deltaDecorations([], decorations);
        }
      }
    };

    // Initial setup
    setupBreakpoints();

    // Handle gutter clicks for breakpoints
    editor.onMouseDown(async (e) => {
      if (
        !e.target ||
        e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
      ) {
        return;
      }

      const model = editor.getModel();
      if (!model) return;

      const lineNumber = e.target.position?.lineNumber;
      if (!lineNumber || lineNumber < 1 || lineNumber > model.getLineCount())
        return;

      // Toggle breakpoint
      const decorations = editor.getLineDecorations(lineNumber) || [];
      const existingBreakpoint = decorations.find((d) =>
        d.options.glyphMarginClassName?.includes("breakpoint-glyph")
      );

      try {
        if (existingBreakpoint) {
          // Remove breakpoint
          editor.deltaDecorations([existingBreakpoint.id], []);
        } else {
          // Add breakpoint
          const range = new monaco.Range(lineNumber, 1, lineNumber, 1);
          editor.deltaDecorations(
            [],
            [
              {
                range,
                options: {
                  isWholeLine: false,
                  glyphMarginClassName: "breakpoint-glyph",
                  stickiness: 1 /* NeverGrowsWhenTypingAtEdges */,
                },
              },
            ]
          );
        }

        // Trigger breakpoint change handler
        handleBreakpointChange();
      } catch (error) {
        console.error("Error toggling breakpoint:", error);
      }
    });

    // Re-setup breakpoints when model changes
    const disposable = editor.onDidChangeModel(() => {
      setupBreakpoints();
    });

    // Cleanup
    return () => {
      disposable.dispose();
    };
  };

  // Update breakpoint decorations when currentLine changes

  // Handle editor content changes
  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    updateFile(value);

    // Debounce save operation
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveFile({
        ...file,
        content: value,
        lastModified: new Date().toISOString(),
      });

      if (compiledResultMap.has(file.name)) {
        const newMap = new Map(compiledResultMap);
        newMap.delete(file.name);
        setCompiledResultMap(newMap);
      }
    }, 500);
  };

  // Handle breakpoint changes
  const handleBreakpointChange = () => {
    if (!editorRef.current) return;
    try {
      const model = editorRef.current.getModel();
      if (!model) return;

      const decorations = model.getAllDecorations();
      const breakpointDecorations = decorations.filter((d) =>
        d.options.glyphMarginClassName?.includes("breakpoint-glyph")
      );

      const breakpoints: Breakpoint[] = [];
      console.log("breakpointDecorations", breakpointDecorations);

      for (const d of breakpointDecorations) {
        const lineNumber = d.range.startLineNumber;
        const lineContent = model.getLineContent(lineNumber) || "";

        // Skip invalid line numbers or empty lines
        if (
          lineNumber < 1 ||
          lineNumber > model.getLineCount() ||
          !lineContent.trim()
        ) {
          // Remove invalid breakpoint decorations
          if (d.id) {
            editorRef.current.deltaDecorations([d.id], []);
          }
          continue;
        }

        // Ensure we have valid column positions
        const lineLength = Math.max(1, lineContent.length);
        const startColumn = Math.min(1, lineLength);
        const endColumn = Math.max(1, lineLength);

        // Update the decoration if the range is invalid
        if (
          d.range.startColumn !== startColumn ||
          d.range.endColumn !== endColumn
        ) {
          const newRange = new monaco.Range(
            lineNumber,
            startColumn,
            lineNumber,
            endColumn
          );
          editorRef.current.deltaDecorations(
            [d.id],
            [
              {
                range: newRange,
                options: d.options,
              },
            ]
          );
        }

        // Add the breakpoint to our list
        breakpoints.push({
          lineNumber,
          enabled: !d.options.glyphMarginClassName?.includes(
            "breakpoint-disabled"
          ),
          condition:
            typeof d.options.glyphMarginHoverMessage === "object" &&
            d.options.glyphMarginHoverMessage &&
            "value" in d.options.glyphMarginHoverMessage
              ? String(d.options.glyphMarginHoverMessage.value).replace(
                  "Condition: ",
                  ""
                )
              : undefined,
        });
      }

      console.log("breakpoints", breakpoints);

      // Update file.breakpoints if we have valid breakpoints
      file.breakpoints = [...breakpoints];
    } catch (error) {
      console.error("Error handling breakpoint change:", error);
    }
  };

  // Update current line highlighting when currentLine changes
  useEffect(() => {
    if (!editorRef.current || currentLine === undefined) return;

    try {
      const model = editorRef.current.getModel();
      if (!model) return;

      const lineCount = model.getLineCount();

      // Ensure currentLine is within valid range
      const validLineNumber = Math.max(1, Math.min(currentLine, lineCount));
      if (validLineNumber > lineCount) return;

      const lineContent = model.getLineContent(validLineNumber) || "";
      const lineLength = Math.max(1, lineContent.length);

      const decorations = editorRef.current.deltaDecorations(
        [],
        [
          {
            range: new monaco.Range(
              validLineNumber,
              1,
              validLineNumber,
              lineLength
            ),
            options: {
              isWholeLine: true,
              className: "current-line",
              glyphMarginClassName: "current-line-glyph",
              stickiness: 1 /* NeverGrowsWhenTypingAtEdges */,
            },
          },
        ]
      );

      return () => {
        if (editorRef.current) {
          try {
            editorRef.current.deltaDecorations(decorations, []);
          } catch (error) {
            console.error("Error cleaning up current line decorations:", error);
          }
        }
      };
    } catch (error) {
      console.error("Error updating current line highlight:", error);
    }
  }, [currentLine]);

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        language={getLanguage(file.name)}
        value={file.content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="github-light"
        options={{
          minimap: { 
            enabled: true,
            side: 'right',
            size: 'proportional',
            showSlider: 'mouseover',
            renderCharacters: true,
            maxColumn: 120,
            scale: 1,
          },
          fontSize: 14,
          wordWrap: "on",
          automaticLayout: true,
          tabSize: 2,
          glyphMargin: true,
          lineNumbersMinChars: 3,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbers: "on",
          contextmenu: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          renderWhitespace: "selection",
          guides: { indentation: true },
          overviewRulerLanes: 3,
          overviewRulerBorder: true,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: true,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            verticalScrollbarSize: 12,
            horizontalScrollbarSize: 12,
            arrowSize: 20
          }
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
          content: "";
          display: block;
          position: absolute;
          width: 12px;
          height: 12px;
          background: #ff4d4f;
          border: 1px solid #fff;
          border-radius: 50%;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
        }

        .monaco-editor .breakpoint-glyph:hover::before {
          transform: translate(-50%, -50%) scale(1.1);
          box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.3);
        }

        .monaco-editor .breakpoint-disabled::before {
          background: #d9d9d9;
          border-color: #f5f5f5;
          opacity: 0.7;
        }
        .monaco-editor .margin {
          cursor: pointer;
        }
        .monaco-editor .line-numbers {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
