import type * as Monaco from 'monaco-editor';

let monacoInstance: typeof Monaco | null = null;
let editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null;

export const setMonacoInstance = (
  monaco: typeof Monaco,
  editor: Monaco.editor.IStandaloneCodeEditor,
) => {
  monacoInstance = monaco;
  editorInstance = editor;
  console.log('Monaco instance set');
};

export const getMonacoInstance = () => {
  return monacoInstance;
};

export const getEditorInstance = () => {
  return editorInstance;
};
