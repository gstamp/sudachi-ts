export class Connection {
	private readonly matrix: Int16Array;
	private readonly leftSize: number;
	private readonly rightSize: number;

	constructor(matrix: Int16Array, leftSize: number, rightSize: number) {
		this.matrix = matrix;
		this.leftSize = leftSize;
		this.rightSize = rightSize;
	}

	private ix(left: number, right: number): number {
		if (left >= this.leftSize) {
			throw new Error(`leftId < leftSize: (${left}, ${this.leftSize})`);
		}
		if (right >= this.rightSize) {
			throw new Error(`rightId < rightSize: (${right}, ${this.rightSize})`);
		}
		return right * this.leftSize + left;
	}

	cost(left: number, right: number): number {
		const index = this.ix(left, right);
		return this.matrix[index]!;
	}

	getLeftSize(): number {
		return this.leftSize;
	}

	getRightSize(): number {
		return this.rightSize;
	}

	setCost(left: number, right: number, cost: number): void {
		this.matrix[this.ix(left, right)] = cost;
	}

	ownedCopy(): Connection {
		const copy = new Int16Array(this.matrix.length);
		copy.set(this.matrix);
		return new Connection(copy, this.leftSize, this.rightSize);
	}

	validate(leftId: number): void {
		if (leftId >= this.leftSize) {
			throw new Error(`leftId < leftSize: (${leftId}, ${this.leftSize})`);
		}
	}
}
