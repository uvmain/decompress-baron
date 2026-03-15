import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';
import { createGzip } from 'node:zlib';
import { create as tarCreate } from 'tar';
import { decompress } from '../index.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Gzip a buffer and return the result. */
function gzipBuffer(data) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        Readable.from(data)
            .pipe(createGzip())
            .on('data', (c) => chunks.push(c))
            .on('end', () => resolve(Buffer.concat(chunks)))
            .on('error', reject);
    });
}
/**
 * Create a tar (or tar.gz) buffer from files on disk inside a temp directory.
 * `entries` is an array of { name, content } for regular files,
 * or { name, linkTarget } for symlinks.
 */
async function createTarBuffer(entries, gzip) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uvdc-test-tar-'));
    const filesToPack = [];
    for (const entry of entries) {
        const fullPath = path.join(tmpDir, entry.name);
        const dir = path.dirname(fullPath);
        fs.mkdirSync(dir, { recursive: true });
        if (entry.linkTarget !== undefined) {
            fs.symlinkSync(entry.linkTarget, fullPath);
        }
        else {
            fs.writeFileSync(fullPath, entry.content ?? '');
        }
        filesToPack.push(entry.name);
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        const stream = tarCreate({ cwd: tmpDir, gzip }, filesToPack);
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            resolve(Buffer.concat(chunks));
        });
        stream.on('error', (err) => {
            fs.rmSync(tmpDir, { recursive: true, force: true });
            reject(err);
        });
    });
}
/**
 * Create a minimal zip buffer using raw zip structures.
 * Supports regular files and symlinks.
 */
