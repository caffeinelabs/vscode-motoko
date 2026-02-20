#!/usr/bin/env node
const { execSync } = require('child_process');
const { readdirSync, existsSync } = require('fs');
const { join } = require('path');

const testDir = join(__dirname, '..', 'test');
const dirs = readdirSync(testDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(testDir, d.name))
    .filter((dir) => existsSync(join(dir, 'mops.toml')));

for (const dir of dirs) {
    console.log(`Installing mops packages in ${dir}`);
    try {
        execSync('npx --no ic-mops install', { cwd: dir, stdio: 'inherit' });
    } catch (err) {
        console.error(`Failed to install mops packages in ${dir}:`, err.message);
        process.exit(1);
    }
}

console.log('All test dependencies installed.');
