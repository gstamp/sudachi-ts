export interface PluginConfig {
	className: string;
	settings: unknown;
}

export class PluginLoader {
	async loadInputTextPlugin(
		className: string,
		_settings: unknown,
	): Promise<{ className: string }> {
		return { className };
	}
}
