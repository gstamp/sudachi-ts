#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { BinaryDictionary } from '../src/dictionary/binaryDictionary.js';
import type { GrammarImpl } from '../src/dictionary/grammarImpl.js';
import type { Lexicon } from '../src/dictionary/lexicon.js';
import { LexiconSet } from '../src/dictionary/lexiconSet.js';
import type { WordInfo } from '../src/dictionary/wordInfo.js';

interface PrintOptions {
	dictPath: string;
	systemDictPath?: string | null;
	outputPath?: string | null;
}

function printUsage() {
	console.error('usage: sudachi-print-dict [-s file] [-o file] file');
	console.error();
	console.error('  -o file\toutput to file');
	console.error(
		'  -s file\tsystem dictionary (required for user dictionaries)',
	);
}

function parseArgs(args: string[]): PrintOptions | null {
	let dictPath: string | null = null;
	let systemDictPath: string | null = null;
	let outputPath: string | null = null;

	let i = 0;
	for (; i < args.length; i++) {
		const arg = args[i]!;
		if (arg === '-o' && i + 1 < args.length) {
			outputPath = args[++i]!;
		} else if (arg === '-s' && i + 1 < args.length) {
			systemDictPath = args[++i]!;
		} else if (arg === '-h' || arg === '--help') {
			printUsage();
			return null;
		} else if (!arg.startsWith('-')) {
			dictPath = arg;
			break;
		}
	}

	if (dictPath === null) {
		printUsage();
		return null;
	}

	return {
		dictPath: dictPath as string,
		systemDictPath,
		outputPath: outputPath as string | undefined,
	};
}

function escapeCsvField(value: string): string {
	const hasCommas = value.includes(',');
	const hasQuotes = value.includes('"');
	if (!hasCommas && !hasQuotes) {
		return value;
	}

	let result = '';
	for (let i = 0; i < value.length; i++) {
		const c = value[i];
		const code = value.codePointAt(i) || 0;
		if (c === '"' || c === ',') {
			result += `\\u00${code.toString(16).padStart(2, '0')}`;
		} else {
			result += c;
		}
	}
	return result;
}

function formatSynonymIds(ids: number[]): string {
	if (ids.length === 0) {
		return '*';
	}
	return ids.map((id) => id.toString().padStart(6, '0')).join('/');
}

function formatSplit(
	ids: number[],
	lexicon: Lexicon,
	grammar: GrammarImpl,
): string {
	if (ids.length === 0) {
		return '*';
	}
	return `"${ids.map((id) => formatWordRef(id, lexicon, grammar)).join('/')}"`;
}

function formatWordRef(
	wordId: number,
	lexicon: Lexicon,
	grammar: GrammarImpl,
): string {
	const info = lexicon.getWordInfo(wordId);
	const surface = escapeCsvField(info.getSurface());
	const posId = info.getPOSId();
	const pos = grammar.getPartOfSpeechString(posId).toString();
	const reading = escapeCsvField(info.getReadingForm());
	return `${surface},${pos},${reading}`;
}

function formatWordRefString(
	wordId: number,
	lexicon: Lexicon,
	grammar: GrammarImpl,
): string {
	if (wordId < 0) {
		return '*';
	}
	return `"${formatWordRef(wordId, lexicon, grammar)}"`;
}

function getUnitType(wordInfo: WordInfo): string {
	if (wordInfo.getAunitSplit().length === 0) {
		return 'A';
	} else if (wordInfo.getBunitSplit().length === 0) {
		return 'B';
	}
	return 'C';
}

function printEntry(
	lexicon: Lexicon,
	grammar: GrammarImpl,
	wordId: number,
	output: (line: string) => void,
) {
	const leftId = lexicon.getLeftId(wordId);
	const rightId = lexicon.getRightId(wordId);
	const cost = lexicon.getCost(wordId);
	const wordInfo = lexicon.getWordInfo(wordId);

	const fields: (string | number)[] = [
		escapeCsvField(wordInfo.getSurface()),
		leftId,
		rightId,
		cost,
		escapeCsvField(wordInfo.getSurface()),
		grammar.getPartOfSpeechString(wordInfo.getPOSId()).toString(),
		escapeCsvField(wordInfo.getReadingForm()),
		escapeCsvField(wordInfo.getNormalizedForm()),
		formatWordRefString(wordInfo.getDictionaryFormWordId(), lexicon, grammar),
		getUnitType(wordInfo),
		formatSplit(wordInfo.getAunitSplit(), lexicon, grammar),
		formatSplit(wordInfo.getBunitSplit(), lexicon, grammar),
		formatSplit(wordInfo.getWordStructure(), lexicon, grammar),
		formatSynonymIds(wordInfo.getSynonymGroupIds()),
	];

	output(fields.map((f) => f.toString()).join(','));
}

async function main() {
	const args = process.argv.slice(2);
	const options = parseArgs(args);

	if (options === null) {
		process.exit(0);
	}

	const { dictPath, systemDictPath, outputPath } = options;

	const dictContent = readFileSync(dictPath);
	const dict = new BinaryDictionary(dictContent);

	let grammar: GrammarImpl;
	let lexicon: Lexicon;
	let _isUser = false;

	if (dict.getDictionaryHeader().isUserDictionary()) {
		if (!systemDictPath) {
			console.error(
				'Error: System dictionary is required to print user dictionary',
			);
			process.exit(1);
		}

		const systemContent = readFileSync(systemDictPath);
		const systemDict = new BinaryDictionary(systemContent);

		grammar = systemDict.getGrammar();
		const lexiconSet = new LexiconSet(systemDict.getLexicon());
		lexiconSet.add(dict.getLexicon());
		lexicon = lexiconSet;
		_isUser = true;
	} else {
		grammar = dict.getGrammar();
		lexicon = new LexiconSet(dict.getLexicon());
		_isUser = false;
	}

	const entrySize = dict.getLexicon().size();
	let output: (line: string) => void;
	
	if (outputPath) {
		// Ensure directory exists
		const dir = dirname(outputPath);
		if (dir !== '.') {
			mkdirSync(dir, { recursive: true });
		}
		// Initialize file with empty content
		writeFileSync(outputPath, '');
		output = (line) => appendFileSync(outputPath, `${line}\n`);
	} else {
		output = (line) => console.log(line);
	}

	for (let wordId = 0; wordId < entrySize; wordId++) {
		printEntry(lexicon, grammar, wordId, output);
	}
}

main().catch((err) => {
	console.error('Error:', err instanceof Error ? err.message : String(err));
	process.exit(1);
});
