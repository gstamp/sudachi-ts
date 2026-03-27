import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PathAnchor } from '../config/pathAnchor.js';
import type { Settings } from '../config/settings.js';
import type { Grammar } from '../dictionary/grammar.js';
import type { Lexicon } from '../dictionary/lexicon.js';
import type { Plugin } from './base.js';
import type { EditConnectionCostPlugin } from './connection/base.js';
import { InhibitConnectionPlugin } from './connection/inhibitConnectionPlugin.js';
import { TargetedConnectionCostPlugin } from './connection/targetedConnectionCostPlugin.js';
import type { MorphemeFormatterPlugin } from './formatter/base.js';
import type { InputTextPlugin } from './inputText/base.js';
import { DefaultInputTextPlugin } from './inputText/defaultInputTextPlugin.js';
import { IgnoreYomiganaPlugin } from './inputText/ignoreYomiganaPlugin.js';
import { ProlongedSoundMarkInputTextPlugin } from './inputText/prolongedSoundMarkPlugin.js';
import type { OovProviderPlugin } from './oov/base.js';
import { CounterAliasOovProviderPlugin } from './oov/counterAliasOovProviderPlugin.js';
import { MeCabOovProviderPlugin } from './oov/meCabOovProviderPlugin.js';
import { RegexOovProviderPlugin } from './oov/regexOovProviderPlugin.js';
import { SimpleOovProviderPlugin } from './oov/simpleOovProviderPlugin.js';
import type { PathRewritePlugin } from './pathRewrite/base.js';
import { JoinKatakanaOovPlugin } from './pathRewrite/joinKatakanaOovPlugin.js';
import { JoinNumericPlugin } from './pathRewrite/joinNumericPlugin.js';

export interface LoadedPlugin<T extends Plugin> {
	plugin: T;
	className: string;
}

type PluginConfig = {
	className: string;
	settings: Settings;
};

type PluginConstructor = new () => Plugin;
type MaybePluginConstructor = PluginConstructor | null;

export class PluginLoader {
	constructor(private readonly anchor: PathAnchor = PathAnchor.none()) {}

	async loadInputTextPlugin(
		className: string,
		settings: Settings,
	): Promise<LoadedPlugin<InputTextPlugin>> {
		const plugin = await this.loadPlugin<InputTextPlugin>(className, settings);
		return { plugin, className };
	}

	async loadOovProviderPlugin(
		className: string,
		settings: Settings,
	): Promise<LoadedPlugin<OovProviderPlugin>> {
		const plugin = await this.loadPlugin<OovProviderPlugin>(
			className,
			settings,
		);
		return { plugin, className };
	}

	async loadPathRewritePlugin(
		className: string,
		settings: Settings,
	): Promise<LoadedPlugin<PathRewritePlugin>> {
		const plugin = await this.loadPlugin<PathRewritePlugin>(
			className,
			settings,
		);
		return { plugin, className };
	}

	async loadEditConnectionCostPlugin(
		className: string,
		settings: Settings,
	): Promise<LoadedPlugin<EditConnectionCostPlugin>> {
		const plugin = await this.loadPlugin<EditConnectionCostPlugin>(
			className,
			settings,
		);
		return { plugin, className };
	}

	async loadMorphemeFormatterPlugin(
		className: string,
		settings: Settings,
	): Promise<LoadedPlugin<MorphemeFormatterPlugin>> {
		const plugin = await this.loadPlugin<MorphemeFormatterPlugin>(
			className,
			settings,
		);
		return { plugin, className };
	}

	async loadInputTextPlugins(
		configs: PluginConfig[],
		grammar: Grammar,
	): Promise<LoadedPlugin<InputTextPlugin>[]> {
		return this.loadConfiguredPlugins(
			configs,
			grammar,
			(config) => this.loadInputTextPlugin(config.className, config.settings),
			(plugin) => plugin.setUp(grammar),
		);
	}

	async loadOovProviderPlugins(
		configs: PluginConfig[],
		grammar: Grammar,
	): Promise<LoadedPlugin<OovProviderPlugin>[]> {
		return this.loadConfiguredPlugins(
			configs,
			grammar,
			(config) => this.loadOovProviderPlugin(config.className, config.settings),
			(plugin) => plugin.setUp(grammar),
		);
	}

	async loadPathRewritePlugins(
		configs: PluginConfig[],
		grammar: Grammar,
	): Promise<LoadedPlugin<PathRewritePlugin>[]> {
		return this.loadConfiguredPlugins(
			configs,
			grammar,
			(config) => this.loadPathRewritePlugin(config.className, config.settings),
			(plugin) => plugin.setUp(grammar),
		);
	}

	async loadEditConnectionCostPlugins(
		configs: PluginConfig[],
		grammar: Grammar,
		lexicon: Lexicon,
	): Promise<LoadedPlugin<EditConnectionCostPlugin>[]> {
		const results: LoadedPlugin<EditConnectionCostPlugin>[] = [];
		for (const config of configs) {
			const loaded = await this.loadEditConnectionCostPlugin(
				config.className,
				config.settings,
			);
			await loaded.plugin.setUp(grammar, lexicon);
			results.push(loaded);
		}
		return results;
	}

