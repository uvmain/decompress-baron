import type { DecompressedFile } from './types.js';
import { Buffer } from 'node:buffer';
/**
 * Decompress a gzip buffer. Returns a single file entry with the
 * decompressed data. The path is set to "decompressed" because gzip
 * carries no filename metadata.
 */
export declare function decompressGzip(buffer: Buffer): Promise<DecompressedFile[]>;
//# sourceMappingURL=gzip.d.ts.map