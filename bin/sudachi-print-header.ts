#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { DictionaryHeader } from '../src/dictionary/dictionaryHeader.js';

interface PrintHeaderOptions {
	filenames: string[];
}

function printUsage() {
	console.error('usage: sudachi-print-header file...');
}

function printHeader(filename: string): void {
	const bytes = readFileSync(filename);
	const header = new DictionaryHeader(bytes, 0);

	console.log(`filename: ${filename}`);

	if (header.isSystemDictionary()) {
		console.log('type: system dictionary');
	} else if (header.isUserDictionary()) {
		console.log('type: user dictionary');
	} else {
		console.log('type: invalid file');
		return;
	}

	const createTimeMs = Number(header.getCreateTime());
	const createTimeDate = new Date(createTimeMs);
	console.log(`createTime: ${createTimeDate.toISOString()}`);
	console.log(`description: ${header.getDescription()}`);
}

function parseArgs(args: string[]): PrintHeaderOptions | null {
	if (args.length === 0) {
		printUsage();
		return null;
	}

	return { filenames: args };
}

async function main() {
	const args = process.argv.slice(2);
	const options = parseArgs(args);

	if (options === null) {
		process.exit(0);
	}

	for (const filename of options.filenames) {
		if (options.filenames.length > 1) {
			console.log();
		}
		printHeader(filename);
	}
}

main().catch((err) => {
	console.error('Error:', err instanceof Error ? err.message : String(err));
	process.exit(1);
});
