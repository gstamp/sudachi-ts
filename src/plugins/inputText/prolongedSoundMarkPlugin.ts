import type { InputTextBuilder } from '../../core/inputTextBuilder.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { InputTextPlugin } from '../inputText/base.js';

export class ProlongedSoundMarkInputTextPlugin extends InputTextPlugin {
	private prolongedSoundMarkSet: Set<number> = new Set();
	private replacementSymbol: string = 'ー';

	override setUp(_grammar: Grammar): void {
		const prolongedSoundMarkStrings = this.settings.getStringList(
			'prolongedSoundMarks',
		);
		for (const s of prolongedSoundMarkStrings) {
			if (s.length > 0) {
				this.prolongedSoundMarkSet.add(s.codePointAt(0)!);
			}
		}
		const replacement = this.settings.getString('replacementSymbol', 'ー');
		this.replacementSymbol = replacement ?? 'ー';
	}

	rewrite(builder: InputTextBuilder): void {
		const text = builder.getText();
		const n = text.length;
		let offset = 0;
		let markStartIndex = n;
		let isProlongedSoundMark = false;

		for (let i = 0; i < n; i++) {
			const cp = text.codePointAt(i)!;
			if (!isProlongedSoundMark && this.prolongedSoundMarkSet.has(cp)) {
				isProlongedSoundMark = true;
				markStartIndex = i;
			} else if (isProlongedSoundMark && !this.prolongedSoundMarkSet.has(cp)) {
				if (i - markStartIndex > 1) {
					builder.replace(
						markStartIndex - offset,
						i - offset,
						this.replacementSymbol,
					);
					offset += i - markStartIndex - 1;
				}
				isProlongedSoundMark = false;
			}
		}

		if (isProlongedSoundMark && n - markStartIndex > 1) {
			builder.replace(
				markStartIndex - offset,
				n - offset,
				this.replacementSymbol,
			);
		}
	}
}
