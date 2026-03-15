import type { DecompressedFile } from './types.js'
import { Buffer } from 'node:buffer'
import yauzl from 'yauzl'

const pathRegex = /\/$/
/**
 * Decompress a zip buffer using yauzl.
 */
export async function decompressZip(
  buffer: Buffer,
): Promise<DecompressedFile[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        return reject(err ?? new Error('Failed to open zip'))
      }

      const files: DecompressedFile[] = []
      zipfile.readEntry()

      zipfile.on('entry', (entry) => {
        const entryPath: string = entry.fileName

        // Directory entries end with /
        if (pathRegex.test(entryPath)) {
          files.push({
            path: entryPath.replace(pathRegex, ''),
            type: 'directory',
            data: Buffer.alloc(0),
          })
          zipfile.readEntry()
          return
        }

        // Check for symlink via external attributes (Unix symlink = 0xA0)
        const isSymlink
          = (entry.externalFileAttributes >>> 16 & 0xF000) === 0xA000

        zipfile.openReadStream(entry, (err2, readStream) => {
          if (err2 || !readStream) {
            return reject(err2 ?? new Error('Failed to read zip entry'))
          }

          const chunks: Buffer[] = []
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk))
          readStream.on('end', () => {
            const data = Buffer.concat(chunks)

            if (isSymlink) {
              files.push({
                path: entryPath,
                type: 'symlink',
                data: Buffer.alloc(0),
                linkTarget: data.toString('utf-8'),
              })
            }
            else {
              files.push({
                path: entryPath,
                type: 'file',
                data,
              })
            }

            zipfile.readEntry()
          })
          readStream.on('error', reject)
        })
      })

      zipfile.on('end', () => resolve(files))
      zipfile.on('error', reject)
    })
  })
}
