const QUOTE = '"';
const DELIMITER = ',';
const NEWLINE = '\n';

export class CSVParser {
	private _input: string;
	private _position = 0;
	private _lineNumber = 1;

	constructor(input: string) {
		this._input = input;
	}

	getNextRecord(): string[] | null {
		if (this._position >= this._input.length) {
			return null;
		}

		const record: string[] = [];
		let current = '';
		let inQuotes = false;

		while (this._position < this._input.length) {
			const char = this._input[this._position]!;

			if (char === QUOTE) {
				const nextChar = this._input[this._position + 1];

				if (inQuotes && nextChar === QUOTE) {
					current += QUOTE;
					this._position += 2;
				} else {
					inQuotes = !inQuotes;
					this._position++;
				}
			} else if (char === DELIMITER && !inQuotes) {
				record.push(current);
				current = '';
				this._position++;
			} else if (char === NEWLINE && !inQuotes) {
				record.push(current);
				this._lineNumber++;
				this._position++;
				return record;
			} else if (
				char === '\r' &&
				!inQuotes &&
				this._input[this._position + 1] === NEWLINE
			) {
				record.push(current);
				this._lineNumber++;
				this._position += 2;
				return record;
			} else if (char === '\r' && !inQuotes) {
				record.push(current);
				this._lineNumber++;
				this._position++;
				return record;
			} else {
				current += char;
				this._position++;
			}
		}

		if (current.length > 0 || record.length > 0) {
			record.push(current);
		}

		return record;
	}

	getLineNumber(): number {
		return this._lineNumber;
	}

	getPosition(): number {
		return this._position;
	}

	reset(input: string): void {
		this._input = input;
		this._position = 0;
		this._lineNumber = 1;
	}
}
