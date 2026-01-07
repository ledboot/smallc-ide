'use client';

import {useEffect, useRef} from 'react';
import type {Breakpoint, FileType} from '@/types';
import {saveFile} from '@/lib/db';
import {Editor as MonacoEditor} from '@monaco-editor/react';
import {useCompilerStore} from '@/state/useCompiler';
import * as monaco from 'monaco-editor';
import {useFileStore} from '@/state/useFile';

import {useTabsStore} from '@/state/useTabs';
import {useDebugStore} from '@/state/useDebugStore';
import {useShallow} from 'zustand/react/shallow';
import {toast} from 'sonner';

export default function Editor() {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const currentLineDecorationsRef = useRef<string[]>([]);
  const {compiledResultMap, removeCompiledResult} = useCompilerStore();
  const {updateFile} = useFileStore();
  const {currentFile} = useTabsStore();
  const {toggleBreakpoint, currentLine, isDebugging} = useDebugStore(
    useShallow(state => ({
      toggleBreakpoint: state.toggleBreakpoint,
      currentLine: state.currentLine,
      isDebugging: state.isDebugging,
    })),
  );

  const getLanguage = (fileName: string, id: string) => {
    if (!currentFile) return 'plaintext';
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

  const updateBreakpoints = (
    editor: monaco.editor.IStandaloneCodeEditor,
    breakpoints: Breakpoint[],
  ) => {
    const model = editor.getModel();
    if (!model) return;

    // Clear existing first
    const oldDecorations = model
      .getAllDecorations()
      .filter(d =>
        d.options.glyphMarginClassName?.includes('breakpoint-glyph'),
      );
    editor.deltaDecorations(
      oldDecorations.map(d => d.id),
      [],
    );

    const decorations = breakpoints.map(bp => ({
      range: new monaco.Range(bp.lineNumber, 1, bp.lineNumber, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: `breakpoint-glyph ${
          bp.enabled === false ? 'breakpoint-disabled' : ''
        }`,
        stickiness: 1 /* NeverGrowsWhenTypingAtEdges */,
      },
    }));

    if (decorations.length > 0) {
      editor.deltaDecorations([], decorations);
    }
  };

  // Sync breakpoints effect
  useEffect(() => {
    if (!editorRef.current || !currentFile) return;
    updateBreakpoints(editorRef.current, currentFile.breakpoints || []);
  }, [currentFile?.breakpoints, currentFile?.name]);

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

    // Initial breakpoints render
    updateBreakpoints(editor, currentFile?.breakpoints || []);

    // Handle gutter clicks for breakpoints
    editor.onMouseDown(async e => {
      if (
        !e.target ||
        (e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
          e.target.type !== monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS)
      ) {
        return;
      }

      if (!editorRef.current) return;
      const {currentFile} = useTabsStore.getState();
      const model = editorRef.current.getModel();
      if (!model) return;
      // Check validation for C files
      if (!currentFile) return;
      if (!currentFile?.name.endsWith('.c')) return;

      const lineNumber = e.target.position?.lineNumber;
      if (!lineNumber || lineNumber < 1 || lineNumber > model.getLineCount())
        return;

      const success = toggleBreakpoint(lineNumber, currentFile.id);
      if (!success) {
        toast.error(`Cannot set breakpoint at line ${lineNumber}`);
        return;
      }
    });
  };

  // Handle editor content changes
  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    if (!currentFile) return;
    if (currentFile.id === 'home') return;
    currentFile.content = value;
    currentFile.lastModified = new Date().toISOString();
    updateFile(currentFile);

    // Debounce save operation
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveFile(currentFile);

      if (compiledResultMap.has(currentFile.name)) {
        removeCompiledResult(currentFile.name);
      }
    }, 500);
  };

  // Update current line highlighting when currentLine changes (debug mode)
  useEffect(() => {
    if (!editorRef.current) return;

    // Clear previous decorations first
    if (currentLineDecorationsRef.current.length > 0) {
      editorRef.current.deltaDecorations(currentLineDecorationsRef.current, []);
      currentLineDecorationsRef.current = [];
    }

    // If not debugging or no current line, just clear and return
    if (!isDebugging || currentLine === null) return;

    try {
      const model = editorRef.current.getModel();
      if (!model) return;

      const lineCount = model.getLineCount();

      // Ensure currentLine is within valid range
      const validLineNumber = Math.max(1, Math.min(currentLine, lineCount));
      if (validLineNumber > lineCount) return;

      const lineContent = model.getLineContent(validLineNumber) || '';
      const lineLength = Math.max(1, lineContent.length);

      // Add new decorations and store their IDs
      currentLineDecorationsRef.current = editorRef.current.deltaDecorations(
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
              className: 'debug-current-line',
              glyphMarginClassName: 'debug-current-line-glyph',
              stickiness: 1 /* NeverGrowsWhenTypingAtEdges */,
            },
          },
        ],
      );

      // Scroll to the current line
      editorRef.current.revealLineInCenter(validLineNumber);
    } catch (error) {
      console.error('Error updating current line highlight:', error);
    }
  }, [currentLine, isDebugging]);

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        path={currentFile?.id}
        language={getLanguage(currentFile?.name || '', currentFile?.id || '')}
        value={currentFile?.content}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme="github-light"
        options={{
          readOnly: currentFile?.id === 'home',
          // Disable syntax checking for home tab
          quickSuggestions: currentFile?.id !== 'home',
          suggestOnTriggerCharacters: currentFile?.id !== 'home',
          parameterHints: {enabled: currentFile?.id !== 'home'},
          codeLens: currentFile?.id !== 'home',
          lightbulb: {enabled: currentFile?.id !== 'home'},
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
          glyphMargin: currentFile?.id !== 'home',
          lineNumbersMinChars: 3,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbers: currentFile?.id === 'home' ? 'off' : 'on',
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
