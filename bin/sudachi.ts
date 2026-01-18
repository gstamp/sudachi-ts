#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { Config } from '../src/config/config.js';
import { DEFAULT_CONFIG_JSON } from '../src/config/defaultConfig.js';
import { PathAnchor } from '../src/config/pathAnchor.js';
import { Settings } from '../src/config/settings.js';
import { SplitMode } from '../src/core/tokenizer.js';
import { DictionaryFactory } from '../src/dictionary/dictionaryFactory.js';
import type { MorphemeFormatterPlugin } from '../src/plugins/formatter/base.js';
import { SimpleMorphemeFormatter } from '../src/plugins/formatter/simpleMorphemeFormatter.js';
import { WordSegmentationFormatter } from '../src/plugins/formatter/wordSegmentationFormatter.js';

interface CLIOptions {
	configPath?: string;
	settingsString?: string;
	resourcesPath?: string;
	mode: SplitMode;
	outputPath?: string;
	wordSegmentation: boolean;
	lineBreakAtEosInWordSegmentation: boolean;
	showDetails: boolean;
	ignoreErrors: boolean;
	debugMode: boolean;
	formatterKind?: string;
	systemDict?: string;
	userDicts: string[];
	inputFiles: string[];
}

type OutputWriter = (data: string) => void;

function createWriter(outputPath?: string): OutputWriter {
	if (outputPath) {
		return (data: string) => writeFileSync(outputPath, data, { flag: 'a' });
	}
	return (data: string) => process.stdout.write(data);
}

async function main() {
	const args = process.argv.slice(2);
	const options: CLIOptions = {
		mode: SplitMode.C,
		wordSegmentation: false,
		lineBreakAtEosInWordSegmentation: true,
		showDetails: false,
		ignoreErrors: false,
		debugMode: false,
		userDicts: [],
		inputFiles: [],
	};

	let i = 0;
	for (; i < args.length; i++) {
		const arg = args[i];
		if (!arg) continue;

		if (arg === '-r' && i + 1 < args.length) {
			options.configPath = args[++i];
		} else if (arg === '-s' && i + 1 < args.length) {
			options.settingsString = args[++i];
		} else if (arg === '-p' && i + 1 < args.length) {
			options.resourcesPath = args[++i];
		} else if (arg === '-m' && i + 1 < args.length) {
			const m = args[++i]?.toUpperCase();
			if (m === 'A') options.mode = SplitMode.A;
			else if (m === 'B') options.mode = SplitMode.B;
			else options.mode = SplitMode.C;
		} else if (arg === '-o' && i + 1 < args.length) {
			options.outputPath = args[++i];
		} else if (arg === '-t') {
			options.wordSegmentation = true;
			options.lineBreakAtEosInWordSegmentation = false;
		} else if (arg === '-ts') {
			options.wordSegmentation = true;
			options.lineBreakAtEosInWordSegmentation = true;
		} else if (arg === '-a') {
			options.showDetails = true;
		} else if (arg === '-d') {
			options.debugMode = true;
		} else if (arg === '-f') {
			options.ignoreErrors = true;
		} else if (arg === '-h' || arg === '--help') {
			printHelp();
			return;
		} else if (arg === '--systemDict' && i + 1 < args.length) {
			options.systemDict = args[++i] ?? undefined;
		} else if (arg === '--userDict' && i + 1 < args.length) {
			const userDict = args[++i];
			if (userDict) {
				options.userDicts.push(userDict);
			}
		} else if (arg === '--format' && i + 1 < args.length) {
			options.formatterKind = args[++i] ?? undefined;
		} else if (!arg.startsWith('-')) {
			options.inputFiles.push(arg);
		} else {
			break;
		}
	}

	const config = await loadConfig(options);
	const dictionary = await new DictionaryFactory().create(undefined, config);
	const tokenizer = dictionary.create();
	const formatter = await createFormatter(options);

	if (options.inputFiles.length === 0) {
		await processInput(process.stdin, tokenizer, formatter, options);
	} else {
		for (const file of options.inputFiles) {
			const content = readFileSync(file, 'utf-8');
			const stream = Readable.from([content]);
			await processInput(stream, tokenizer, formatter, options);
		}
	}
}

