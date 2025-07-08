export interface FileType {
    id: string
    name: string
    content: string
    lastModified: string
  }

export interface CompiledResult {
  bytecode: string;
  abi: string;
  hash: string;
}