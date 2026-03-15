import type { DecompressedFile } from './types.js';
import { Buffer } from 'node:buffer';
/**
 * Decompress a zip buffer using yauzl.
 */
export declare function decompressZip(buffer: Buffer): Promise<DecompressedFile[]>;
//# sourceMappingURL=zip.d.ts.map