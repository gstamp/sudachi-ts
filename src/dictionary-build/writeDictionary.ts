import type { ModelOutput } from './modelOutput.js';

export interface WriteDictionary {
	writeTo(output: ModelOutput): Promise<void> | void;
}
