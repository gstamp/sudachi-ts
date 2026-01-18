#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { systemBuilder } from '../src/dictionary-build/dicBuilder.js';
import { Progress } from '../src/dictionary-build/progress.js';
import {
	formatBuildStats,
	BuildStatsFormatter,
} from '../src/utils/buildStats.js';

interface BuildOptions {
	outputPath: string;
	matrixPath: string;
	description: string;
	lexiconPaths: string[];
	statsFormat: 'console' | 'json' | 'csv';
}

function printUsage() {
	console.error(
		'usage: sudachi-build-system -o file -m file [-d description] [--stats format] files...',
	);
	console.error();
	console.error('  -o file\t\toutput to file');
	console.error('  -m file\t\tmatrix file');
	console.error('  -d description\tcomment');
	console.error('  --stats format\tstatistics output format (console|json|csv)');
}

function parseArgs(args: string[]): BuildOptions | null {
	let outputPath: string | null = null;
	let matrixPath: string | null = null;
	let description = '';
	const lexiconPaths: string[] = [];
	let statsFormat: 'console' | 'json' | 'csv' = 'console';

	let i = 0;
	for (; i < args.length; i++) {
		const arg = args[i]!;
		if (arg === '-o' && i + 1 < args.length) {
			outputPath = args[++i]!;
		} else if (arg === '-m' && i + 1 < args.length) {
			matrixPath = args[++i]!;
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

	if (outputPath === null || matrixPath === null || lexiconArgs.length === 0) {
		printUsage();
		return null;
	}

	return {
		outputPath: outputPath as string,
		matrixPath: matrixPath as string,
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

	const { outputPath, matrixPath, description, lexiconPaths, statsFormat } =
		options;

	try {
		const matrixContent = readFileSync(matrixPath, 'utf-8');
		const progress = createProgress('matrix');
		console.error();

		let builder = systemBuilder();
		builder = await builder.matrix(matrixContent);
		builder = builder.description(description).progress(progress);

		for (const [_index, lexiconPath] of lexiconPaths.entries()) {
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
