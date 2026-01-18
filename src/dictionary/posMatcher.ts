import type { POS } from './pos.js';

const POS_DEPTH = 6;
const MAX_COMPONENT_LENGTH = 127;

export class PartialPOS {
	private readonly data: (string | null)[];

	constructor(data: (string | null)[]) {
		if (data.length === 0) {
			throw new Error('Partial POS must have at least 1 component');
		}
		if (data.length > POS_DEPTH) {
			throw new Error(
				`Partial POS can have at most ${POS_DEPTH} components, was ${data.length}`,
			);
		}
		for (const component of data) {
			if (component !== null && component.length > MAX_COMPONENT_LENGTH) {
				throw new Error(
					`Component length can't be more than ${MAX_COMPONENT_LENGTH}, was ${component.length}:${component}`,
				);
			}
		}
		this.data = [...data];
	}

	get(index: number): string | null {
		return this.data[index] ?? null;
	}

	size(): number {
		return this.data.length;
	}

	matches(pos: POS): boolean {
		for (let level = 0; level < this.data.length; ++level) {
			const s = this.data[level];
			if (s === null) {
				continue;
			}
			if (s !== pos.get(level)) {
				return false;
			}
		}
		return true;
	}

	toString(): string {
		return this.data.join(',');
	}

	static of(...parts: string[]): PartialPOS {
		return new PartialPOS(parts);
	}
}

export class PosMatcher {
	private readonly matching: Set<number>;
	private readonly getPOSString: (id: number) => string[];

	constructor(ids: number[], getPOSString: (id: number) => string[]) {
		this.matching = new Set(ids);
		this.getPOSString = getPOSString;
	}

	union(other: PosMatcher): PosMatcher {
		const merged = new Set([...this.matching, ...other.matching]);
		return new PosMatcher([...merged], this.getPOSString);
	}

	intersection(other: PosMatcher): PosMatcher {
		const merged = [...this.matching].filter((id) => other.matching.has(id));
		return new PosMatcher(merged, this.getPOSString);
	}

	invert(totalSize: number): PosMatcher {
		const indices: number[] = [];
		for (let idx = 0; idx < totalSize; idx++) {
			if (!this.matching.has(idx)) {
				indices.push(idx);
			}
		}
		return new PosMatcher(indices, this.getPOSString);
	}

	matches(posId: number): boolean {
		return this.matching.has(posId);
	}

	[Symbol.iterator](): Iterator<string[]> {
		const sortedIds = Array.from(this.matching).sort((a, b) => a - b);
		let index = 0;

		return {
			next: (): IteratorResult<string[]> => {
				if (index < sortedIds.length) {
					const posId = sortedIds[index];
					if (posId !== undefined) {
						index++;
						return { value: this.getPOSString(posId), done: false };
					}
				}
				return { value: [] as string[], done: true };
			},
		};
	}
}
