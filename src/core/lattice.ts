import type { Grammar } from '../dictionary/grammar.js';
import type { WordInfo } from '../dictionary/wordInfo.js';

export interface LatticeNode {
	setParameter(leftId: number, rightId: number, cost: number): void;

	getBegin(): number;

	getEnd(): number;

	setRange(begin: number, end: number): void;

	isOOV(): boolean;

	setOOV(): void;

	getWordInfo(): WordInfo;

	setWordInfo(wordInfo: WordInfo): void;

	getPathCost(): number;

	getWordId(): number;

	setWordId(wordId: number): void;

	getDictionaryId(): number;

	setDictionaryId(dictionaryId: number): void;

	getTotalCost(): number;

	getRightId(): number;

	getLeftId(): number;

	getCost(): number;

	isConnectedToBOS(): boolean;

	setConnectedToBOS(value: boolean): void;

	getBestPreviousNode(): LatticeNode | null;

	setBestPreviousNode(node: LatticeNode | null): void;

	isDefined(): boolean;

	setDefined(value: boolean): void;

	appendSplitsTo(list: LatticeNode[], mode: number): void;
}

export class LatticeNodeImpl implements LatticeNode {
	leftId: number;
	rightId: number;
	cost: number;
	begin: number;
	end: number;
	totalCost: number;
	private _isConnectedToBOS: boolean;
	bestPreviousNode: LatticeNodeImpl | null;
	wordId: number;
	dictionaryId: number;
	private _isDefined: boolean;
	wordInfo: WordInfo | null;

	constructor(
		_lexicon: unknown,
		leftId: number,
		rightId: number,
		cost: number,
		wordId: number,
	) {
		this.leftId = leftId;
		this.rightId = rightId;
		this.cost = cost;
		this.begin = 0;
		this.end = 0;
		this.totalCost = 0;
		this._isConnectedToBOS = false;
		this.bestPreviousNode = null;
		this.wordId = wordId;
		this.dictionaryId = 0;
		this._isDefined = true;
		this.wordInfo = null;
	}

	setParameter(leftId: number, rightId: number, cost: number): void {
		this.leftId = leftId;
		this.rightId = rightId;
		this.cost = cost;
	}

	getBegin(): number {
		return this.begin;
	}

	getEnd(): number {
		return this.end;
	}

	setRange(begin: number, end: number): void {
		this.begin = begin;
		this.end = end;
	}

	isOOV(): boolean {
		return this.dictionaryId < 0;
	}

	setOOV(): void {
		this.dictionaryId = -1;
	}

	getWordInfo(): WordInfo {
		if (!this.wordInfo) {
			throw new Error('WordInfo is not set');
		}
		return this.wordInfo;
	}

	setWordInfo(wordInfo: WordInfo): void {
		this.wordInfo = wordInfo;
	}

	getPathCost(): number {
		return this.totalCost;
	}

	getWordId(): number {
		return this.wordId;
	}

	setWordId(wordId: number): void {
		this.wordId = wordId;
	}

	getDictionaryId(): number {
		return this.dictionaryId;
	}

	setDictionaryId(dictionaryId: number): void {
		this.dictionaryId = dictionaryId;
	}

	getTotalCost(): number {
		return this.totalCost;
	}

	getRightId(): number {
		return this.rightId;
	}

	getLeftId(): number {
		return this.leftId;
	}

	getCost(): number {
		return this.cost;
	}

	isConnectedToBOS(): boolean {
		return this._isConnectedToBOS;
	}

	setConnectedToBOS(value: boolean): void {
		this._isConnectedToBOS = value;
	}

	getBestPreviousNode(): LatticeNode | null {
		return this.bestPreviousNode;
	}

	setBestPreviousNode(node: LatticeNode | null): void {
		this.bestPreviousNode = node as LatticeNodeImpl;
	}

	isDefined(): boolean {
		return this._isDefined;
	}

	setDefined(value: boolean): void {
		this._isDefined = value;
	}

	appendSplitsTo(list: LatticeNode[], _mode: number): void {
		list.push(this);
	}
}

export interface Lattice {
	getNodesWithEnd(end: number): LatticeNode[];

	getNodes(begin: number, end: number): LatticeNode[];

	getMinimumNode(begin: number, end: number): LatticeNode | null;

	insert(begin: number, end: number, node: LatticeNode): void;

	remove(begin: number, end: number, node: LatticeNode): void;

	createNode(): LatticeNode;

	resize(size: number): void;

	clear(): void;

	hasPreviousNode(index: number): boolean;

	connectEosNode(): void;

	getBestPath(): LatticeNode[];
}

export class LatticeImpl implements Lattice {
	private endLists: LatticeNodeImpl[][];
	private size: number;
	private capacity: number;
	private eosNode: LatticeNodeImpl;

