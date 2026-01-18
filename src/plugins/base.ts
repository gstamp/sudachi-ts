import type { Settings } from '../config/settings.js';

export abstract class Plugin {
	protected settings: Settings;

	constructor() {
		this.settings = { getString: () => null } as any;
	}

	setSettings(settings: Settings): void {
		this.settings = settings;
	}

	getSettings(): Settings {
		return this.settings;
	}
}
