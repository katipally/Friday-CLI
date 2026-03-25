import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

export interface ProjectInfo {
  type: string;
  framework?: string;
  language: string;
  packageManager?: string;
}

interface Indicator {
  file: string;
  type: string;
  language: string;
  packageManager?: string;
  detectFramework?: (rootDir: string) => Promise<string | undefined>;
}

const INDICATORS: Indicator[] = [
  {
    file: 'package.json',
    type: 'nodejs',
    language: 'javascript',
    packageManager: 'npm',
    detectFramework: async (rootDir) => {
      try {
        const raw = await readFile(join(rootDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(raw);
        const allDeps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        };

        // Check for TypeScript
        const lang = allDeps['typescript'] ? 'typescript' : 'javascript';

        // Detect package manager
        let packageManager = 'npm';
        try {
          await access(join(rootDir, 'pnpm-lock.yaml'));
          packageManager = 'pnpm';
        } catch {
          try {
            await access(join(rootDir, 'yarn.lock'));
            packageManager = 'yarn';
          } catch {
            // default npm
          }
        }

        // Detect framework
        if (allDeps['next']) return `next|${lang}|${packageManager}`;
        if (allDeps['nuxt']) return `nuxt|${lang}|${packageManager}`;
        if (allDeps['@angular/core']) return `angular|${lang}|${packageManager}`;
        if (allDeps['svelte'] || allDeps['@sveltejs/kit']) return `svelte|${lang}|${packageManager}`;
        if (allDeps['express']) return `express|${lang}|${packageManager}`;
        if (allDeps['fastify']) return `fastify|${lang}|${packageManager}`;
        if (allDeps['react']) return `react|${lang}|${packageManager}`;
        if (allDeps['vue']) return `vue|${lang}|${packageManager}`;

        return `|${lang}|${packageManager}`;
      } catch {
        return undefined;
      }
    },
  },
  {
    file: 'pyproject.toml',
    type: 'python',
    language: 'python',
    packageManager: 'pip',
  },
  {
    file: 'requirements.txt',
    type: 'python',
    language: 'python',
    packageManager: 'pip',
  },
  {
    file: 'Cargo.toml',
    type: 'rust',
    language: 'rust',
    packageManager: 'cargo',
  },
  {
    file: 'go.mod',
    type: 'go',
    language: 'go',
    packageManager: 'go',
  },
  {
    file: 'pom.xml',
    type: 'java',
    language: 'java',
    packageManager: 'maven',
  },
  {
    file: 'build.gradle',
    type: 'java',
    language: 'java',
    packageManager: 'gradle',
  },
  {
    file: 'Gemfile',
    type: 'ruby',
    language: 'ruby',
    packageManager: 'bundler',
  },
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class ProjectDetector {
  async detect(rootDir: string): Promise<ProjectInfo> {
    for (const indicator of INDICATORS) {
      if (await fileExists(join(rootDir, indicator.file))) {
        let framework: string | undefined;
        let language = indicator.language;
        let packageManager = indicator.packageManager;

        if (indicator.detectFramework) {
          const result = await indicator.detectFramework(rootDir);
          if (result) {
            const parts = result.split('|');
            framework = parts[0] || undefined;
            language = parts[1] || language;
            packageManager = parts[2] || packageManager;
          }
        }

        return {
          type: indicator.type,
          framework,
          language,
          packageManager,
        };
      }
    }

    return { type: 'unknown', language: 'unknown' };
  }
}
