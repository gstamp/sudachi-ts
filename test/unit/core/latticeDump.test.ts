import { describe, expect, test } from 'bun:test';
import { LatticeImpl } from '../../../src/core/lattice.js';
import { dumpLattice } from '../../../src/core/latticeDump.js';
import { UTF8InputTextBuilder } from '../../../src/core/utf8InputText.js';
import { WordInfo } from '../../../src/dictionary/wordInfo.js';
import { MockGrammar } from '../core/mockGrammar.js';

describe('dumpLattice', () => {
	test('should dump lattice structure', () => {
		const grammar = new MockGrammar();
		const lattice = new LatticeImpl(grammar);
		const inputText = new UTF8InputTextBuilder('test', grammar).build();

		lattice.resize(4);

		const dump = dumpLattice(lattice, inputText);

		expect(dump).toBeDefined();
		expect(dump.text).toBe('test');
		expect(dump.nodes).toBeDefined();
		expect(Array.isArray(dump.nodes)).toBe(true);
	});

	test('should include node information', () => {
		const grammar = new MockGrammar();
		const lattice = new LatticeImpl(grammar);
		const inputText = new UTF8InputTextBuilder('test', grammar).build();

		lattice.resize(4);

		const node = lattice.createNode();
		node.setWordId(1);
		node.setDictionaryId(0);
		node.setRange(0, 2);
		node.setParameter(1, 2, 10);

		const wordInfo = new WordInfo('te', 2, 1, 'te', 'te', 'te');
		node.setWordInfo(wordInfo);

		lattice.insert(0, 2, node);

		const dump = dumpLattice(lattice, inputText);
		const dumpedNode = dump.nodes.find((n) => n.wordId === 1);

		expect(dumpedNode).toBeDefined();
		expect(dumpedNode?.begin).toBe(0);
		expect(dumpedNode?.end).toBe(2);
		expect(dumpedNode?.wordId).toBe(1);
		expect(dumpedNode?.surface).toBe('te');
		expect(dumpedNode?.isOOV).toBe(false);
		expect(dumpedNode?.cost).toBe(10);
	});

	test('should include best path if provided', () => {
		const grammar = new MockGrammar();
		const lattice = new LatticeImpl(grammar);
		const inputText = new UTF8InputTextBuilder('test', grammar).build();

		lattice.resize(4);

		const node1 = lattice.createNode();
		node1.setWordId(1);
		node1.setDictionaryId(0);
		node1.setRange(0, 2);
		node1.setParameter(1, 2, 10);
		const wordInfo1 = new WordInfo('te', 2, 1, 'te', 'te', 'te');
		node1.setWordInfo(wordInfo1);

		const node2 = lattice.createNode();
		node2.setWordId(2);
		node2.setDictionaryId(0);
		node2.setRange(2, 4);
		node2.setParameter(2, 3, 20);
		const wordInfo2 = new WordInfo('st', 2, 2, 'st', 'st', 'st');
		node2.setWordInfo(wordInfo2);

		const path = [node1, node2];
		const dump = dumpLattice(lattice, inputText, path);

		expect(dump.bestPath).toBeDefined();
		expect(dump.bestPath).toHaveLength(2);
		expect(dump.bestPath?.[0]?.surface).toBe('te');
		expect(dump.bestPath?.[1]?.surface).toBe('st');
	});

	test('should produce valid JSON', () => {
		const grammar = new MockGrammar();
		const lattice = new LatticeImpl(grammar);
		const inputText = new UTF8InputTextBuilder('test', grammar).build();

		lattice.resize(4);

		const dump = dumpLattice(lattice, inputText);
		const json = JSON.stringify(dump);

		expect(() => JSON.parse(json)).not.toThrow();
		const parsed = JSON.parse(json);
		expect(parsed.text).toBe('test');
	});
});
