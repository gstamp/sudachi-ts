import type { Progress } from './progress.js';

export class Part {
	readonly name: string;
	readonly time: number;
	readonly size: number;

	constructor(name: string, time: number, size: number) {
		this.name = name;
		this.time = time;
		this.size = size;
	}
}

export class ModelOutput {
	private _position = 0;
	private readonly _parts: Part[] = [];
	private _progress?: Progress;
	private readonly _chunks: Uint8Array[] = [];

	get position(): number {
		return this._position;
	}

	set position(value: number) {
		this._position = value;
	}

	get size(): number {
		return this._position;
	}

	async positionTo(pos: number): Promise<void> {
		this._position = pos;
	}

	get parts(): Part[] {
		return [...this._parts];
	}

	setProgress(progress: Progress): void {
		this._progress = progress;
	}

	async write(buffer: Uint8Array): Promise<void> {
		this._chunks.push(buffer);
		this._position += buffer.length;
	}

	async withPart(name: string, fn: () => Promise<void>): Promise<void> {
		const pos = this._position;
		const startTime = performance.now();
		await fn();
		const time = performance.now() - startTime;
		const size = this._position - pos;
		this._parts.push(new Part(name, time, size));
	}

	async padTo(alignment: number): Promise<void> {
		const rem = this._position % alignment;
		if (rem > 0) {
			const pad = alignment - rem;
			const zeros = new Uint8Array(pad);
			await this.write(zeros);
		}
	}

	async withSizedPart(name: string, fn: () => Promise<number>): Promise<void> {
		const startTime = performance.now();
		const size = await fn();
		const time = performance.now() - startTime;
		this._parts.push(new Part(name, time, size));
	}

	progress(current: number, max: number): void {
		if (this._progress) {
			this._progress.report(current, max);
		}
	}

	toBuffer(): Uint8Array {
		const totalSize = this._chunks.reduce(
			(sum, chunk) => sum + chunk.length,
			0,
		);
		const result = new Uint8Array(totalSize);
		let offset = 0;
		for (const chunk of this._chunks) {
			result.set(chunk, offset);
			offset += chunk.length;
		}
		return result;
	}

	clear(): void {
		this._position = 0;
		this._chunks.length = 0;
		this._parts.length = 0;
	}
}
