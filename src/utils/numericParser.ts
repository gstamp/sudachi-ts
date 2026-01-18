class StringNumber {
	significand: string = '';
	scale: number = 0;
	point: number = -1;
	isAllZero: boolean = true;

	clear(): void {
		this.significand = '';
		this.scale = 0;
		this.point = -1;
		this.isAllZero = true;
	}

	append(i: number): void {
		if (i !== 0) {
			this.isAllZero = false;
		}
		this.significand += intToChar(i);
	}

	shiftScale(i: number): void {
		if (this.isZero()) {
			this.significand += '1';
		}
		this.scale += i;
	}

	add(number: StringNumber): boolean {
		if (number.isZero()) {
			return true;
		}

		if (this.isZero()) {
			this.significand += number.significand;
			this.scale = number.scale;
			this.point = number.point;
			return true;
		}

		this.normalizeScale();
		const l = number.intLength();
		if (this.scale >= l) {
			this.fillZero(this.scale - l);
			if (number.point >= 0) {
				this.point = this.significand.length + number.point;
			}
			this.significand += number.significand;
			this.scale = number.scale;
			return true;
		}

		return false;
	}

	setPoint(): boolean {
		if (this.scale === 0 && this.point < 0) {
			this.point = this.significand.length;
			return true;
		}
		return false;
	}

	intLength(): number {
		this.normalizeScale();
		if (this.point >= 0) {
			return this.point;
		}
		return this.significand.length + this.scale;
	}

	isZero(): boolean {
		return this.significand.length === 0;
	}

	toString(): string {
		if (this.isZero()) {
			return '0';
		}

		this.normalizeScale();
		if (this.scale > 0) {
			this.fillZero(this.scale);
		} else if (this.point >= 0) {
			this.significand =
				this.significand.slice(0, this.point) +
				'.' +
				this.significand.slice(this.point);
			if (this.point === 0) {
				this.significand = `0${this.significand}`;
			}
			let i = this.significand.length - 1;
			while (i >= 0 && this.significand[i] === '0') {
				i--;
			}
			this.significand = this.significand.slice(0, i + 1);
			if (this.significand[this.significand.length - 1] === '.') {
				this.significand = this.significand.slice(0, -1);
			}
		}

		return this.significand;
	}

	private normalizeScale(): void {
		if (this.point >= 0) {
			const nScale = this.significand.length - this.point;
			if (nScale > this.scale) {
				this.point += this.scale;
				this.scale = 0;
			} else {
				this.scale -= nScale;
				this.point = -1;
			}
		}
	}

	private fillZero(length: number): void {
		for (let i = 0; i < length; i++) {
			this.significand += '0';
		}
	}
}

function intToChar(i: number): string {
	return String.fromCharCode(48 + i);
}

export enum ParseError {
	NONE,
	POINT,
	COMMA,
	OTHER,
}

const CHAR_TO_NUM: Map<string, number> = new Map([
	['0', 0],
	['1', 1],
	['2', 2],
	['3', 3],
	['4', 4],
	['5', 5],
	['6', 6],
	['7', 7],
	['8', 8],
	['9', 9],
	['〇', 0],
	['一', 1],
	['二', 2],
	['三', 3],
	['四', 4],
	['五', 5],
	['六', 6],
	['七', 7],
	['八', 8],
	['九', 9],
	['十', -1],
	['百', -2],
	['千', -3],
	['万', -4],
	['億', -8],
	['兆', -12],
]);

export class NumericParser {
	digitLength: number = 0;
	isFirstDigit: boolean = true;
	hasComma: boolean = false;
	hasHangingPoint: boolean = false;
	errorState: ParseError = ParseError.NONE;
	total: StringNumber = new StringNumber();
	subtotal: StringNumber = new StringNumber();
	tmp: StringNumber = new StringNumber();

	constructor() {
		this.clear();
	}

	clear(): void {
		this.digitLength = 0;
		this.isFirstDigit = true;
		this.hasComma = false;
		this.hasHangingPoint = false;
		this.errorState = ParseError.NONE;
		this.total.clear();
		this.subtotal.clear();
		this.tmp.clear();
	}

	append(c: string): boolean {
		if (c === '.') {
			this.hasHangingPoint = true;
			if (this.isFirstDigit) {
				this.errorState = ParseError.POINT;
				return false;
			} else if (this.hasComma && !this.checkComma()) {
				this.errorState = ParseError.COMMA;
				return false;
			} else if (!this.tmp.setPoint()) {
				this.errorState = ParseError.POINT;
				return false;
			}
			this.hasComma = false;
			return true;
		} else if (c === ',') {
			if (!this.checkComma()) {
				this.errorState = ParseError.COMMA;
				return false;
			}
			this.hasComma = true;
			this.digitLength = 0;
			return true;
		}

		const n = CHAR_TO_NUM.get(c);
		if (n === undefined) {
			return false;
		}
		if (this.isSmallUnit(n)) {
			this.tmp.shiftScale(-n);
			if (!this.subtotal.add(this.tmp)) {
				return false;
			}
			this.tmp.clear();
			this.isFirstDigit = true;
			this.digitLength = 0;
			this.hasComma = false;
		} else if (this.isLargeUnit(n)) {
			if (!this.subtotal.add(this.tmp) || this.subtotal.isZero()) {
				return false;
			}
			this.subtotal.shiftScale(-n);
			if (!this.total.add(this.subtotal)) {
				return false;
			}
			this.subtotal.clear();
			this.tmp.clear();
			this.isFirstDigit = true;
			this.digitLength = 0;
			this.hasComma = false;
		} else {
			this.tmp.append(n);
			this.isFirstDigit = false;
			this.digitLength++;
			this.hasHangingPoint = false;
		}

		return true;
	}

	done(): boolean {
		const ret = this.subtotal.add(this.tmp) && this.total.add(this.subtotal);
		if (this.hasHangingPoint) {
			this.errorState = ParseError.POINT;
			return false;
		} else if (this.hasComma && this.digitLength !== 3) {
			this.errorState = ParseError.COMMA;
			return false;
		}
		return ret;
	}

	getNormalized(): string {
		return this.total.toString();
	}

	private checkComma(): boolean {
		if (this.isFirstDigit) {
			return false;
		} else if (!this.hasComma) {
			return this.digitLength <= 3 && !this.tmp.isZero() && !this.tmp.isAllZero;
		} else {
			return this.digitLength === 3;
		}
	}

	private isSmallUnit(n: number): boolean {
		return n < 0 && n >= -3;
	}

	private isLargeUnit(n: number): boolean {
		return n <= -4;
	}
}
