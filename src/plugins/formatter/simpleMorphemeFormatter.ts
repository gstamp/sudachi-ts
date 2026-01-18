import type { Morpheme } from '../../core/morpheme.js';
import { MorphemeFormatterPlugin } from './base.js';

export class SimpleMorphemeFormatter extends MorphemeFormatterPlugin {
	private columnDelimiter: string = '\t';

	override setUp(): void {
		super.setUp();
		const delimiter = this.settings.getString('columnDelimiter', '\t');
		this.columnDelimiter = delimiter ?? '\t';
	}

	formatMorpheme(morpheme: Morpheme): string {
		let output =
			morpheme.surface() +
			this.columnDelimiter +
			morpheme.partOfSpeech().join(',') +
			this.columnDelimiter +
			morpheme.normalizedForm();

		if (this.showDetails) {
			output +=
				this.columnDelimiter +
				morpheme.dictionaryForm() +
				this.columnDelimiter +
				morpheme.readingForm() +
				this.columnDelimiter +
				morpheme.getDictionaryId().toString() +
				this.columnDelimiter +
				JSON.stringify(morpheme.getSynonymGroupIds()) +
				this.columnDelimiter +
				(morpheme.isOOV() ? '(OOV)' : '');
		}

		return output;
	}
}
