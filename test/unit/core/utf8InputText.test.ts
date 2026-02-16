import { expect, test } from 'vitest';
import { UTF8InputTextBuilder } from '../../../src/core/utf8InputText.js';

test('UTF8InputTextBuilder: should build input text', () => {
	const text = '東京都';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	expect(inputText.getText()).toBe(text);
	expect(inputText.getOriginalText()).toBe(text);
	expect(inputText.getByteText()).toBeInstanceOf(Uint8Array);
});

test('UTF8InputTextBuilder: should handle replacements', () => {
	const text = '東京都';
	const builder = new UTF8InputTextBuilder(text, null as any);
	builder.replace(2, 3, '京都');
	const inputText = builder.build();

	expect(inputText.getText()).toBe('東京京都');
	expect(inputText.getOriginalText()).toBe(text);
});

test('UTF8InputText: should get substring', () => {
	const text = '東京都';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	expect(inputText.getSubstring(0, 9)).toBe('東京都');
});

test('UTF8InputText: should handle empty text', () => {
	const text = '';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	expect(inputText.getText()).toBe('');
	expect(inputText.getOriginalText()).toBe('');
	expect(inputText.getByteText().length).toBe(0);
});

test('UTF8InputText: should handle mixed characters', () => {
	const text = 'Hello世界';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	expect(inputText.getText()).toBe(text);
	expect(inputText.getByteText().length).toBeGreaterThan(0);
});

test('UTF8InputText: should get code points offset length', () => {
	const text = '東京都';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	const offset = inputText.getCodePointsOffsetLength(0, 2);
	expect(offset).toBeGreaterThan(0);
});

test('UTF8InputText: should code point count', () => {
	const text = '東京都';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	const count = inputText.codePointCount(0, inputText.getByteText().length);
	expect(count).toBe(3);
});

test('UTF8InputText: should slice input text', () => {
	const text = '東京都';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	const sliced = inputText.slice(0, 2);
	expect(sliced.getText()).toBe('東京');
});

test('UTF8InputText: should get original index', () => {
	const text = '東京都';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	const originalIndex = inputText.getOriginalIndex(0);
	expect(originalIndex).toBe(0);
});

test('UTF8InputText: should handle UTF-16 surrogates', () => {
	const text = '😀😁';
	const builder = new UTF8InputTextBuilder(text, null as any);
	const inputText = builder.build();

	expect(inputText.getText()).toBe(text);
	expect(inputText.getByteText().length).toBeGreaterThan(0);
});
