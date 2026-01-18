import type { InputText } from './inputText.js';

export interface InputTextBuilder {
	replace(begin: number, end: number, str: string): void;

	getOriginalText(): string;

	getText(): string;

	build(): InputText;
}
