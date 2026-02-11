import { Config } from '../src/config/config.js';
import { DictionaryFactory } from '../src/dictionary/dictionaryFactory.js';

type CliArgs = {
	systemDictPath: string;
	text: string;
};

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const ansi = {
	reset: '\u001b[0m',
	bold: '\u001b[1m',
	dim: '\u001b[2m',
	cyan: '\u001b[36m',
	green: '\u001b[32m',
	yellow: '\u001b[33m',
	magenta: '\u001b[35m',
} as const;

function color(text: string, code: string): string {
	if (!useColor) {
		return text;
	}
	return `${code}${text}${ansi.reset}`;
}

function parseArgs(argv: string[]): CliArgs {
	const systemDictPath = argv[2];
	const text = argv[3];

	if (!systemDictPath || !text) {
		throw new Error(
			'Usage: bun examples/token-chunker-plugin.ts <system.dic path> "<text>"',
		);
	}

	return { systemDictPath, text };
}

type ReadableToken = {
	surface(): string;
	readingForm(): string;
};

function formatSurfaceReadingToken(token: ReadableToken): string {
	const surface = color(token.surface(), ansi.cyan);
	const reading = color(token.readingForm(), ansi.magenta);
	const separator = color('/', ansi.dim);
	return `${surface}${separator}${reading}`;
}

function toSurfaceReadings(tokens: Iterable<ReadableToken>): string {
	const surfaces: string[] = [];
	for (const token of tokens) {
		surfaces.push(formatSurfaceReadingToken(token));
	}
	return surfaces.join('|');
}

async function tokenizeWithConfig(
	systemDictPath: string,
	text: string,
	useTokenChunker: boolean,
): Promise<string> {
	const config = Config.parse(
		JSON.stringify({
			systemDict: systemDictPath,
			pathRewritePlugin: useTokenChunker
				? [
						{ class: 'com.worksap.nlp.sudachi.JoinNumericPlugin' },
						{
							class: 'com.worksap.nlp.sudachi.TokenChunkerPlugin',
							enableCompoundNouns: true,
							minCompoundLength: 2,
							excludedNounSubcategories: ['数詞', '接尾'],
						},
					]
				: [{ class: 'com.worksap.nlp.sudachi.JoinNumericPlugin' }],
		}),
	);

	const dictionary = await new DictionaryFactory().create(undefined, config);
	const tokenizer = dictionary.create();
	const tokens = tokenizer.tokenize(text);
	return toSurfaceReadings(tokens as Iterable<ReadableToken>);
}

async function main(): Promise<void> {
	const { systemDictPath, text } = parseArgs(process.argv);

	const baseline = await tokenizeWithConfig(systemDictPath, text, false);
	const withChunker = await tokenizeWithConfig(systemDictPath, text, true);

	console.log(color('Token Chunker Comparison', `${ansi.bold}${ansi.cyan}`));
	console.log(color('------------------------', ansi.dim));
	console.log(`${color('Input', `${ansi.bold}${ansi.yellow}`)}: ${text}`);
	console.log(`${color('Baseline', `${ansi.bold}${ansi.magenta}`)}: ${baseline}`);
	console.log(
		`${color('With TokenChunkerPlugin', `${ansi.bold}${ansi.green}`)}: ${withChunker}`,
	);
}

void main();
