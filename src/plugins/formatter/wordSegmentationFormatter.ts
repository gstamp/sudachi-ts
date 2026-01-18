import type { Morpheme } from '../../core/morpheme.js';
import { MorphemeFormatterPlugin } from './base.js';

export class WordSegmentationFormatter extends MorphemeFormatterPlugin {
	override setUp(): void {
		super.setUp();
		const delimiter = this.settings.getString('delimiter', ' ');
		const eos = this.settings.getString('eos', '\n');
		this.delimiter = delimiter ?? ' ';
		this.eosString = eos ?? '\n';
	}

	formatMorpheme(morpheme: Morpheme): string {
		return morpheme.surface();
	}

	override printSentence(sentence: Morpheme[]): string {
		const parts: string[] = [];
		let isFirst = true;

		for (const m of sentence) {
			const morpheme = this.formatMorpheme(m);
			if (morpheme === '' || morpheme === this.delimiter) {
				continue;
			}

			if (isFirst) {
				parts.push(morpheme);
				isFirst = false;
			} else {
				parts.push(this.delimiter);
				parts.push(morpheme);
			}
		}

		parts.push(this.eosString);
		return parts.join('');
	}
}
