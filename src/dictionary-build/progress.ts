export type ProgressCallback = (current: number, max: number) => void;

export class Progress {
	private _callbacks: ProgressCallback[] = [];

	on(callback: ProgressCallback): void {
		this._callbacks.push(callback);
	}

	report(current: number, max: number): void {
		for (const callback of this._callbacks) {
			callback(current, max);
		}
	}

	clear(): void {
		this._callbacks = [];
	}
}
