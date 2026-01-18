import type { Morpheme } from '../../core/morpheme.js';
import { Plugin } from '../base.js';

export abstract class MorphemeFormatterPlugin extends Plugin {
	protected delimiter: string = '\n';
	protected eosString: string = '\nEOS\n';
	protected showDetails: boolean = false;

	setUp(): void {
		this.showDetails = false;
	}

	abstract formatMorpheme(morpheme: Morpheme): string;

	showDetail(): void {
		this.showDetails = true;
	}

	printSentence(sentence: Morpheme[]): string {
		const parts: string[] = [];
		for (let i = 0; i < sentence.length; i++) {
			if (i > 0) {
				parts.push(this.delimiter);
			}
			parts.push(this.formatMorpheme(sentence[i]!));
		}
		parts.push(this.eosString);
		return parts.join('');
	}

	setDelimiter(delimiter: string): void {
		this.delimiter = delimiter;
	}

	getDelimiter(): string {
		return this.delimiter;
	}

	setEosString(eosString: string): void {
		this.eosString = eosString;
	}

	getEosString(): string {
		return this.eosString;
	}

	setShowDetails(showDetails: boolean): void {
		this.showDetails = showDetails;
	}

	isShowDetails(): boolean {
		return this.showDetails;
	}
}
