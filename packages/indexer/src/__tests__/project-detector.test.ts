import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectDetector } from '../project-detector.js';

describe('ProjectDetector', () => {
  let detector: ProjectDetector;
  let testDir: string;

  beforeEach(async () => {
    detector = new ProjectDetector();
    testDir = await mkdtemp(join(tmpdir(), 'friday-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('language detection', () => {
    it('detects Node.js project from package.json', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} }),
      );

      const info = await detector.detect(testDir);
      expect(info.type).toBe('nodejs');
      expect(info.language).toBe('javascript');
      expect(info.packageManager).toBe('npm');
    });

    it('detects Python project from requirements.txt', async () => {
      await writeFile(join(testDir, 'requirements.txt'), 'flask==2.0\n');

      const info = await detector.detect(testDir);
      expect(info.type).toBe('python');
      expect(info.language).toBe('python');
      expect(info.packageManager).toBe('pip');
    });

    it('detects Rust project from Cargo.toml', async () => {
      await writeFile(
        join(testDir, 'Cargo.toml'),
        '[package]\nname = "test"\nversion = "0.1.0"\n',
      );

      const info = await detector.detect(testDir);
      expect(info.type).toBe('rust');
      expect(info.language).toBe('rust');
      expect(info.packageManager).toBe('cargo');
    });

    it('detects Go project from go.mod', async () => {
      await writeFile(join(testDir, 'go.mod'), 'module example.com/test\n\ngo 1.21\n');

      const info = await detector.detect(testDir);
      expect(info.type).toBe('go');
      expect(info.language).toBe('go');
      expect(info.packageManager).toBe('go');
    });

    it('returns unknown for empty directory', async () => {
      const info = await detector.detect(testDir);
      expect(info.type).toBe('unknown');
      expect(info.language).toBe('unknown');
      expect(info.framework).toBeUndefined();
      expect(info.packageManager).toBeUndefined();
    });
  });

  describe('framework detection from package.json', () => {
    it('detects Next.js framework', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }),
      );

      const info = await detector.detect(testDir);
      expect(info.type).toBe('nodejs');
      expect(info.framework).toBe('next');
    });

    it('detects Express framework', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.0.0' } }),
      );

      const info = await detector.detect(testDir);
      expect(info.type).toBe('nodejs');
      expect(info.framework).toBe('express');
    });

    it('detects React framework', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      );

      const info = await detector.detect(testDir);
      expect(info.type).toBe('nodejs');
      expect(info.framework).toBe('react');
    });

    it('detects TypeScript language', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          dependencies: { react: '^18.0.0' },
          devDependencies: { typescript: '^5.0.0' },
        }),
      );

      const info = await detector.detect(testDir);
      expect(info.language).toBe('typescript');
    });

    it('detects pnpm package manager', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: {} }),
      );
      await writeFile(join(testDir, 'pnpm-lock.yaml'), '');

      const info = await detector.detect(testDir);
      expect(info.packageManager).toBe('pnpm');
    });

    it('detects yarn package manager', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: {} }),
      );
      await writeFile(join(testDir, 'yarn.lock'), '');

      const info = await detector.detect(testDir);
      expect(info.packageManager).toBe('yarn');
    });

    it('returns no framework for plain Node.js project', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: { lodash: '^4.0.0' } }),
      );

      const info = await detector.detect(testDir);
      expect(info.type).toBe('nodejs');
      expect(info.framework).toBeUndefined();
    });
  });

  describe('detection priority', () => {
    it('prefers package.json over requirements.txt when both exist', async () => {
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ dependencies: {} }),
      );
      await writeFile(join(testDir, 'requirements.txt'), 'flask\n');

      const info = await detector.detect(testDir);
      expect(info.type).toBe('nodejs');
    });
  });
});
