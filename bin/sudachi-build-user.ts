#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { BinaryDictionary } from '../src/dictionary/binaryDictionary.js';
import { userBuilder } from '../src/dictionary-build/dicBuilder.js';
import { Progress } from '../src/dictionary-build/progress.js';
import {
	formatBuildStats,
	BuildStatsFormatter,
} from '../src/utils/buildStats.js';

interface BuildOptions {
	outputPath: string;
	systemDictPath: string;
	description: string;
	lexiconPaths: string[];
	statsFormat: 'console' | 'json' | 'csv';
}

function printUsage() {
	console.error(
		'usage: sudachi-build-user -o file -s file [-d description] [--stats format] files...',
	);
	console.error();
	console.error('  -o file\t\toutput to file');
	console.error('  -s file\t\tsystem dictionary');
	console.error('  -d description\tcomment');
	console.error('  --stats format\tstatistics output format (console|json|csv)');
}

function parseArgs(args: string[]): BuildOptions | null {
	let outputPath: string | null = null;
	let systemDictPath: string | null = null;
	let description = '';
	const lexiconPaths: string[] = [];
	let statsFormat: 'console' | 'json' | 'csv' = 'console';

	let i = 0;
	for (; i < args.length; i++) {
		const arg = args[i]!;
		if (arg === '-o' && i + 1 < args.length) {
			outputPath = args[++i]!;
		} else if (arg === '-s' && i + 1 < args.length) {
			systemDictPath = args[++i]!;
		} else if (arg === '-d' && i + 1 < args.length) {
			description = args[++i]!;
		} else if (arg === '--stats' && i + 1 < args.length) {
			const format = args[++i]!;
			if (format === 'json' || format === 'csv' || format === 'console') {
				statsFormat = format;
			}
		} else if (arg === '-h' || arg === '--help') {
			printUsage();
			return null;
		} else if (!arg.startsWith('-')) {
			break;
		}
	}

	const lexiconArgs = args.slice(i);
	lexiconPaths.push(...lexiconArgs);

	if (
		outputPath === null ||
		systemDictPath === null ||
		lexiconArgs.length === 0
	) {
		printUsage();
		return null;
	}

	return {
		outputPath: outputPath as string,
		systemDictPath: systemDictPath as string,
		description,
		lexiconPaths: lexiconArgs,
		statsFormat,
	};
}

function createProgress(name: string): Progress {
	const progress = new Progress();
	const stepSize = 0.05;
	let lastProgress = 0;

	process.stderr.write(`${name}\t`);

	progress.on((current, max) => {
		const ratio = current / max;
		while (lastProgress < ratio) {
			lastProgress += stepSize;
			process.stderr.write('.');
		}
	});

	return progress;
}

async function main() {
	const args = process.argv.slice(2);
	const options = parseArgs(args);

	if (options === null) {
		process.exit(0);
	}

	const {
		outputPath,
		systemDictPath,
		description,
		lexiconPaths,
		statsFormat,
	} = options;

	try {
		const systemDictContent = readFileSync(systemDictPath);
		const systemDict = new BinaryDictionary(systemDictContent);

		console.error(`system dictionary: ${systemDictPath}`);

		const progress = createProgress('building');
		console.error();

		const builder = userBuilder(systemDict)
			.description(description)
			.progress(progress);

		for (const lexiconPath of lexiconPaths) {
			const lexiconContent = readFileSync(lexiconPath, 'utf-8');
			const _lexiconProgress = createProgress(`${lexiconPath}`);
			console.error();
			await builder.lexicon(lexiconContent, lexiconPath);
		}

		console.error('\nbuilding...');
		const { buffer, stats } = await builder.build();

		// Ensure directory exists
		const dir = dirname(outputPath);
		if (dir !== '.') {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(outputPath, buffer);

		console.error(`Done! (${buffer.length} bytes)`);
		console.error();

		if (statsFormat === 'json') {
			console.log(formatBuildStats(stats, 'json'));
		} else if (statsFormat === 'csv') {
			console.log(formatBuildStats(stats, 'csv'));
		} else {
			console.error('Statistics:');
			console.error(formatBuildStats(stats, 'console'));
		}
	} catch (error) {
		console.error(
			'Error:',
			error instanceof Error ? error.message : String(error),
		);
		process.exit(1);
	}
}

main();
