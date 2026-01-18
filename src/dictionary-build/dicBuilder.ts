import type { Grammar } from '../dictionary/grammar.js';
import type { Lexicon } from '../dictionary/lexicon.js';
import { ConnectionMatrix } from './connectionMatrix.js';
import { CsvLexicon } from './csvLexicon.js';
import { CSVParser } from './csvParser.js';
import {
	DictionaryHeader,
	SYSTEM_DICT_VERSION,
	USER_DICT_VERSION,
} from './dictionaryHeader.js';
import { ModelOutput } from './modelOutput.js';
import { POSTable } from './posTable.js';
import type { Progress } from './progress.js';
import { Index } from './trieIndex.js';
import type { WordIdResolver } from './wordIdResolver.js';
import {
	ChainResolver,
	CsvResolver,
	PrebuiltResolver,
} from './wordIdResolver.js';

export class Part {
	readonly name: string;
	readonly time: number;
	readonly size: number;

	constructor(name: string, time: number, size: number) {
		this.name = name;
		this.time = time;
		this.size = size;
	}
}

export class BuildStats {
	readonly inputs: Part[];
	readonly outputs: Part[];

	constructor(inputs: Part[], outputs: Part[]) {
		this.inputs = inputs;
		this.outputs = outputs;
	}
}

export abstract class DicBuilderBase {
	protected readonly _pos = new POSTable();
	protected readonly _connection = new ConnectionMatrix();
	protected readonly _index = new Index();
	protected _description = '';
	protected _version: bigint = 0n;
	protected _creationTime = Date.now();
	protected readonly _inputs: Part[] = [];
	protected _progress?: Progress;

	protected readonly _lexicon: CsvLexicon;

	constructor() {
		this._lexicon = new CsvLexicon(this._pos);
	}

	protected resolver(): WordIdResolver {
		return new CsvResolver();
	}

	async build(): Promise<{ buffer: Uint8Array; stats: BuildStats }> {
		this._lexicon.setResolver(this.resolver());

		const output = new ModelOutput();
		if (this._progress) {
			output.setProgress(this._progress);
		}

		const header = new DictionaryHeader(
			BigInt(this._version),
			BigInt(this._creationTime),
			this._description,
		);
		await output.write(header.toBytes());

		await this._pos.writeTo(output);

		// Ensure 4-byte alignment before connection matrix
		const posEnd = output.position;
		if (posEnd % 4 !== 0) {
			const padBytes = 4 - (posEnd % 4);
			const padding = new Uint8Array(padBytes);
			await output.write(padding);
		}

		await this._connection.writeTo(output);
		await this._index.writeTo(output);
		await this._lexicon.writeTo(output);

		const stats = new BuildStats(this._inputs, output.parts);
		const buffer = output.toBuffer();

		return { buffer, stats };
	}

	async lexicon(data: string, name?: string): Promise<this> {
		const startTime = performance.now();
		if (this._progress) {
		}

		const parser = new CSVParser(data);
		let line = 1;

		while (true) {
			const fields = parser.getNextRecord();
			if (fields === null) {
				break;
			}

			try {
				const entry = this._lexicon.parseLine(fields);
				const wordId = this._lexicon.addEntry(entry);

				if (entry.headword !== undefined) {
					this._index.add(entry.headword, wordId);
				}

				line++;
			} catch (e) {
				const error = e instanceof Error ? e : new Error(String(e));
				throw new Error(
					`Error at line ${line}: ${fields[0]} - ${error.message}`,
				);
			}

			if (this._progress) {
				this._progress.report(parser.getPosition(), data.length);
			}
		}

		const time = performance.now() - startTime;

		this._inputs.push(new Part(name || '<input>', time, line));

		return this;
	}

	description(desc: string): this {
		this._description = desc;
		return this;
	}

	progress(prog: Progress): this {
		this._progress = prog;
		return this;
	}
}

export class SystemDicBuilder extends DicBuilderBase {
	constructor() {
		super();
		this._version = SYSTEM_DICT_VERSION;
	}

	async matrix(data: string): Promise<this> {
		await this._connection.readEntries(data);
		this._lexicon.setLimits(
			this._connection.numLeft,
			this._connection.numRight,
		);
		return this;
	}
}

export class UserDicBuilder extends DicBuilderBase {
	private readonly _dictionary: {
		getGrammar(): Grammar;
		getLexicon(): Lexicon;
	};

	constructor(dictionary: { getGrammar(): Grammar; getLexicon(): Lexicon }) {
		super();
		this._version = USER_DICT_VERSION;
		this._dictionary = dictionary;

		const grammar = dictionary.getGrammar();
		const connection = grammar.getConnection();
		this._lexicon.setLimits(
			connection.getLeftSize(),
			connection.getRightSize(),
		);
		this._connection.makeEmpty();
		this._pos.preloadFrom(grammar);
	}

	protected override resolver(): WordIdResolver {
		const prebuilt = new PrebuiltResolver(this._dictionary.getLexicon());
		const csv = new CsvResolver();
		return new ChainResolver(prebuilt, csv);
	}
}

export function systemBuilder(): SystemDicBuilder {
	return new SystemDicBuilder();
}

export function userBuilder(dictionary: {
	getGrammar(): Grammar;
	getLexicon(): Lexicon;
}): UserDicBuilder {
	return new UserDicBuilder(dictionary);
}
