import type { InputText } from '../../core/inputText.js';
import type { Lattice, LatticeNode } from '../../core/lattice.js';
import { CategoryType } from '../../dictionary/categoryType.js';
import type { Grammar } from '../../dictionary/grammar.js';
import {
	NumericParser,
	ParseError as NumericParserError,
} from '../../utils/numericParser.js';
import { PathRewritePlugin } from '../pathRewrite/base.js';

const NUMERIC_POS = ['名詞', '数詞', '*', '*', '*', '*'];

export class JoinNumericPlugin extends PathRewritePlugin {
	private enableNormalize: boolean = true;
	private numericPOSId: number = 0;

	override setUp(grammar: Grammar): void {
		this.enableNormalize = this.settings.getBoolean('enableNormalize', true);
		this.numericPOSId = grammar.getPartOfSpeechId(NUMERIC_POS);
	}

	rewrite(text: InputText, path: LatticeNode[], lattice: Lattice): void {
		let beginIndex = -1;
		let commaAsDigit = true;
		let periodAsDigit = true;
		const parser = new NumericParser();

		for (let i = 0; i < path.length; i++) {
			const node = path[i]!;
			const types = this.getCharCategoryTypes(text, node);
			const s = node.getWordInfo().getNormalizedForm();

			if (
				types.has(CategoryType.NUMERIC) ||
				types.has(CategoryType.KANJINUMERIC) ||
				(periodAsDigit && s === '.') ||
				(commaAsDigit && s === ',')
			) {
				if (beginIndex < 0) {
					parser.clear();
					beginIndex = i;
				}

				for (let j = 0; j < s.length; j++) {
					const c = s[j]!;
					if (!parser.append(c)) {
						if (beginIndex >= 0) {
							if (parser.errorState === NumericParserError.COMMA) {
								commaAsDigit = false;
								i = beginIndex - 1;
							} else if (parser.errorState === NumericParserError.POINT) {
								periodAsDigit = false;
								i = beginIndex - 1;
							}
							beginIndex = -1;
						}
						break;
					}
				}
			} else {
				if (beginIndex >= 0) {
					if (parser.done()) {
						this.concat(path, beginIndex, i, lattice, parser);
						i = beginIndex + 1;
					} else {
						const ss = path[i - 1]?.getWordInfo().getNormalizedForm();
						if (
							(parser.errorState === NumericParserError.COMMA && ss === ',') ||
							(parser.errorState === NumericParserError.POINT && ss === '.')
						) {
							this.concat(path, beginIndex, i - 1, lattice, parser);
							i = beginIndex + 2;
						}
					}
				}
				beginIndex = -1;
				if (!commaAsDigit && s !== ',') {
					commaAsDigit = true;
				}
				if (!periodAsDigit && s !== '.') {
					periodAsDigit = true;
				}
			}
		}

		if (beginIndex >= 0) {
			if (parser.done()) {
				this.concat(path, beginIndex, path.length, lattice, parser);
			} else {
				const ss = path[path.length - 1]?.getWordInfo().getNormalizedForm();
				if (
					(parser.errorState === NumericParserError.COMMA && ss === ',') ||
					(parser.errorState === NumericParserError.POINT && ss === '.')
				) {
					this.concat(path, beginIndex, path.length - 1, lattice, parser);
				}
			}
		}
	}

	private concat(
		path: LatticeNode[],
		begin: number,
		end: number,
		lattice: Lattice,
		parser: NumericParser,
	): void {
		if (path[begin]?.getWordInfo().getPOSId() !== this.numericPOSId) {
			return;
		}
		if (this.enableNormalize) {
			const normalizedForm = parser.getNormalized();
			if (
				end - begin > 1 ||
				normalizedForm !== path[begin]?.getWordInfo().getNormalizedForm()
			) {
				this.concatenate(path, begin, end, lattice, normalizedForm);
			}
		} else {
			if (end - begin > 1) {
				this.concatenate(path, begin, end, lattice, null);
			}
		}
	}
}