function createZipBuffer(entries) {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;
    for (const entry of entries) {
        const isSymlink = entry.linkTarget !== undefined;
        const data = Buffer.from(isSymlink ? entry.linkTarget : (entry.content ?? ''), 'utf-8');
        const nameBuffer = Buffer.from(entry.name, 'utf-8');
        // External attrs: for symlinks, set Unix symlink (0o120000 << 16)
        const externalAttrs = isSymlink ? (0o120000 << 16) >>> 0 : 0;
        // Local file header
        const local = Buffer.alloc(30 + nameBuffer.length + data.length);
        local.writeUInt32LE(0x04034B50, 0); // signature
        local.writeUInt16LE(20, 4); // version needed
        local.writeUInt16LE(0, 6); // flags
        local.writeUInt16LE(0, 8); // compression: none
        local.writeUInt16LE(0, 10); // mod time
        local.writeUInt16LE(0, 12); // mod date
        local.writeUInt32LE(0, 14); // crc32 – yauzl does not verify by default with method=0
        local.writeUInt32LE(data.length, 18); // compressed size
        local.writeUInt32LE(data.length, 22); // uncompressed size
        local.writeUInt16LE(nameBuffer.length, 26); // file name length
        local.writeUInt16LE(0, 28); // extra field length
        nameBuffer.copy(local, 30);
        data.copy(local, 30 + nameBuffer.length);
        // Central directory header
        const central = Buffer.alloc(46 + nameBuffer.length);
        central.writeUInt32LE(0x02014B50, 0); // signature
        central.writeUInt16LE(20, 4); // version made by
        central.writeUInt16LE(20, 6); // version needed
        central.writeUInt16LE(0, 8); // flags
        central.writeUInt16LE(0, 10); // compression
        central.writeUInt16LE(0, 12); // mod time
        central.writeUInt16LE(0, 14); // mod date
        central.writeUInt32LE(0, 16); // crc32
        central.writeUInt32LE(data.length, 20); // compressed size
        central.writeUInt32LE(data.length, 24); // uncompressed size
        central.writeUInt16LE(nameBuffer.length, 28); // file name length
        central.writeUInt16LE(0, 30); // extra field length
        central.writeUInt16LE(0, 32); // comment length
        central.writeUInt16LE(0, 34); // disk number start
        central.writeUInt16LE(0, 36); // internal file attributes
        central.writeUInt32LE(externalAttrs, 38); // external file attributes
        central.writeUInt32LE(offset, 42); // local header offset
        nameBuffer.copy(central, 46);
        localHeaders.push(local);
        centralHeaders.push(central);
        offset += local.length;
    }
    const centralDir = Buffer.concat(centralHeaders);
    const centralDirOffset = offset;
    // End of central directory record
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054B50, 0); // signature
    eocd.writeUInt16LE(0, 4); // disk number
    eocd.writeUInt16LE(0, 6); // disk with central dir
    eocd.writeUInt16LE(entries.length, 8); // entries on this disk
    eocd.writeUInt16LE(entries.length, 10); // total entries
    eocd.writeUInt32LE(centralDir.length, 12); // central dir size
    eocd.writeUInt32LE(centralDirOffset, 16); // central dir offset
    eocd.writeUInt16LE(0, 20); // comment length
    return Buffer.concat([...localHeaders, centralDir, eocd]);
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('decompress', () => {
    it('throw on wrong input', async () => {
        // @ts-expect-error intentionally passing a non-Buffer/string value
        await assert.rejects(() => decompress(123), {
            name: 'TypeError',
            message: 'Input must be a Buffer or a file path string',
        });
        // @ts-expect-error intentionally passing a non-Buffer/string value
        await assert.rejects(() => decompress(null), {
            name: 'TypeError',
            message: 'Input must be a Buffer or a file path string',
        });
    });
    it('return empty array if non-valid file is supplied', async () => {
        const result = await decompress(Buffer.from('this is not an archive'));
        assert.deepStrictEqual(result, []);
    });
    it('extract symlinks', async () => {
        // Test with tar.gz
        const tarBuf = await createTarBuffer([
            { name: 'hello.txt', content: 'hello' },
            { name: 'link.txt', linkTarget: 'hello.txt' },
        ], true);
        const tarResult = await decompress(tarBuf);
        const symlink = tarResult.find(f => f.type === 'symlink');
        assert.ok(symlink, 'should contain a symlink entry');
        assert.strictEqual(symlink.linkTarget, 'hello.txt');
        // Test with zip
        const zipBuf = createZipBuffer([
            { name: 'hello.txt', content: 'hello' },
            { name: 'link.txt', linkTarget: 'hello.txt' },
        ]);
        const zipResult = await decompress(zipBuf);
        const zipSymlink = zipResult.find(f => f.type === 'symlink');
        assert.ok(zipSymlink, 'zip should contain a symlink entry');
        assert.strictEqual(zipSymlink.linkTarget, 'hello.txt');
    });
    it('extract file', async () => {
        // tar.gz single file
        const tarBuf = await createTarBuffer([{ name: 'file.txt', content: 'tar content' }], true);
        const tarResult = await decompress(tarBuf);
        const tarFile = tarResult.find(f => f.type === 'file' && f.path === 'file.txt');
        assert.ok(tarFile);
        assert.strictEqual(tarFile.data.toString(), 'tar content');
        // zip single file
        const zipBuf = createZipBuffer([
            { name: 'file.txt', content: 'zip content' },
        ]);
        const zipResult = await decompress(zipBuf);
        const zipFile = zipResult.find(f => f.type === 'file' && f.path === 'file.txt');
        assert.ok(zipFile);
        assert.strictEqual(zipFile.data.toString(), 'zip content');
        // plain gzip
        const gzBuf = await gzipBuffer(Buffer.from('gzip content'));
        const gzResult = await decompress(gzBuf);
        assert.strictEqual(gzResult.length, 1);
        assert.strictEqual(gzResult[0].data.toString(), 'gzip content');
    });
    it('extract tar.gz files', async () => {
        const tarGzBuf = await createTarBuffer([
            { name: 'dir/one.txt', content: 'one' },
            { name: 'dir/two.txt', content: 'two' },
            { name: 'root.txt', content: 'root' },
        ], true);
        // Verify the buffer starts with gzip magic bytes
        assert.strictEqual(tarGzBuf[0], 0x1F);
        assert.strictEqual(tarGzBuf[1], 0x8B);
        const result = await decompress(tarGzBuf);
        const files = result.filter(f => f.type === 'file');
        assert.ok(files.length >= 3, `expected >=3 files, got ${files.length}`);
        assert.strictEqual(files.find(f => f.path === 'dir/one.txt')?.data.toString(), 'one');
        assert.strictEqual(files.find(f => f.path === 'dir/two.txt')?.data.toString(), 'two');
        assert.strictEqual(files.find(f => f.path === 'root.txt')?.data.toString(), 'root');
        // Verify directory entries are present
        const dirs = result.filter(f => f.type === 'directory');
        assert.ok(dirs.some(d => d.path === 'dir'), 'should contain a directory entry for \'dir\'');
    });
    it('extract multiple files', async () => {
        // tar with multiple files
        const tarBuf = await createTarBuffer([
            { name: 'a.txt', content: 'aaa' },
            { name: 'b.txt', content: 'bbb' },
            { name: 'c.txt', content: 'ccc' },
        ], true);
        const tarResult = await decompress(tarBuf);
        const tarFiles = tarResult.filter(f => f.type === 'file');
        assert.ok(tarFiles.length >= 3, `expected >=3 files, got ${tarFiles.length}`);
        // zip with multiple files
        const zipBuf = createZipBuffer([
            { name: 'x.txt', content: 'xxx' },
            { name: 'y.txt', content: 'yyy' },
        ]);
        const zipResult = await decompress(zipBuf);
        const zipFiles = zipResult.filter(f => f.type === 'file');
        assert.strictEqual(zipFiles.length, 2);
        assert.strictEqual(zipFiles.find(f => f.path === 'x.txt')?.data.toString(), 'xxx');
        assert.strictEqual(zipFiles.find(f => f.path === 'y.txt')?.data.toString(), 'yyy');
    });
    it('filter results with options.filter', async () => {
        // tar.gz with several files — filter to only those containing "keep"
        const tarBuf = await createTarBuffer([
            { name: 'keep-one.txt', content: 'yes' },
            { name: 'drop-two.txt', content: 'no' },
            { name: 'keep-three.txt', content: 'yes' },
            { name: 'drop-four.txt', content: 'no' },
        ], true);
        const tarResult = await decompress(tarBuf, {
            filter: file => file.path.includes('keep'),
        });
        const tarFiles = tarResult.filter(f => f.type === 'file');
        assert.strictEqual(tarFiles.length, 2);
        assert.ok(tarFiles.every(f => f.path.includes('keep')));
        assert.ok(tarFiles.every(f => !f.path.includes('drop')));
        // zip with several files — filter by extension
        const zipBuf = createZipBuffer([
            { name: 'readme.md', content: '# Hello' },
            { name: 'index.js', content: 'console.log()' },
            { name: 'style.css', content: 'body {}' },
        ]);
        const zipResult = await decompress(zipBuf, {
            filter: file => file.path.endsWith('.js'),
        });
        assert.strictEqual(zipResult.length, 1);
        assert.strictEqual(zipResult[0].path, 'index.js');
        // no filter — returns everything
        const allResult = await decompress(zipBuf);
        assert.strictEqual(allResult.filter(f => f.type === 'file').length, 3);
    });
    it('accept a file path string as input', async () => {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uvdc-test-path-'));
        // Write a zip archive to a temp file and decompress via path
        const zipBuf = createZipBuffer([
            { name: 'alpha.txt', content: 'alpha' },
            { name: 'beta.txt', content: 'beta' },
        ]);
        const zipPath = path.join(tmpDir, 'archive.zip');
        fs.writeFileSync(zipPath, zipBuf);
        const result = await decompress(zipPath);
        const files = result.filter(f => f.type === 'file');
        assert.strictEqual(files.length, 2);
        assert.strictEqual(files.find(f => f.path === 'alpha.txt')?.data.toString(), 'alpha');
        assert.strictEqual(files.find(f => f.path === 'beta.txt')?.data.toString(), 'beta');
        // Also works with options.filter
        const filtered = await decompress(zipPath, {
            filter: file => file.path === 'beta.txt',
        });
        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].path, 'beta.txt');
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
});
//# sourceMappingURL=decompress.test.js.map