import { Settings } from '../config/settings.js';

export abstract class Plugin {
	protected settings: Settings;

	constructor() {
		this.settings = Settings.empty();
	}

	setSettings(settings: Settings): void {
		this.settings = settings;
	}

	getSettings(): Settings {
		return this.settings;
	}
}
