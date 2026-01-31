import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PathAnchor } from './pathAnchor.js';
import { Settings } from './settings.js';

export class Config {
	private readonly settings: Settings;
	private anchor: PathAnchor;

	constructor(settings: Settings, anchor?: PathAnchor) {
		this.settings = settings;
		this.anchor = anchor ?? PathAnchor.none();
	}

	static empty(): Config {
		return new Config(Settings.empty(), PathAnchor.none());
	}

	static async fromFile(filePath: string): Promise<Config> {
		const content = await readFile(filePath, 'utf-8');
		const baseDir = dirname(filePath);
		const anchor = PathAnchor.filesystem(baseDir);
		return new Config(Settings.parse(content), anchor);
	}

	static parse(json: string): Config {
		return new Config(Settings.parse(json));
	}

	static async defaultConfig(): Promise<Config> {
		try {
			return await Config.fromFile('./sudachi.json');
		} catch {
			return Config.empty();
		}
	}

	getSettings(): Settings {
		return this.settings;
	}

	getAnchor(): PathAnchor {
		return this.anchor;
	}

	setAnchor(anchor: PathAnchor): Config {
		this.anchor = anchor;
		return this;
	}

	withFallback(other: Config): Config {
		return new Config(
			this.settings.withFallback(other.settings),
			this.anchor.andThen(other.anchor),
		);
	}

	anchoredWith(anchor: PathAnchor): Config {
		return new Config(this.settings, this.anchor.andThen(anchor));
	}

	getString(key: string, defaultValue?: string): string | null {
		return this.settings.getString(key, defaultValue);
	}

	getInt(key: string, defaultValue: number = 0): number {
		return this.settings.getInt(key, defaultValue);
	}

	getBoolean(key: string, defaultValue: boolean): boolean {
		return this.settings.getBoolean(key, defaultValue);
	}

	getStringList(key: string): string[] {
		return this.settings.getStringList(key);
	}

	getIntList(key: string): number[] {
		return this.settings.getIntList(key);
	}

	getPlugins<T>(
		key: string,
	): { className: string; settings: Settings }[] | null {
		return this.settings.getPlugins<T>(key);
	}
}

export async function loadConfig(configPath?: string): Promise<Config> {
	if (configPath) {
		return await Config.fromFile(configPath);
	}
	return await Config.defaultConfig();
}