	constructor(private readonly grammar: Grammar) {
		this.endLists = [];
		this.size = 0;
		this.capacity = 0;
		this.eosNode = new LatticeNodeImpl(null, 0, 0, 0, -1);
		this.eosNode.setConnectedToBOS(false);
		this.eosNode.setDefined(false);

		this.initBOS();
	}

	private initBOS(): void {
		const bosParams = this.grammar.getBOSParameter();
		const bosNode = new LatticeNodeImpl(
			null,
			bosParams[0] ?? 0,
			bosParams[1] ?? 0,
			bosParams[2] ?? 0,
			-1,
		);
		bosNode.setConnectedToBOS(true);
		bosNode.setDefined(false);
		this.endLists = [[bosNode]];
		this.capacity = 0;
	}

	resize(size: number): void {
		if (size > this.capacity) {
			this.expand(size);
		}
		this.size = size;

		const eosParams = this.grammar.getEOSParameter();
		this.eosNode = new LatticeNodeImpl(
			null,
			eosParams[0] ?? 0,
			eosParams[1] ?? 0,
			eosParams[2] ?? 0,
			-1,
		);
		this.eosNode.setConnectedToBOS(false);
		this.eosNode.setDefined(false);
		this.eosNode.setRange(size, size);
	}

	clear(): void {
		for (let i = 1; i < this.size + 1; i++) {
			this.endLists[i] = [];
		}
		this.size = 0;
	}

	private expand(newSize: number): void {
		for (let i = this.capacity + 1; i < newSize + 1; i++) {
			this.endLists[i] = [];
		}
		this.capacity = newSize;
	}

	getNodesWithEnd(end: number): LatticeNode[] {
		return this.endLists[end] || [];
	}

	getNodes(begin: number, end: number): LatticeNode[] {
		const nodes = this.endLists[end] || [];
		return nodes.filter((n: LatticeNode) => n.getBegin() === begin);
	}

	getMinimumNode(begin: number, end: number): LatticeNode | null {
		const nodes = this.getNodes(begin, end);
		if (nodes.length === 0) {
			return null;
		}
		let minNode: LatticeNode | undefined = nodes[0];
		for (let i = 1; i < nodes.length; i++) {
			const node = nodes[i];
			if (node && minNode && node.getTotalCost() < minNode.getTotalCost()) {
				minNode = node;
			}
		}
		return minNode ?? null;
	}

	insert(begin: number, end: number, node: LatticeNode): void {
		const n = node as LatticeNodeImpl;
		if (!this.endLists[end]) {
			this.endLists[end] = [];
		}
		this.endLists[end].push(n);
		n.setRange(begin, end);

		this.connectNode(n);
	}

	remove(_begin: number, end: number, node: LatticeNode): void {
		const nodes = this.endLists[end];
		if (nodes) {
			const index = nodes.indexOf(node as LatticeNodeImpl);
			if (index !== -1) {
				nodes.splice(index, 1);
			}
		}
	}

	createNode(): LatticeNode {
		return new LatticeNodeImpl(null, 0, 0, 0, -1);
	}

	hasPreviousNode(index: number): boolean {
		const list = this.endLists[index];
		return list !== undefined && list.length > 0;
	}

	connectNode(rNode: LatticeNodeImpl): void {
		const begin = rNode.begin;
		const leftId = rNode.leftId;

		const endNodes = this.endLists[begin] || [];
		let bestPrevNode: LatticeNodeImpl | null = null;
		let minLeftCost = Number.MAX_VALUE;

		for (const lNode of endNodes) {
			if (!lNode.isConnectedToBOS()) {
				continue;
			}

			const connectCost = this.grammar.getConnectCost(lNode.rightId, leftId);
			if (connectCost === this.grammar.INHIBITED_CONNECTION) {
				continue;
			}
			const cost = lNode.totalCost + connectCost;
			if (cost < minLeftCost) {
				minLeftCost = cost;
				bestPrevNode = lNode;
			}
		}

		rNode.setConnectedToBOS(bestPrevNode !== null);
		rNode.totalCost = minLeftCost + rNode.cost;
		rNode.setBestPreviousNode(bestPrevNode);
	}

	connectEosNode(): void {
		this.connectNode(this.eosNode);
	}

	getBestPath(): LatticeNode[] {
		if (!this.eosNode.isConnectedToBOS()) {
			throw new Error('EOS is not connected to BOS');
		}
		const result: LatticeNode[] = [];
		for (
			let node = this.eosNode.getBestPreviousNode();
			node !== null && node !== this.endLists[0]?.[0];
			node = node.getBestPreviousNode()
		) {
			result.push(node);
		}
		return result.reverse();
	}
}
