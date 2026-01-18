import { describe, expect, test } from 'bun:test';
import { PathAnchor } from '../../../src/config/pathAnchor.js';

describe('PathAnchor', () => {
	describe('None', () => {
		test('should create none anchor', () => {
			const anchor = PathAnchor.none();
			expect(anchor.toString()).toBe('None{}');
		});

		test('should resolve paths as-is', async () => {
			const anchor = PathAnchor.none();
			const path = await anchor.resolve('test/path.json');
			expect(path).toBe('test/path.json');
		});
	});

	describe('Filesystem', () => {
		test('should create filesystem anchor', async () => {
			const anchor = PathAnchor.filesystem('/base/path');
			expect(anchor.toString()).toBe('Filesystem{base=/base/path}');
		});

		test('should resolve relative to base path', async () => {
			const anchor = PathAnchor.filesystem('/base/path');
			const path = await anchor.resolve('test.json');
			expect(path).toBe('/base/path/test.json');
		});

		test('should resolve nested paths', async () => {
			const anchor = PathAnchor.filesystem('/base/path');
			const path = await anchor.resolve('subdir/test.json');
			expect(path).toBe('/base/path/subdir/test.json');
		});

		test('should check file existence', async () => {
			const anchor = PathAnchor.filesystem(import.meta.dir);
			const path = await anchor.resolve('pathAnchor.test.ts');
			const exists = await anchor.exists(path);
			expect(exists).toBe(true);
		});

		test('should return false for non-existent files', async () => {
			const anchor = PathAnchor.filesystem(import.meta.dir);
			const path = await anchor.resolve('non-existent-file.ts');
			const exists = await anchor.exists(path);
			expect(exists).toBe(false);
		});
	});

	describe('Chain', () => {
		test('should create chain from multiple anchors', async () => {
			const anchor1 = PathAnchor.filesystem('/path1');
			const anchor2 = PathAnchor.filesystem('/path2');
			const chain = anchor1.andThen(anchor2);
			const str = chain.toString();
			expect(str).toContain('Filesystem{base=/path1}');
			expect(str).toContain('Filesystem{base=/path2}');
		});

		test('should resolve first existing path', async () => {
			const anchor1 = PathAnchor.filesystem(import.meta.dir);
			const anchor2 = PathAnchor.filesystem('/non/existent/path');
			const chain = anchor1.andThen(anchor2);

			const path = await chain.resolve('pathAnchor.test.ts');
			expect(path).toContain('pathAnchor.test.ts');
		});

		test('should check existence across all anchors', async () => {
			const anchor1 = PathAnchor.filesystem(import.meta.dir);
			const anchor2 = PathAnchor.filesystem('/non/existent/path');
			const chain = anchor1.andThen(anchor2);

			const path = await chain.resolve('pathAnchor.test.ts');
			const exists = await chain.exists(path);
			expect(exists).toBe(true);
		});

		test('should not add duplicate anchors', async () => {
			const anchor1 = PathAnchor.filesystem('/path1');
			const chain = anchor1.andThen(anchor1);
			const str = chain.toString();
			expect((str.match(/Filesystem/g) || []).length).toBe(1);
		});

		test('should flatten nested chains', async () => {
			const anchor1 = PathAnchor.filesystem('/path1');
			const anchor2 = PathAnchor.filesystem('/path2');
			const anchor3 = PathAnchor.filesystem('/path3');
			const chain1 = anchor1.andThen(anchor2);
			const chain2 = chain1.andThen(anchor3);

			const str = chain2.toString();
			expect((str.match(/Filesystem/g) || []).length).toBe(3);
		});
	});

	describe('lookupClass', () => {
		test('should load module by name', async () => {
			const anchor = PathAnchor.none();
			const module = await anchor.lookupClass('path');
			expect(module).toBeDefined();
		});
	});
});
