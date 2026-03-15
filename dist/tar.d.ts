import type { DecompressedFile } from './types.js';
import { Buffer } from 'node:buffer';
/**
 * Decompress a tar or tar.gz buffer.
 * Uses node-tar to extract into a temporary directory, then reads results.
 */
export declare function decompressTar(buffer: Buffer, isGzipped: boolean): Promise<DecompressedFile[]>;
//# sourceMappingURL=tar.d.ts.map