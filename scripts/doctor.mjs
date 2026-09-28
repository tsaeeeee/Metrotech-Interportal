import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const [major] = process.versions.node.split('.').map(Number);

console.log('Metrotech Interportal environment check');
console.log(`Node: v${process.versions.node}`);
console.log(`Platform: ${process.platform} ${process.arch}`);

if (major !== 24) {
    console.error('\nExpected Node.js 24.x. Check .nvmrc / package.json engines.');
    process.exitCode = 1;
} else {
    console.log('Node runtime: OK');
}

try {
    require('better-sqlite3');
    console.log('better-sqlite3 native binding: OK');
} catch (error) {
    console.error('\nbetter-sqlite3 native binding: FAILED');
    console.error(
        'Run: pnpm install (build permission is already configured in pnpm-workspace.yaml)',
    );
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
