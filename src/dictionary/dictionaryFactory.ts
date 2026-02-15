import { readFile } from 'node:fs/promises';
import { Config, loadConfig } from '../config/config.js';
import { DEFAULT_CONFIG_JSON } from '../config/defaultConfig.js';
import { Dictionary } from '../core/dictionary.js';
import { PluginLoader } from '../plugins/loader.js';
import type { OovProviderPlugin } from '../plugins/oov/base.js';
import { BinaryDictionary } from './binaryDictionary.js';
import { loadDefaultCompoundLexicon } from './defaultCompoundLexicon.js';
import type { Lexicon } from './lexicon.js';
import { LexiconSet } from './lexiconSet.js';

export class DictionaryFactory {
	async create(
		configPath?: string,
		customConfig?: Config,
	): Promise<Dictionary> {
		const config = customConfig || (await loadConfig(configPath));
		const anchor = config.getAnchor();

		const systemDictName = config.getString('systemDict') || 'system.dic';
		const systemDictPath = await anchor.resolve(systemDictName);

		let systemBuffer: Uint8Array;
		try {
			systemBuffer = await readFile(systemDictPath);
		} catch (e) {
			throw new Error(
				`Failed to load system dictionary: ${systemDictPath}. Cause: ${e}`,
			);
		}

		const systemDict = new BinaryDictionary(systemBuffer);

		const grammar = systemDict.getGrammar();
		let lexicon: Lexicon = systemDict.getLexicon();
		let lexiconSet: LexiconSet | null = null;
		const ensureLexiconSet = (): LexiconSet => {
			if (!lexiconSet) {
				lexiconSet = new LexiconSet(lexicon);
				lexicon = lexiconSet;
			}
			return lexiconSet;
		};

		const enableDefaultCompoundParticles = config.getBoolean(
			'enableDefaultCompoundParticles',
			true,
		);
		if (enableDefaultCompoundParticles) {
			const defaultCompoundLexicon =
				await loadDefaultCompoundLexicon(systemDict);
			ensureLexiconSet().add(defaultCompoundLexicon.getLexicon());
		}

		const userDictPaths = config.getStringList('userDict');
		if (userDictPaths.length > 0) {
			for (const path of userDictPaths) {
				const userPath = await anchor.resolve(path);
				const userBuffer = await readFile(userPath);
				const userDict = new BinaryDictionary(userBuffer);
				ensureLexiconSet().add(userDict.getLexicon());
			}
		}

		const loader = new PluginLoader(anchor);
		const defaultConfig = Config.parse(DEFAULT_CONFIG_JSON).setAnchor(anchor);

		let inputTextPluginConfs = config.getPlugins('inputTextPlugin');
		if (!inputTextPluginConfs || inputTextPluginConfs.length === 0) {
			inputTextPluginConfs = defaultConfig.getPlugins('inputTextPlugin');
		}
		const inputTextPlugins = (
			await loader.loadInputTextPlugins(inputTextPluginConfs || [], grammar)
		).map((p) => p.plugin);

		let oovProviderPluginConfs = config.getPlugins('oovProviderPlugin');
		if (!oovProviderPluginConfs || oovProviderPluginConfs.length === 0) {
			oovProviderPluginConfs = defaultConfig.getPlugins('oovProviderPlugin');
		}
		const oovProviderPlugins: OovProviderPlugin[] = [];
		for (const conf of oovProviderPluginConfs || []) {
			try {
				const loaded = await loader.loadOovProviderPlugin(
					conf.className,
					conf.settings,
				);
				await loaded.plugin.setUp(grammar);
				oovProviderPlugins.push(loaded.plugin);
			} catch (e) {
				// Only catch expected errors like missing plugin classes
				// Let unexpected errors propagate to surface real issues
				if (
					e instanceof Error &&
					(e.message.includes('not found') || e.message.includes('module'))
				) {
					console.warn(
						`Failed to load OOV provider ${conf.className}: ${e}. Skipping.`,
					);
				} else {
					throw e;
				}
			}
		}

		let pathRewritePluginConfs = config.getPlugins('pathRewritePlugin');
		if (!pathRewritePluginConfs || pathRewritePluginConfs.length === 0) {
			pathRewritePluginConfs = defaultConfig.getPlugins('pathRewritePlugin');
		}
		const pathRewritePlugins = (
			await loader.loadPathRewritePlugins(pathRewritePluginConfs || [], grammar)
		).map((p) => p.plugin);

		return new Dictionary(
			grammar,
			lexicon,
			inputTextPlugins,
			oovProviderPlugins,
			pathRewritePlugins,
		);
	}
}
