import type { DecompressedFile } from './types.js'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'

/**
 * Decompress a gzip buffer. Returns a single file entry with the
 * decompressed data. The path is set to "decompressed" because gzip
 * carries no filename metadata.
 */
export async function decompressGzip(buffer: Buffer): Promise<DecompressedFile[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const gunzip = createGunzip()

    Readable.from(buffer)
      .pipe(gunzip)
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', () => {
        resolve([
          {
            path: 'decompressed',
            type: 'file',
            data: Buffer.concat(chunks),
          },
        ])
      })
      .on('error', (error: Error) => reject(error))
  })
}
