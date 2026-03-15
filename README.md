# uvdc

Decompress **gzip**, **tar**, **tar.gz**, and **zip** archives in Node.js.

Fully typed — ships with `.d.ts` declarations out of the box.

## Install

```bash
npm install uvdc
```

## Usage

```ts
import { readFileSync } from 'node:fs'
import { decompress } from 'uvdc'

const buffer = readFileSync('archive.tar.gz')
const files = await decompress(buffer)

for (const file of files) {
  console.log(file.path, file.type, file.data.length)
}
```

You can also pass a file path directly instead of a `Buffer`:

```ts
import { decompress } from 'uvdc'

const files = await decompress('./archive.tar.gz')
```

### Filtering

Pass an `options` object with a `filter` function to include only the entries you care about:

```ts
const files = await decompress(buffer, {
  filter: file => file.path.endsWith('.js'),
})
```

```ts
const files = await decompress(buffer, {
  filter: file => file.path.includes('caddy'),
})
```

### Default export

A default export is also available:

```ts
import decompress from 'uvdc'
```

## API

### `decompress(input, options?)`

Returns `Promise<DecompressedFile[]>`

#### `input`

Type: `Buffer | string`

The archive data as a `Buffer`, or a file path as a `string`. When a string is provided, the file is read into a buffer automatically.

The format is detected automatically from magic bytes — gzip (`1f 8b`), zip (`50 4b 03 04`), and tar (`ustar` at offset 257). Gzip buffers are inspected further to determine whether they wrap a tar archive (tar.gz) or are plain gzip.

If the buffer does not match any known format, an empty array is returned.

Throws `TypeError` if `input` is not a `Buffer` or `string`.

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
