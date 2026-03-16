# decompress-baron

Decompress **gzip**, **tar**, **tar.gz**, and **zip** archives in Node.js.

## Install

```bash
npm install decompress-baron
```

## Usage

```ts
import { readFileSync } from 'node:fs'
import { decompress } from 'decompress-baron'

const buffer = readFileSync('archive.tar.gz')
const files = await decompress(buffer)

for (const file of files) {
  console.log(file.path, file.type, file.data.length)
}
```

You can also pass a file path directly instead of a `Buffer`:

```ts
import fs from 'node:fs'
import { decompress } from 'decompress-baron'

const files = await decompress(compressedFilePath, {
  filter: (file) => {
    return file.path.includes('test') || file.data.toString().includes('test')
  },
})

for (const file of files) {
  fs.writeFileSync(`./${file.path}`, file.data)
}
```

## Types

### `decompress(input, options?)`

Returns `Promise<DecompressedFile[]>`

#### `input`

Type: `Buffer | string`

The archive data as a `Buffer`, or a file path as a `string`. When a string is provided, the file is read into a buffer automatically.

The format is detected automatically from magic bytes. If the buffer does not match any known format, an empty array is returned.

#### `options`

Type: `DecompressOptions` *(optional)*

##### `options.filter`

Type: `(file: DecompressedFile) => boolean`

A predicate called for each extracted entry. Return `true` to keep the entry, `false` to exclude it.

### `DecompressedFile`

| Property     | Type                                      | Description                                              |
| ------------ | ----------------------------------------- | -------------------------------------------------------- |
| `path`       | `string`                                  | Relative path of the entry within the archive.           |
| `type`       | `'file' \| 'directory' \| 'symlink'`      | Entry type.                                              |
| `data`       | `Buffer`                                  | File contents (empty `Buffer` for directories/symlinks). |
| `linkTarget` | `string \| undefined`                     | Symlink target path, if applicable.                      |

## Supported formats

| Format  | Detection          | Powered by  |
| ------- | ------------------ | ----------- |
| gzip    | magic bytes        | `node:zlib` |
| tar     | `ustar` header     | `tar`       |
| tar.gz  | gzip + tar inspect | `tar` + `node:zlib` |
| zip     | magic bytes        | `yauzl`     |

## License

ISC
