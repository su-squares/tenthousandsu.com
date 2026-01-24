declare module 'fs' {
  const fs: {
    statSync(path: string): any;
    existsSync(path: string): boolean;
    renameSync(oldPath: string, newPath: string): void;
    unlinkSync(path: string): void;
    writeFileSync(path: string, data: string | Uint8Array): void;
    readFileSync(path: string, options?: any): string;
    mkdirSync(path: string, options?: any): void;
    readdirSync(path: string): string[];
  };
  export = fs;
}

declare module 'path' {
  export function resolve(...paths: string[]): string;
  export function join(...paths: string[]): string;
  export function dirname(path: string): string;
  export function basename(path: string): string;
  export function extname(path: string): string;
}

declare module 'url' {
  export function fileURLToPath(url: string | URL): string;
}
