import type { Buffer } from 'node:buffer'

/**
 * Represents a single file extracted from an archive.
 */
export interface DecompressedFile {
  /** The relative path of the file within the archive. */
  path: string
  /** The file type. */
  type: 'file' | 'directory' | 'symlink'
  /** The raw file data (empty Buffer for directories and symlinks). */
  data: Buffer
  /** For symlinks, the target path. */
  linkTarget?: string
}

/**
 * Options for the decompress function.
 */
export interface DecompressOptions {
  /**
   * A filter function called for each extracted entry.
   * Return `true` to include the entry in the result, `false` to exclude it.
   */
  filter?: (file: DecompressedFile) => boolean
}
