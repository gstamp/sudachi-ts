import { Settings } from '../config/settings.js';
import { UTF8InputTextBuilder } from '../core/utf8InputText.js';
import type { Grammar } from '../dictionary/grammar.js';
import type { InputTextPlugin } from '../plugins/inputText/base.js';
import { PluginLoader } from '../plugins/loader.js';

export class TextNormalizer {
	private readonly grammar: Grammar;
	private readonly inputTextPlugins: InputTextPlugin[];

	constructor(grammar: Grammar, inputTextPlugins: InputTextPlugin[]) {
		if (grammar.getCharacterCategory() === null) {
			throw new Error(
				'grammar for TextNormalizer must have CharacterCategory.',
			);
		}
		this.grammar = grammar;
		this.inputTextPlugins = inputTextPlugins;
	}

	static async defaultTextNormalizer(): Promise<TextNormalizer> {
		const charCategory = await CharacterCategory.loadDefault();
		const grammar = new GrammarImpl();
		grammar.setCharacterCategory(charCategory);
		const plugins = await TextNormalizer.setupDefaultInputTextPlugins(grammar);
		return new TextNormalizer(grammar, plugins);
	}

	static async fromDictionary(grammar: Grammar): Promise<TextNormalizer> {
		const plugins = await TextNormalizer.setupDefaultInputTextPlugins(grammar);
		return new TextNormalizer(grammar, plugins);
	}

	private static async setupDefaultInputTextPlugins(
		_grammar: Grammar,
	): Promise<InputTextPlugin[]> {
		const settings = Settings.parse(
			'{"class":"com.worksap.nlp.sudachi.DefaultInputTextPlugin"}',
		);
		const loader = new PluginLoader();
		const loaded = await loader.loadInputTextPlugin(
			'com.worksap.nlp.sudachi.DefaultInputTextPlugin',
			settings,
		);
		return [loaded.plugin];
	}

	normalize(text: string): string {
		const builder = new UTF8InputTextBuilder(text, this.grammar);
		for (const plugin of this.inputTextPlugins) {
			plugin.rewrite(builder);
		}
		const input = builder.build();
		return input.getText();
	}
}

import { CharacterCategory } from '../dictionary/characterCategory.js';
import { GrammarImpl } from '../dictionary/grammarImpl.js';
