import type { DecompressedFile, DecompressOptions } from './types.js';
import { Buffer } from 'node:buffer';
export type { DecompressedFile, DecompressOptions } from './types.js';
/**
 * Decompress a buffer containing a gzip, tar, tar.gz, or zip archive.
 *
 * @param input - The archive data as a `Buffer`, or a file path as a `string`.
 * @param options - Optional settings such as a `filter` function.
 * @returns An array of {@link DecompressedFile} entries.
 * @throws If `input` is not a `Buffer` or `string`.
 */
export declare function decompress(input: Buffer | string, options?: DecompressOptions): Promise<DecompressedFile[]>;
export default decompress;
//# sourceMappingURL=index.d.ts.map