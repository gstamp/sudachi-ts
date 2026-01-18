export class WordInfo {
	private readonly _surface: string;
	private readonly _headwordLength: number;
	private _posId: number;
	private readonly _normalizedForm: string;
	private readonly _dictionaryFormWordId: number;
	private readonly _dictionaryForm: string;
	private readonly _readingForm: string;
	private readonly _aUnitSplit: number[];
	private readonly _bUnitSplit: number[];
	private readonly _wordStructure: number[];
	private readonly _synonymGids: number[];

	constructor(
		surface: string,
		headwordLength: number,
		posId: number,
		normalizedForm: string,
		dictionaryFormWordId: number,
		dictionaryForm: string,
		readingForm: string,
		aUnitSplit: number[],
		bUnitSplit: number[],
		wordStructure: number[],
		synonymGids: number[],
	);

	constructor(
		surface: string,
		headwordLength: number,
		posId: number,
		normalizedForm: string,
		dictionaryForm: string,
		readingForm: string,
	);

	constructor(...args: unknown[]) {
		this._surface = args[0] as string;
		this._headwordLength = args[1] as number;
		this._posId = args[2] as number;
		this._normalizedForm = args[3] as string;

		if (typeof args[4] === 'number') {
			this._dictionaryFormWordId = args[4] as number;
			this._dictionaryForm = args[5] as string;
			this._readingForm = args[6] as string;
			this._aUnitSplit = args[7] as number[];
			this._bUnitSplit = args[8] as number[];
			this._wordStructure = args[9] as number[];
			this._synonymGids = args[10] as number[];
		} else {
			this._dictionaryFormWordId = -1;
			this._dictionaryForm = args[4] as string;
			this._readingForm = args[5] as string;
			this._aUnitSplit = [];
			this._bUnitSplit = [];
			this._wordStructure = [];
			this._synonymGids = [];
		}
	}

	getSurface(): string {
		return this._surface;
	}

	getLength(): number {
		return this._headwordLength;
	}

	getPOSId(): number {
		return this._posId;
	}

	setPOSId(posId: number): void {
		this._posId = posId;
	}

	getNormalizedForm(): string {
		return this._normalizedForm;
	}

	getDictionaryFormWordId(): number {
		return this._dictionaryFormWordId;
	}

	getDictionaryForm(): string {
		return this._dictionaryForm;
	}

	getReadingForm(): string {
		return this._readingForm;
	}

	getAunitSplit(): number[] {
		return this._aUnitSplit;
	}

	getBunitSplit(): number[] {
		return this._bUnitSplit;
	}

	getWordStructure(): number[] {
		return this._wordStructure;
	}

	getSynonymGroupIds(): number[] {
		return this._synonymGids;
	}
}