	private async loadPlugin<T extends Plugin>(
		className: string,
		settings: Settings,
	): Promise<T> {
		try {
			let PluginClass: PluginConstructor;

			const builtInClass = this.getBuiltIn(className);
			if (builtInClass !== null) {
				PluginClass = builtInClass;
			} else {
				const classSpecifier = await this.resolveClassSpecifier(className);
				const module = await import(classSpecifier);
				PluginClass = this.findPluginClass(module, className);
			}

			const plugin = new PluginClass() as T;
			plugin.setSettings(settings);
			return plugin;
		} catch (error) {
			throw new Error(
				`Failed to load plugin ${className}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private async loadConfiguredPlugins<T extends Plugin>(
		configs: PluginConfig[],
		grammar: Grammar,
		loadPlugin: (config: PluginConfig) => Promise<LoadedPlugin<T>>,
		setUp: (plugin: T, grammar: Grammar) => void | Promise<void>,
	): Promise<LoadedPlugin<T>[]> {
		const results: LoadedPlugin<T>[] = [];
		for (const config of configs) {
			const loaded = await loadPlugin(config);
			await setUp(loaded.plugin, grammar);
			results.push(loaded);
		}
		return results;
	}

	private findPluginClass(
		module: unknown,
		className: string,
	): new () => Plugin {
		if (typeof module === 'object' && module !== null) {
			const obj = module as Record<string, unknown>;

			for (const key in obj) {
				const value = obj[key];
				if (typeof value === 'function' && this.isPluginConstructor(value)) {
					return value as new () => Plugin;
				}
			}

			if (
				obj.default &&
				typeof obj.default === 'function' &&
				this.isPluginConstructor(obj.default)
			) {
				return obj.default as new () => Plugin;
			}
		}

		throw new Error(`No valid plugin class found in module ${className}`);
	}

	private isPluginConstructor(fn: unknown): boolean {
		if (typeof fn !== 'function') {
			return false;
		}

		try {
			const instance = new (fn as new () => unknown)();
			return instance !== null && typeof instance === 'object';
		} catch {
			return false;
		}
	}

	private async resolveClassSpecifier(className: string): Promise<string> {
		if (
			this.anchor === PathAnchor.none() ||
			!this.isPathLikeSpecifier(className)
		) {
			return className;
		}

		const resolvedPath = await this.anchor.resolve(className);
		const absolutePath = isAbsolute(resolvedPath)
			? resolvedPath
			: resolve(resolvedPath);
		return pathToFileURL(absolutePath).href;
	}

	private isPathLikeSpecifier(className: string): boolean {
		return (
			className.startsWith('./') ||
			className.startsWith('../') ||
			className.startsWith('.\\') ||
			className.startsWith('..\\') ||
			isAbsolute(className)
		);
	}

	private getBuiltIn(name: string): MaybePluginConstructor {
		if (name in BUILT_IN_PLUGINS) {
			return BUILT_IN_PLUGINS[name]!;
		}
		const shortName = name.split('.').pop()!;
		if (shortName in BUILT_IN_PLUGINS) {
			return BUILT_IN_PLUGINS[shortName]!;
		}
		return null;
	}
}

const BUILT_IN_PLUGINS: Record<string, PluginConstructor> = {
	DefaultInputTextPlugin,
	IgnoreYomiganaPlugin,
	ProlongedSoundMarkInputTextPlugin,
	MeCabOovProviderPlugin,
	RegexOovProviderPlugin,
	CounterAliasOovProviderPlugin,
	SimpleOovProviderPlugin,
	JoinKatakanaOovPlugin,
	JoinNumericPlugin,
	InhibitConnectionPlugin,
	TargetedConnectionCostPlugin,
	'com.worksap.nlp.sudachi.DefaultInputTextPlugin': DefaultInputTextPlugin,
	'com.worksap.nlp.sudachi.IgnoreYomiganaPlugin': IgnoreYomiganaPlugin,
	'com.worksap.nlp.sudachi.ProlongedSoundMarkInputTextPlugin':
		ProlongedSoundMarkInputTextPlugin,
	'com.worksap.nlp.sudachi.MeCabOovProviderPlugin': MeCabOovProviderPlugin,
	'com.worksap.nlp.sudachi.RegexOovProviderPlugin': RegexOovProviderPlugin,
	'com.worksap.nlp.sudachi.CounterAliasOovProviderPlugin':
		CounterAliasOovProviderPlugin,
	'com.worksap.nlp.sudachi.SimpleOovProviderPlugin': SimpleOovProviderPlugin,
	'com.worksap.nlp.sudachi.JoinKatakanaOovPlugin': JoinKatakanaOovPlugin,
	'com.worksap.nlp.sudachi.JoinNumericPlugin': JoinNumericPlugin,
	'com.worksap.nlp.sudachi.InhibitConnectionPlugin': InhibitConnectionPlugin,
	'com.worksap.nlp.sudachi.TargetedConnectionCostPlugin':
		TargetedConnectionCostPlugin,
};
