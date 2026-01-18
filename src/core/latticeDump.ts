import type { InputText } from './inputText.js';
import type { Lattice, LatticeNode } from './lattice.js';

export interface LatticeDump {
	text: string;
	nodes: LatticeNodeDump[];
	bestPath?: LatticeNodeDump[];
}

export interface LatticeNodeDump {
	begin: number;
	end: number;
	wordId: number;
	surface: string;
	dictionaryId: number;
	isOOV: boolean;
	leftId: number;
	rightId: number;
	cost: number;
	totalCost: number;
	isConnectedToBOS: boolean;
}

export function dumpLattice(
	lattice: Lattice,
	inputText: InputText,
	bestPath?: LatticeNode[],
): LatticeDump {
	const nodes: LatticeNodeDump[] = [];
	const byteText = inputText.getByteText();

	for (let i = 0; i <= byteText.length; i++) {
		const endNodes = (
			lattice as unknown as { getNodesWithEnd(end: number): LatticeNode[] }
		).getNodesWithEnd(i);
		for (const node of endNodes) {
			if (node.getWordId() === -1 && i === byteText.length) {
				continue;
			}
			if (node.getWordId() === -1 && i === 0) {
				continue;
			}

			const surface = inputText.getSubstring(node.getBegin(), node.getEnd());
			nodes.push({
				begin: node.getBegin(),
				end: node.getEnd(),
				wordId: node.getWordId(),
				surface,
				dictionaryId: node.getDictionaryId(),
				isOOV: node.isOOV(),
				leftId: node.getLeftId(),
				rightId: node.getRightId(),
				cost: node.getCost(),
				totalCost: node.getTotalCost(),
				isConnectedToBOS: node.isConnectedToBOS(),
			});
		}
	}

	const bestPathDump = bestPath
		? bestPath.map((node) => ({
				begin: node.getBegin(),
				end: node.getEnd(),
				wordId: node.getWordId(),
				surface: inputText.getSubstring(node.getBegin(), node.getEnd()),
				dictionaryId: node.getDictionaryId(),
				isOOV: node.isOOV(),
				leftId: node.getLeftId(),
				rightId: node.getRightId(),
				cost: node.getCost(),
				totalCost: node.getTotalCost(),
				isConnectedToBOS: node.isConnectedToBOS(),
			}))
		: undefined;

	return {
		text: inputText.getText(),
		nodes,
		bestPath: bestPathDump,
	};
}
