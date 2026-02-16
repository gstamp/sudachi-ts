import { expect, test } from 'vitest';
import { LatticeImpl, LatticeNodeImpl } from '../../../src/index.js';
import { WordInfo } from '../../../src/dictionary/wordInfo.js';
import { MockGrammar } from './mockGrammar.js';

const mockGrammar = new MockGrammar();

test('Lattice: should create BOS node', () => {
	const lattice = new LatticeImpl(mockGrammar as any);

	expect(() => lattice.getNodesWithEnd(0)).not.toThrow();
	const nodes = lattice.getNodesWithEnd(0);
	expect(nodes.length).toBeGreaterThan(0);
});

test('Lattice: should resize lattice', () => {
	const lattice = new LatticeImpl(mockGrammar as any);
	lattice.resize(10);

	expect(() => lattice.getNodesWithEnd(0)).not.toThrow();
});

test('Lattice: should insert node', () => {
	const lattice = new LatticeImpl(mockGrammar as any);
	lattice.resize(5);

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	lattice.insert(0, 2, node);

	const nodes = lattice.getNodes(0, 2);
	expect(nodes.length).toBe(1);
	expect(nodes[0]).toBe(node);
});

test('Lattice: should check for previous node', () => {
	const lattice = new LatticeImpl(mockGrammar as any);
	lattice.resize(5);

	const hasNode = lattice.hasPreviousNode(0);
	expect(hasNode).toBe(true);
});

test('Lattice: should get nodes with end', () => {
	const lattice = new LatticeImpl(mockGrammar as any);
	lattice.resize(5);

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	lattice.insert(0, 2, node);

	const nodes = lattice.getNodesWithEnd(2);
	expect(nodes.length).toBe(1);
});

test('Lattice: should get minimum node', () => {
	const lattice = new LatticeImpl(mockGrammar as any);
	lattice.resize(5);

	const node1 = new LatticeNodeImpl(null, 1, 2, 100, 10);
	const node2 = new LatticeNodeImpl(null, 1, 2, 50, 11);
	lattice.insert(0, 2, node1);
	lattice.insert(0, 2, node2);

	const minNode = lattice.getMinimumNode(0, 2);
	expect(minNode).toBe(node2);
});

test('Lattice: should remove node', () => {
	const lattice = new LatticeImpl(mockGrammar as any);
	lattice.resize(5);

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	lattice.insert(0, 2, node);

	const nodes = lattice.getNodes(0, 2);
	expect(nodes.length).toBe(1);

	lattice.remove(0, 2, node);

	const nodesAfter = lattice.getNodes(0, 2);
	expect(nodesAfter.length).toBe(0);
});

test('Lattice: should create node', () => {
	const lattice = new LatticeImpl(mockGrammar as any);

	const node = lattice.createNode();
	expect(node).toBeInstanceOf(LatticeNodeImpl);
});

test('Lattice: should clear lattice', () => {
	const lattice = new LatticeImpl(mockGrammar as any);
	lattice.resize(5);

	const node = new LatticeNodeImpl(null, 1, 2, 100, 10);
	lattice.insert(0, 2, node);

	lattice.clear();

	const nodes = lattice.getNodes(0, 2);
	expect(nodes.length).toBe(0);
});

test('LatticeNode: should set parameters', () => {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);

	node.setParameter(1, 2, 100);
	expect(node.getLeftId()).toBe(1);
	expect(node.getRightId()).toBe(2);
	expect(node.getCost()).toBe(100);
});

test('LatticeNode: should set and get range', () => {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);

	node.setRange(0, 5);
	expect(node.getBegin()).toBe(0);
	expect(node.getEnd()).toBe(5);
});

test('LatticeNode: should mark OOV', () => {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);

	expect(node.isOOV()).toBe(false);

	node.setOOV();
	expect(node.isOOV()).toBe(true);
});

test('LatticeNode: should handle word info', () => {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);
	const wordInfo = new WordInfo(
		'test',
		4,
		0,
		'test',
		'test',
		'test',
	);

	node.setWordInfo(wordInfo);
	expect(node.getWordInfo()).toBe(wordInfo);
	expect(node.getWordInfo().getSurface()).toBe('test');
});

test('LatticeNode: should get and set total cost', () => {
	const node = new LatticeNodeImpl(null, 0, 0, 0, -1);

	node.totalCost = 100;
	expect(node.getTotalCost()).toBe(100);
});
