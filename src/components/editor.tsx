'use client';

import {useEffect, useRef} from 'react';
import type {Breakpoint, FileType} from '@/lib/types';
import {saveFile} from '@/lib/db';
import {Editor as MonacoEditor} from '@monaco-editor/react';
import {useCompilerStore} from '@/state/compiler';
import * as monaco from 'monaco-editor';

interface EditorProps {
  file: FileType;
  updateFile: (content: string) => void;
  // onBreakpointsChange?: (breakpoints: Breakpoint[]) => void
  currentLine?: number;
}

export default function Editor({
  file,
  updateFile,
  // onBreakpointsChange,
  currentLine,
}: EditorProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const compiledResultMap = useCompilerStore(state => state.compiledResultMap);
  const removeCompiledResult = useCompilerStore(
    state => state.removeCompiledResult,
  );

  const getLanguage = (fileName: string, id: string) => {
    if (id === 'home') return 'plaintext';
    if (fileName.endsWith('.sol')) return 'sol';
    if (fileName.endsWith('.c')) return 'c';
    if (
      fileName.endsWith('.cpp') ||
      fileName.endsWith('.cc') ||
      fileName.endsWith('.cxx')
    )
      return 'cpp';
    if (fileName.endsWith('.h') || fileName.endsWith('.hpp')) return 'cpp';
    if (fileName.endsWith('.js')) return 'javascript';
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.ts')) return 'typescript';
    return 'plaintext';
  };

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: typeof monaco,
  ) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Set global instance for runner access
    import('@/lib/monaco-instance').then(({setMonacoInstance}) => {
      setMonacoInstance(monacoInstance, editor);
    });

    // Add extra libs for external modules
    monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(
      `
      declare module "@noble/hashes/sha2.js" {
        export function sha256(msg: Uint8Array | string): Uint8Array;
      }
      declare module "@noble/hashes/sha2" {
        export function sha256(msg: Uint8Array | string): Uint8Array;
      }
       declare module "@noble/hashes/sha256" {
        export function sha256(msg: Uint8Array | string): Uint8Array;
      }
      declare module "big-integer" {
        function bigInt(value: any): any;
        export = bigInt;
      }
      `,
      'file:///node_modules/@types/external-libs/index.d.ts',
    );

    const setupBreakpoints = () => {
      const model = editor.getModel();
      if (!model) return;

      // Set breakpoints from file
      if (file.breakpoints?.length) {
        const breakpoints = file.breakpoints.filter(
          bp => bp.lineNumber > 0 && bp.lineNumber <= model.getLineCount(),
        );

        // Add breakpoint decorations for valid breakpoints
        const decorations = breakpoints.map(bp => ({
          range: new monaco.Range(bp.lineNumber, 1, bp.lineNumber, 1),
          options: {
            isWholeLine: false,
            glyphMarginClassName: `breakpoint-glyph ${
              bp.enabled === false ? 'breakpoint-disabled' : ''
            }`,
            glyphMarginHoverMessage: bp.condition
              ? {value: `Condition: ${bp.condition}`}
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
    editor.onMouseDown(async e => {
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
      const existingBreakpoint = decorations.find(d =>
        d.options.glyphMarginClassName?.includes('breakpoint-glyph'),
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
                  glyphMarginClassName: 'breakpoint-glyph',
                  stickiness: 1 /* NeverGrowsWhenTypingAtEdges */,
                },
              },
            ],
          );
        }

        // Trigger breakpoint change handler
        handleBreakpointChange();
      } catch (error) {
        console.error('Error toggling breakpoint:', error);
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
        removeCompiledResult(file.name);
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
      const breakpointDecorations = decorations.filter(d =>
        d.options.glyphMarginClassName?.includes('breakpoint-glyph'),
      );

      const breakpoints: Breakpoint[] = [];
      console.log('breakpointDecorations', breakpointDecorations);

      for (const d of breakpointDecorations) {
        const lineNumber = d.range.startLineNumber;
        const lineContent = model.getLineContent(lineNumber) || '';

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
            endColumn,
          );
          editorRef.current.deltaDecorations(
            [d.id],
            [
              {
                range: newRange,
                options: d.options,
              },
            ],
          );
        }

        // Add the breakpoint to our list
        breakpoints.push({
          lineNumber,
          enabled: !d.options.glyphMarginClassName?.includes(
            'breakpoint-disabled',
          ),
          condition:
            typeof d.options.glyphMarginHoverMessage === 'object' &&
            d.options.glyphMarginHoverMessage &&
            'value' in d.options.glyphMarginHoverMessage
              ? String(d.options.glyphMarginHoverMessage.value).replace(
                  'Condition: ',
                  '',
                )
              : undefined,
        });
      }

      console.log('breakpoints', breakpoints);

      // Update file.breakpoints if we have valid breakpoints
      file.breakpoints = [...breakpoints];
    } catch (error) {
      console.error('Error handling breakpoint change:', error);
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

      const lineContent = model.getLineContent(validLineNumber) || '';
      const lineLength = Math.max(1, lineContent.length);

      const decorations = editorRef.current.deltaDecorations(
        [],
        [
          {
            range: new monaco.Range(
              validLineNumber,
              1,
              validLineNumber,
              lineLength,
            ),
            options: {
              isWholeLine: true,
              className: 'current-line',
              glyphMarginClassName: 'current-line-glyph',
              stickiness: 1 /* NeverGrowsWhenTypingAtEdges */,
            },
          },
        ],
      );

      return () => {
        if (editorRef.current) {
          try {
            editorRef.current.deltaDecorations(decorations, []);
          } catch (error) {
            console.error('Error cleaning up current line decorations:', error);
          }
        }
      };
    } catch (error) {
      console.error('Error updating current line highlight:', error);
    }
  }, [currentLine]);

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        path={file.id}
        language={getLanguage(file.name, file.id)}
        value={file.content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="github-light"
        options={{
          readOnly: file.id === 'home',
          // Disable syntax checking for home tab
          quickSuggestions: file.id !== 'home',
          suggestOnTriggerCharacters: file.id !== 'home',
          parameterHints: {enabled: file.id !== 'home'},
          codeLens: file.id !== 'home',
          lightbulb: {enabled: file.id !== 'home'},
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
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          glyphMargin: file.id !== 'home',
          lineNumbersMinChars: 3,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbers: file.id === 'home' ? 'off' : 'on',
          contextmenu: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: 'line',
          renderWhitespace: 'selection',
          guides: {indentation: true},
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
            arrowSize: 20,
          },
        }}
      />
    </div>
  );
}
