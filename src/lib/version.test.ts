import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/** Version in Cargo.toml's [package] section. Works with Windows (\r\n) and Unix (\n) line endings. */
const cargoTomlVersion = (text: string) => /^\[package\][^[]*?^version\s*=\s*"([^"]+)"/m.exec(text)?.[1];

/** Version of this app's own entry in Cargo.lock (not a dependency's). */
const cargoLockVersion = (text: string) => /name = "asset-tracker"\r?\nversion = "([^"]+)"/.exec(text)?.[1];

describe('app version', () => {
  it('is the same everywhere it is written', () => {
    const pkg = JSON.parse(read('package.json'));
    const lock = JSON.parse(read('package-lock.json'));
    const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));

    expect({
      settings: APP_VERSION,
      packageLock: lock.version,
      packageLockRoot: lock.packages[''].version,
      tauri: tauri.version,
      cargo: cargoTomlVersion(read('src-tauri/Cargo.toml')),
      cargoLock: cargoLockVersion(read('src-tauri/Cargo.lock')),
    }).toEqual({
      settings: pkg.version,
      packageLock: pkg.version,
      packageLockRoot: pkg.version,
      tauri: pkg.version,
      cargo: pkg.version,
      cargoLock: pkg.version,
    });
  });

  it('reads the Rust files the same way with Windows line endings', () => {
    // GitHub's Windows machines check files out with \r\n; the release build runs this test there.
    const toCrlf = (s: string) => s.replace(/\r?\n/g, '\r\n');
    const toml = read('src-tauri/Cargo.toml');
    const lockFile = read('src-tauri/Cargo.lock');
    expect(cargoTomlVersion(toCrlf(toml))).toBe(cargoTomlVersion(toml));
    expect(cargoLockVersion(toCrlf(lockFile))).toBe(cargoLockVersion(lockFile));
    expect(cargoLockVersion(toCrlf(lockFile))).toBe(APP_VERSION);
  });
});
