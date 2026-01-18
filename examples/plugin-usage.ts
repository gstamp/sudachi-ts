import { Settings } from './config/settings.js';
import { PluginLoader } from './plugins/loader.js';

async function _loadPluginExample() {
	const settings = new Settings();

	const loader = new PluginLoader();
	const pluginConfig = {
		className: './myCustomPlugin.js',
		settings: settings,
	};

	const loaded = await loader.loadInputTextPlugin(
		pluginConfig.className,
		pluginConfig.settings,
	);

	console.log('Loaded plugin:', loaded.className);
}
