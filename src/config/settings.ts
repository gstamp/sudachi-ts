export type PluginConf<_T> = {
	className: string;
	settings: Settings;
};

export class Settings {
	private readonly data: Record<string, unknown>;

	constructor(data: Record<string, unknown> = {}) {
		this.data = { ...data };
	}

	static empty(): Settings {
		return new Settings({});
	}

	static parse(json: string, _basePath?: string): Settings {
		const data = JSON.parse(json) as Record<string, unknown>;
		if (typeof data !== 'object' || data === null) {
			throw new Error('root must be an object');
		}
		return new Settings(data);
	}

	getString(key: string, defaultValue?: string): string | null {
		const value = this.data[key];
		if (typeof value === 'string') {
			return value;
		}
		return defaultValue ?? null;
	}

	getInt(key: string, defaultValue: number = 0): number {
		const value = this.data[key];
		if (typeof value === 'number') {
			return value;
		}
		return defaultValue;
	}

	getBoolean(key: string, defaultValue: boolean): boolean {
		const value = this.data[key];
		if (typeof value === 'boolean') {
			return value;
		}
		return defaultValue;
	}

	getStringList(key: string): string[] {
		const value = this.data[key];
		if (Array.isArray(value)) {
			return value.filter((v) => typeof v === 'string') as string[];
		}
		return [];
	}

	getIntList(key: string): number[] {
		const value = this.data[key];
		if (Array.isArray(value)) {
			return value.filter((v) => typeof v === 'number') as number[];
		}
		return [];
	}

	getIntListList(key: string): number[][] {
		const value = this.data[key];
		if (Array.isArray(value)) {
			return value
				.map((item) => {
					if (Array.isArray(item)) {
						return item.filter((v) => typeof v === 'number') as number[];
					}
					return [];
				})
				.filter((arr) => arr.length > 0);
		}
		return [];
	}

	getPlugins<T>(key: string): PluginConf<T>[] | null {
		const value = this.data[key];
		if (Array.isArray(value)) {
			return value.map((item) => {
				if (typeof item === 'object' && item !== null && 'class' in item) {
					const obj = item as Record<string, unknown>;
					return {
						className: obj.class as string,
						settings: new Settings({ ...obj }),
					};
				}
				throw new Error(`sub-object for ${key} didn't have class key`);
			});
		}
		return null;
	}

	withFallback(other: Settings): Settings {
		return new Settings({ ...other.data, ...this.data });
	}

	merge(overrides: Record<string, unknown>): Settings {
		return new Settings({ ...this.data, ...overrides });
	}
}
