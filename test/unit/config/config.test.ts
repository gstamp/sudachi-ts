import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Config, loadConfig } from '../../../src/config/config.js';
import { PathAnchor } from '../../../src/config/pathAnchor.js';

describe('Config', () => {
	describe('empty', () => {
		test('should create empty config', () => {
			const config = Config.empty();
			expect(config).toBeDefined();
			expect(config.getSettings()).toBeDefined();
			expect(config.getAnchor()).toBeDefined();
		});
	});

	describe('parse', () => {
		test('should parse JSON string', () => {
			const json = '{"test": "value"}';
			const config = Config.parse(json);
			expect(config.getString('test')).toBe('value');
		});

		test('should get int value', () => {
			const json = '{"number": 42}';
			const config = Config.parse(json);
			expect(config.getInt('number')).toBe(42);
		});

		test('should get boolean value', () => {
			const json = '{"enabled": true}';
			const config = Config.parse(json);
			expect(config.getBoolean('enabled', false)).toBe(true);
		});

		test('should get string list', () => {
			const json = '{"items": ["a", "b", "c"]}';
			const config = Config.parse(json);
			expect(config.getStringList('items')).toEqual(['a', 'b', 'c']);
		});

		test('should get int list', () => {
			const json = '{"numbers": [1, 2, 3]}';
			const config = Config.parse(json);
			expect(config.getIntList('numbers')).toEqual([1, 2, 3]);
		});

		test('should return null for missing keys', () => {
			const json = '{"test": "value"}';
			const config = Config.parse(json);
			expect(config.getString('missing')).toBeNull();
		});

		test('should return default value for missing keys', () => {
			const json = '{}';
			const config = Config.parse(json);
			expect(config.getString('missing', 'default')).toBe('default');
			expect(config.getInt('missing', 100)).toBe(100);
			expect(config.getBoolean('missing', true)).toBe(true);
		});
	});

	describe('withFallback', () => {
		test('should fallback to other config', () => {
			const config1 = Config.parse('{"key1": "value1"}');
			const config2 = Config.parse('{"key2": "value2"}');
			const merged = config1.withFallback(config2);

			expect(merged.getString('key1')).toBe('value1');
			expect(merged.getString('key2')).toBe('value2');
		});

		test('should prefer values from primary config', () => {
			const config1 = Config.parse('{"key": "value1"}');
			const config2 = Config.parse('{"key": "value2"}');
			const merged = config1.withFallback(config2);

			expect(merged.getString('key')).toBe('value1');
		});

		test('should merge anchors', () => {
			const config1 = Config.parse('{}');
			const config2 = Config.parse('{}');
			const anchor1 = PathAnchor.filesystem('/path1');
			const anchor2 = PathAnchor.filesystem('/path2');
			config1.setAnchor(anchor1);
			config2.setAnchor(anchor2);

			const merged = config1.withFallback(config2);
			const mergedAnchor = merged.getAnchor();
			const str = mergedAnchor.toString();
			expect(str).toContain('/path1');
			expect(str).toContain('/path2');
		});
	});

	describe('anchoredWith', () => {
		test('should add anchor', () => {
			const config = Config.parse('{}');
			const anchor = PathAnchor.filesystem('/new/path');
			const newConfig = config.anchoredWith(anchor);

			const str = newConfig.getAnchor().toString();
			expect(str).toContain('/new/path');
		});
	});

	describe('getPlugins', () => {
		test('should parse plugin configurations', () => {
			const json = '{"plugins": [{"class": "PluginA", "setting1": "value1"}]}';
			const config = Config.parse(json);
			const plugins = config.getPlugins('plugins');

			expect(plugins).not.toBeNull();
			expect(plugins).toHaveLength(1);
			expect(plugins?.[0]?.className).toBe('PluginA');
			expect(plugins?.[0]?.settings.getString('setting1')).toBe('value1');
		});

		test('should return null for missing plugin key', () => {
			const json = '{}';
			const config = Config.parse(json);
			const plugins = config.getPlugins('plugins');

			expect(plugins).toBeNull();
		});
	});
});

describe('loadConfig', () => {
	test('should load from file path', async () => {
		const configPath = `${import.meta.dir}/../../fixtures/test-config.json`;
		const config = await loadConfig(configPath);
		expect(config.getString('testKey')).toBe('testValue');
	});

	test('should use default config when no path provided', async () => {
		const config = await loadConfig();
		expect(config).toBeDefined();
	});

	test('should fail gracefully for non-existent file', async () => {
		await expect(loadConfig('/non/existent/path.json')).rejects.toThrow();
	});

	test('should resolve paths relative to config file directory', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'sudachi-config-anchor-'));
		const configPath = join(tempDir, 'sudachi.json');
		const dictPath = join(tempDir, 'system.dic');

		try {
			await writeFile(dictPath, 'dummy');
			await writeFile(configPath, JSON.stringify({ systemDict: 'system.dic' }));

			const config = await loadConfig(configPath);
			const resolvedPath = await config.getAnchor().resolve('system.dic');
			expect(resolve(resolvedPath)).toBe(resolve(dictPath));
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test('should fallback to current directory when path is missing beside config', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'sudachi-config-cwd-'));
		const configPath = join(tempDir, 'sudachi.json');
		const fileName = `sudachi-cwd-fallback-${Date.now()}.dic`;
		const cwdPath = join(process.cwd(), fileName);

		try {
			await writeFile(configPath, JSON.stringify({ systemDict: fileName }));
			await writeFile(cwdPath, 'dummy');

			const config = await loadConfig(configPath);
			const resolvedPath = await config.getAnchor().resolve(fileName);
			expect(resolve(resolvedPath)).toBe(resolve(cwdPath));
		} finally {
			await unlink(cwdPath).catch(() => {});
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	test('should resolve plugin file settings relative to config file directory', async () => {
		const tempDir = await mkdtemp(join(tmpdir(), 'sudachi-config-plugin-'));
		const configPath = join(tempDir, 'sudachi.json');
		const rewriteDefPath = join(tempDir, 'rewrite.def');

		try {
			await writeFile(rewriteDefPath, '# rewrite rules');
			await writeFile(
				configPath,
				JSON.stringify({
					inputTextPlugin: [
						{
							class: 'com.worksap.nlp.sudachi.DefaultInputTextPlugin',
							rewriteDef: 'rewrite.def',
						},
					],
				}),
			);

			const config = await loadConfig(configPath);
			const plugins = config.getPlugins('inputTextPlugin');
			const resolvedPath = await plugins?.[0]?.settings.getPath('rewriteDef');
			expect(resolve(resolvedPath ?? '')).toBe(resolve(rewriteDefPath));
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
