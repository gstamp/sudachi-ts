import type { Grammar } from '../dictionary/grammar.js';
import type { Lexicon } from '../dictionary/lexicon.js';
import type { PartialPOS } from '../dictionary/posMatcher.js';
import { PosMatcher } from '../dictionary/posMatcher.js';
import type { InputTextPlugin } from '../plugins/inputText/base.js';
import type { OovProviderPlugin } from '../plugins/oov/base.js';
import type { PathRewritePlugin } from '../plugins/pathRewrite/base.js';
import { JapaneseTokenizer } from './japaneseTokenizer.js';
import type { Tokenizer } from './tokenizer.js';

export class Dictionary {
	private readonly grammar: Grammar;
	private readonly tokenizer: Tokenizer;

	constructor(
		grammar: Grammar,
		lexicon: Lexicon,
		inputTextPlugins: InputTextPlugin[] = [],
		oovProviderPlugins: OovProviderPlugin[] = [],
		pathRewritePlugins: PathRewritePlugin[] = [],
	) {
		this.grammar = grammar;
		this.tokenizer = new JapaneseTokenizer(
			grammar,
			lexicon,
			inputTextPlugins,
			oovProviderPlugins,
			pathRewritePlugins,
		);
	}

	create(): Tokenizer {
		return this.tokenizer;
	}

	async close(): Promise<void> {}

	getPartOfSpeechSize(): number {
		return this.grammar.getPartOfSpeechSize();
	}

	getPartOfSpeechString(posId: number): string[] {
		return this.grammar.getPartOfSpeechString(posId).toList();
	}

	posMatcher(predicate: (pos: string[]) => boolean): PosMatcher {
		const matchingIds: number[] = [];
		for (let i = 0; i < this.grammar.getPartOfSpeechSize(); i++) {
			const posString = this.grammar.getPartOfSpeechString(i).toList();
			if (predicate(posString)) {
				matchingIds.push(i);
			}
		}
		return new PosMatcher(matchingIds, (id: number) =>
			this.grammar.getPartOfSpeechString(id).toList(),
		);
	}

	posMatcherFromList(posList: Iterable<PartialPOS>): PosMatcher {
		const predicate = (pos: string[]): boolean => {
			for (const partial of posList) {
				let matches = true;
				for (let i = 0; i < partial.size(); i++) {
					const component = partial.get(i);
					if (component !== null && component !== pos[i]) {
						matches = false;
						break;
					}
				}
				if (matches) {
					return true;
				}
			}
			return false;
		};
		return this.posMatcher(predicate);
	}
}
