import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const execFile = promisify(execFileCallback);
const repoRoot = process.cwd();
const npmExecPath = process.env.npm_execpath;

describe('Public dictionary-build API', () => {
	let tempDir = '';

	beforeAll(async () => {
		if (!npmExecPath) {
			throw new Error('npm_execpath is required to run build verification');
		}

		tempDir = await mkdtemp(join(repoRoot, '.tmp-public-dictionary-build-'));
		await execFile(process.execPath, [npmExecPath, 'run', 'build'], {
			cwd: repoRoot,
		});
	});

	afterAll(async () => {
		if (tempDir.length > 0) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test('package exports dictionary-build as a typed public subpath', async () => {
		const packageJson = JSON.parse(
			await readFile(join(repoRoot, 'package.json'), 'utf8'),
		) as {
			exports: Record<string, unknown>;
		};

		expect(packageJson.exports['./dictionary-build']).toEqual({
			types: './build/src/dictionary-build/index.d.ts',
			import: './build/src/dictionary-build/index.js',
			default: './build/src/dictionary-build/index.js',
		});
	});

	test('runtime import exposes builder factories from package subpath', async () => {
		const { stdout } = await execFile(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				[
					"const mod = await import('sudachi-ts/dictionary-build');",
					'console.log(JSON.stringify({',
					"  systemBuilder: typeof mod.systemBuilder,",
					"  userBuilder: typeof mod.userBuilder",
					'}));',
				].join('\n'),
			],
			{ cwd: repoRoot },
		);

		expect(JSON.parse(stdout.trim())).toEqual({
			systemBuilder: 'function',
			userBuilder: 'function',
		});
	});

	test('typescript resolves sudachi-ts/dictionary-build typings', async () => {
		const entryPath = join(tempDir, 'dictionary-build-import.ts');
		await writeFile(
			entryPath,
			[
				"import { systemBuilder, userBuilder } from 'sudachi-ts/dictionary-build';",
				'',
				'const system = systemBuilder();',
				'const user = userBuilder({',
				'  getGrammar() {',
				'    return null as never;',
				'  },',
				'  getLexicon() {',
				'    return null as never;',
				'  },',
				'});',
				'',
				'void system;',
				'void user;',
				'',
			].join('\n'),
		);

		const tscPath = join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
		await expect(
			execFile(
				process.execPath,
				[
					tscPath,
					'--noEmit',
					'--module',
					'nodenext',
					'--moduleResolution',
					'nodenext',
					'--target',
					'es2022',
					entryPath,
				],
				{ cwd: repoRoot },
			),
		).resolves.toMatchObject({ stderr: '' });
	});
});
