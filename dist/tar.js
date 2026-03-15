import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { extract as tarExtract } from 'tar';
const relativePathRegex = /\\/g;
/**
 * Decompress a tar or tar.gz buffer.
 * Uses node-tar to extract into a temporary directory, then reads results.
 */
export async function decompressTar(buffer, isGzipped) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uvdc-'));
    try {
        await new Promise((resolve, reject) => {
            const stream = Readable.from(buffer);
            const extractStream = tarExtract({ cwd: tmpDir, strip: 0 });
            let pipeline = stream;
            if (isGzipped) {
                pipeline = stream.pipe(createGunzip());
            }
            pipeline
                .pipe(extractStream)
                .on('finish', resolve)
                .on('error', reject);
        });
        return readDirectory(tmpDir, tmpDir);
    }
    finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}
function readDirectory(dir, root) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(root, fullPath).replace(relativePathRegex, '/');
        if (entry.isSymbolicLink()) {
            const linkTarget = fs.readlinkSync(fullPath);
            results.push({
                path: relativePath,
                type: 'symlink',
                data: Buffer.alloc(0),
                linkTarget,
            });
        }
        else if (entry.isDirectory()) {
            results.push({
                path: relativePath,
                type: 'directory',
                data: Buffer.alloc(0),
            });
            results.push(...readDirectory(fullPath, root));
        }
        else if (entry.isFile()) {
            results.push({
                path: relativePath,
                type: 'file',
                data: fs.readFileSync(fullPath),
            });
        }
    }
    return results;
}
//# sourceMappingURL=tar.js.map