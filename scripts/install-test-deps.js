#!/usr/bin/env node
const { exec } = require('child_process');
const { readdirSync, existsSync } = require('fs');
const { join } = require('path');

const testDir = join(__dirname, '..', 'test');
const dirs = readdirSync(testDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(testDir, d.name))
    .filter((dir) => existsSync(join(dir, 'mops.toml')));

function install(dir) {
    return new Promise((resolve, reject) => {
        const p = exec('npx --no ic-mops install', { cwd: dir });
        p.stdout?.pipe(process.stdout, { end: false });
        p.stderr?.pipe(process.stderr, { end: false });
        p.on('error', reject);
        p.on('close', (code) =>
            code ? reject(new Error(`Failed in ${dir}`)) : resolve(),
        );
    });
}

// Sequential: parallel installs of the same package race on the shared mops cache
dirs.reduce(
    (prev, dir) => prev.then(() => install(dir)),
    Promise.resolve(),
).then(
    () => console.log('All test dependencies installed.'),
    (err) => {
        console.error(err.message);
        process.exit(1);
    },
);
