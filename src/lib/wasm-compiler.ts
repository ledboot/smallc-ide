import type {FileType} from '@/types';

interface CompileResult {
  code: number;
  output: string;
  outputFiles: {name: string; content: string}[];
}

class CompilerService {
  private worker: Worker | null = null;
  private isReady = false;
  private readyPromise: Promise<void> | null = null;
  private pendingResolve: ((value: CompileResult) => void) | null = null;
  private pendingReject: ((reason: any) => void) | null = null;
  private outputBuffer = '';
  private compiling = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Lazy init in initWasmCompiler
    }
  }

  public init(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.isReady = false;
        this.worker = new Worker(
          new URL('../workers/compiler.worker.js', import.meta.url),
        );

        this.worker.onmessage = e => {
          const {type, data, result, error} = e.data;

          switch (type) {
            case 'READY':
              this.isReady = true;
              console.log('Compiler Worker is ready');
              resolve();
              break;
            case 'STDOUT':
              this.outputBuffer += data + '\n';
              console.log('[WASM]:', data);
              break;
            case 'STDERR':
              this.outputBuffer += 'Error: ' + data + '\n';
              console.warn('[WASM Err]:', data);
              break;
            case 'COMPILE_DONE':
              if (this.pendingResolve) {
                this.pendingResolve({
                  code: result.code,
                  output: this.outputBuffer,
                  outputFiles: result.outputFiles || [],
                });
              }
              this.cleanup();
              break;
            case 'COMPILE_ERROR':
              if (this.pendingReject) {
                this.pendingReject(new Error(error));
              }
              this.cleanup();
              break;
          }
        };

        this.worker.onerror = e => {
          console.error('Worker error:', e);
          this.isReady = false;
          this.readyPromise = null;
          reject(e);
        };
      } catch (e) {
        this.isReady = false;
        this.readyPromise = null;
        reject(e);
      }
    });

    return this.readyPromise;
  }

  private cleanup() {
    this.pendingResolve = null;
    this.pendingReject = null;
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.readyPromise = null;

    // Immediately start pre-warming the next worker
    this.init().catch(err =>
      console.error('Failed to pre-warm next compiler worker:', err),
    );
  }

  public async compile(
    files: FileType[],
    args: string[],
  ): Promise<CompileResult> {
    if (this.compiling) {
      throw new Error('Compilation already in progress');
    }
    this.compiling = true;

    try {
      await this.init();

      return await new Promise<CompileResult>((resolve, reject) => {
        this.pendingResolve = resolve;
        this.pendingReject = reject;
        this.outputBuffer = '';

        this.worker?.postMessage({
          type: 'COMPILE',
          payload: {
            args: args,
            files: files.map(f => ({name: f.name, content: f.content})),
          },
        });
      });
    } finally {
      this.compiling = false;
    }
  }

  public isReadyState(): boolean {
    return this.isReady;
  }

  public isBusy(): boolean {
    return this.compiling;
  }
}

export const compilerService = new CompilerService();

// Backward compatibility / Helper wrappers
export const initWasmCompiler = () => compilerService.init();

export const isWasmReady = () => compilerService.isReadyState();

// Note: The original compileWithWasm took only args and relied on global state.
// The new one needs files. We will update consumers to use compilerService.compile directly.
// But if we need a shim, we can't easily provide one without the files.
// So we will update the consumers.
