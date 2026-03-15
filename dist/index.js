import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { decompressGzip } from './gzip.js';
import { decompressTar } from './tar.js';
import { decompressZip } from './zip.js';
/**
 * Detect archive type from the first bytes of a buffer (magic numbers).
 */
function detectType(buffer) {
    if (buffer.length < 4)
        return null;
    // Gzip: 1f 8b
    if (buffer[0] === 0x1F && buffer[1] === 0x8B)
        return 'gzip';
    // Zip: 50 4b 03 04
    if (buffer[0] === 0x50
        && buffer[1] === 0x4B
        && buffer[2] === 0x03
        && buffer[3] === 0x04) {
        return 'zip';
    }
    // Tar: "ustar" at offset 257
    if (buffer.length > 262) {
        const ustar = buffer.subarray(257, 262).toString('utf-8');
        if (ustar === 'ustar')
            return 'tar';
    }
    return null;
}
/**
 * Detect whether a gzip buffer wraps a tar archive by peeking at the
 * decompressed header for the "ustar" magic.
 */
async function isGzippedTar(buffer) {
    const { createGunzip } = await import('node:zlib');
    const { Readable } = await import('node:stream');
    return new Promise((resolve) => {
        const chunks = [];
        let length = 0;
        const gunzip = createGunzip();
        Readable.from(buffer)
            .pipe(gunzip)
            .on('data', (chunk) => {
            chunks.push(chunk);
            length += chunk.length;
            // We only need the first 263 bytes to check for "ustar"
            if (length >= 263) {
                gunzip.destroy();
            }
        })
            .on('close', () => {
            const head = Buffer.concat(chunks);
            if (head.length > 262) {
                const ustar = head.subarray(257, 262).toString('utf-8');
                resolve(ustar === 'ustar');
            }
            else {
                resolve(false);
            }
        })
            .on('error', () => resolve(false));
    });
}
/**
 * Decompress a buffer containing a gzip, tar, tar.gz, or zip archive.
 *
 * @param input - The archive data as a `Buffer`, or a file path as a `string`.
 * @param options - Optional settings such as a `filter` function.
 * @returns An array of {@link DecompressedFile} entries.
 * @throws If `input` is not a `Buffer` or `string`.
 */
export async function decompress(input, options) {
    let buffer;
    if (typeof input === 'string') {
        buffer = await readFile(input);
    }
    else if (Buffer.isBuffer(input)) {
        buffer = input;
    }
    else {
        throw new TypeError('Input must be a Buffer or a file path string');
    }
    const type = detectType(buffer);
    if (type === null) {
        return [];
    }
    let files;
    if (type === 'zip') {
        files = await decompressZip(buffer);
    }
    else if (type === 'tar') {
        files = await decompressTar(buffer, false);
    }
    else if (await isGzippedTar(buffer)) {
        // type === "gzip" — wraps a tar archive (tar.gz)
        files = await decompressTar(buffer, true);
    }
    else {
        files = await decompressGzip(buffer);
    }
    if (options?.filter) {
        files = files.filter(options.filter);
    }
    return files;
}
export default decompress;
//# sourceMappingURL=index.js.map