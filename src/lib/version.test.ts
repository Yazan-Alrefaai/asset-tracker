import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('app version', () => {
  it('is the same everywhere it is written', () => {
    const pkg = JSON.parse(read('package.json'));
    const lock = JSON.parse(read('package-lock.json'));
    const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));
    const cargo = /^\[package\][^[]*?^version = "([^"]+)"/m.exec(read('src-tauri/Cargo.toml'))?.[1];
    const cargoLock = /name = "asset-tracker"\nversion = "([^"]+)"/.exec(read('src-tauri/Cargo.lock'))?.[1];

    expect({
      settings: APP_VERSION,
      packageLock: lock.version,
      packageLockRoot: lock.packages[''].version,
      tauri: tauri.version,
      cargo,
      cargoLock,
    }).toEqual({
      settings: pkg.version,
      packageLock: pkg.version,
      packageLockRoot: pkg.version,
      tauri: pkg.version,
      cargo: pkg.version,
      cargoLock: pkg.version,
    });
  });
});