async function loadConfig(options: CLIOptions): Promise<Config> {
	let config = Config.parse(DEFAULT_CONFIG_JSON);
	let anchor = PathAnchor.none();

	if (options.resourcesPath) {
		anchor = PathAnchor.filesystem(options.resourcesPath).andThen(anchor);
		config = config.anchoredWith(anchor);
	}

	if (options.configPath) {
		const fileConfig = await Config.fromFile(options.configPath);
		config = fileConfig.withFallback(config);
	}

	if (options.settingsString) {
		const stringConfig = Config.parse(options.settingsString);
		config = stringConfig.withFallback(config);
	}

	if (options.systemDict) {
		config = new Config(
			config.getSettings().merge({ systemDict: options.systemDict }),
			anchor,
		);
	}

	if (options.userDicts.length > 0) {
		config = new Config(
			config.getSettings().merge({
				userDict: [...config.getStringList('userDict'), ...options.userDicts],
			}),
			anchor,
		);
	}

	return config;
}

async function createFormatter(
	options: CLIOptions,
): Promise<MorphemeFormatterPlugin> {
	if (options.formatterKind) {
		const { PluginLoader } = await import('../src/plugins/loader.js');
		const loader = new PluginLoader();
		const settings = new Settings({});
		const loaded = await loader.loadMorphemeFormatterPlugin(
			options.formatterKind,
			settings,
		);
		return loaded.plugin;
	}

	if (options.wordSegmentation) {
		const formatter = new WordSegmentationFormatter();
		formatter.setSettings(new Settings({}));
		formatter.setUp();
		formatter.setEosString(
			options.lineBreakAtEosInWordSegmentation ? '\n' : ' ',
		);
		return formatter;
	}

	const formatter = new SimpleMorphemeFormatter();
	formatter.setSettings(new Settings({}));
	formatter.setUp();
	if (options.showDetails) {
		formatter.showDetail();
	}
	return formatter;
}

async function processInput(
	input: Readable,
	tokenizer: any,
	formatter: MorphemeFormatterPlugin,
	options: CLIOptions,
) {
	const writer = createWriter(options.outputPath);
	let buffer = '';

	for await (const chunk of input) {
		buffer += chunk;
		const lines = buffer.split('\n');
		buffer = lines.pop() || '';

		for (const line of lines) {
			if (line === '') continue;
			try {
				const morphemes = tokenizer.tokenize(options.mode, line);
				const result = formatter.printSentence(morphemes);
				writer(result);
				if (
					options.wordSegmentation &&
					options.lineBreakAtEosInWordSegmentation
				) {
					writer('\n');
				}
			} catch (error) {
				if (!options.ignoreErrors) {
					throw error;
				}
				console.error(`Error processing line: ${line}`, error);
			}
		}
	}

	if (buffer.trim()) {
		try {
			const morphemes = tokenizer.tokenize(options.mode, buffer);
			const result = formatter.printSentence(morphemes);
			writer(result);
			if (
				options.wordSegmentation &&
				options.lineBreakAtEosInWordSegmentation
			) {
				writer('\n');
			}
		} catch (error) {
			if (!options.ignoreErrors) {
				throw error;
			}
			console.error(`Error processing line: ${buffer}`, error);
		}
	}
}

function printHelp() {
	console.log('usage: sudachi [-r file] [-m A|B|C] [-o file] [file ...]');
	console.log();
	console.log('Options:');
	console.log('  -r file\t\tread settings from file (overrides -s)');
	console.log(
		'  -s string\t\tadditional settings in JSON format (overrides -r)',
	);
	console.log('  -p directory\troot directory of resources');
	console.log('  -m mode\t\tmode of splitting (A, B, or C, default: C)');
	console.log('  -o file\t\toutput to file');
	console.log('  -t\t\tseparate words with spaces');
	console.log(
		'  -ts\t\tseparate words with spaces, and break line for each sentence',
	);
	console.log('  -a\t\tshow details');
	console.log('  -f\t\tignore errors');
	console.log('  -d\t\tdebug mode');
	console.log(
		'  --systemDict file\tpath to a system dictionary (overrides everything)',
	);
	console.log(
		'  --userDict file\tpath to an additional user dictionary (appended)',
	);
	console.log('  --format class\tcustom formatter class');
	console.log('  -h\t\tshow this help');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
