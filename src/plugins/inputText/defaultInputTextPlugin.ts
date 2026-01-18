import type { InputTextBuilder } from '../../core/inputTextBuilder.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { readFully } from '../../utils/stringUtil.js';
import { InputTextPlugin } from '../inputText/base.js';

export class DefaultInputTextPlugin extends InputTextPlugin {
	private ignoreNormalizeSet: Set<number> = new Set();
	private keyLengths: Map<string, number> = new Map();
	private replaceCharMap: Map<string, string> = new Map();
	private initialized: boolean = false;

	override async setUp(_grammar: Grammar): Promise<void> {
		if (this.initialized) {
			return;
		}

		const rewriteDefPath = this.settings.getString('rewriteDef');
		if (rewriteDefPath) {
			const content = await readFully(rewriteDefPath);
			this.readRewriteLists(content);
		} else {
			this.readRewriteLists(this.getDefaultRewriteRules());
		}
		this.initialized = true;
	}

	rewrite(builder: InputTextBuilder): void {
		const text = builder.getText();
		let offset = 0;
		let nextOffset = 0;

		for (let i = 0; i < text.length; i++) {
			const cp = text.codePointAt(i)!;
			const charLength = String.fromCodePoint(cp).length;

			offset += nextOffset;
			nextOffset = 0;

			const charAtI = text[i] ?? '';
			for (
				let l = Math.min(this.keyLengths.get(charAtI) ?? 0, text.length - i);
				l > 0;
				l--
			) {
				const replace = this.replaceCharMap.get(text.substring(i, i + l));
				if (replace !== undefined) {
					builder.replace(i + offset, i + l + offset, replace);
					nextOffset += replace.length - l;
					i += l - 1;
					return;
				}
			}

			const lower = String.fromCodePoint(cp).toLowerCase();
			const lowerCp = lower.codePointAt(0)!;
			let replace: string;

			if (this.ignoreNormalizeSet.has(lowerCp)) {
				if (cp === lowerCp) {
					continue;
				}
				replace = lower;
			} else {
				replace = lower.normalize('NFKC');
			}

			nextOffset = replace.length - charLength;
			if (replace.length !== charLength || cp !== replace.codePointAt(0)) {
				builder.replace(i + offset, i + charLength + offset, replace);
			}
		}
	}

	private readRewriteLists(content: string): void {
		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]?.trim();
			const lineNumber = i + 1;

			if (!line || line.startsWith('#') || line === '') {
				continue;
			}

			const cols = line.split(/\s+/);

			if (cols.length === 1) {
				const key = cols[0]!;
				if ([...key].length !== 1) {
					throw new Error(`${key} is not a character at line ${lineNumber}`);
				}
				this.ignoreNormalizeSet.add(key.codePointAt(0)!);
			} else if (cols.length === 2) {
				if (this.replaceCharMap.has(cols[0]!)) {
					throw new Error(
						`${cols[0]} is already defined at line ${lineNumber}`,
					);
				}
				const keyLength = this.keyLengths.get(cols[0]!) ?? -1;
				if (keyLength < (cols[0]?.length ?? 0)) {
					this.keyLengths.set(cols[0]!, cols[0]?.length ?? 0);
				}
				this.replaceCharMap.set(cols[0]!, cols[1]!);
			} else {
				throw new Error(`invalid format at line ${lineNumber}`);
			}
		}
	}

	private getDefaultRewriteRules(): string {
		return `鬲
髙
渚
鷗
﨑
﨑
賴
濵
`;
	}
}
