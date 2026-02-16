import { beforeEach, describe, expect, test } from 'vitest';
import { NumericParser, ParseError } from '../../../src/utils/numericParser.js';

describe('NumericParser', () => {
	let parser: NumericParser;

	beforeEach(() => {
		parser = new NumericParser();
	});

	function parse(s: string): boolean {
		for (let i = 0; i < s.length; i++) {
			const char = s[i];
			if (char !== undefined && !parser.append(char)) {
				return false;
			}
		}
		return parser.done();
	}

	describe('digits', () => {
		test('should parse simple digits', () => {
			expect(parse('1000')).toBe(true);
			expect(parser.getNormalized()).toBe('1000');
		});
	});

	describe('startsWithZero', () => {
		test('should parse leading zeros', () => {
			expect(parse('001000')).toBe(true);
			expect(parser.getNormalized()).toBe('001000');
		});

		test('should parse Japanese zero', () => {
			parser.clear();
			expect(parse('〇一〇〇〇')).toBe(true);
			expect(parser.getNormalized()).toBe('01000');
		});

		test('should parse decimal with leading zeros', () => {
			parser.clear();
			expect(parse('00.1000')).toBe(true);
			expect(parser.getNormalized()).toBe('00.1');
		});

		test('should parse all zeros', () => {
			parser.clear();
			expect(parse('000')).toBe(true);
			expect(parser.getNormalized()).toBe('000');
		});
	});

	describe('useSmallUnit', () => {
		test('should parse Japanese small units', () => {
			expect(parse('二十七')).toBe(true);
			expect(parser.getNormalized()).toBe('27');
		});

		test('should parse千 with numbers', () => {
			parser.clear();
			expect(parse('千三百二十七')).toBe(true);
			expect(parser.getNormalized()).toBe('1327');
		});

		test('should parse千十七', () => {
			parser.clear();
			expect(parse('千十七')).toBe(true);
			expect(parser.getNormalized()).toBe('1017');
		});

		test('should parse decimal with units', () => {
			parser.clear();
			expect(parse('千三百二十七.〇五')).toBe(true);
			expect(parser.getNormalized()).toBe('1327.05');
		});

		test('should reject invalid small units', () => {
			parser.clear();
			expect(parse('三百二十百')).toBe(false);
		});
	});

	describe('useLargeUnit', () => {
		test('should parse万', () => {
			expect(parse('1万')).toBe(true);
			expect(parser.getNormalized()).toBe('10000');
		});

		test('should parse complex large units', () => {
			parser.clear();
			expect(parse('千三百二十七万')).toBe(true);
			expect(parser.getNormalized()).toBe('13270000');
		});

		test('should parse万 with following digits', () => {
			parser.clear();
			expect(parse('千三百二十七万一四')).toBe(true);
			expect(parser.getNormalized()).toBe('13270014');
		});

		test('should parse decimal with large units', () => {
			parser.clear();
			expect(parse('千三百二十七万一四.〇五')).toBe(true);
			expect(parser.getNormalized()).toBe('13270014.05');
		});

		test('should parse very large units', () => {
			parser.clear();
			expect(parse('三兆2千億千三百二十七万一四.〇五')).toBe(true);
			expect(parser.getNormalized()).toBe('3200013270014.05');
		});

		test('should reject invalid large units', () => {
			parser.clear();
			expect(parse('億万')).toBe(false);
		});
	});

	describe('floatWithUnit', () => {
		test('should parse decimal with千', () => {
			expect(parse('1.5千')).toBe(true);
			expect(parser.getNormalized()).toBe('1500');
		});

		test('should parse decimal with百万', () => {
			parser.clear();
			expect(parse('1.5百万')).toBe(true);
			expect(parser.getNormalized()).toBe('1500000');
		});

		test('should parse complex decimals', () => {
			parser.clear();
			expect(parse('1.5百万1.5千20')).toBe(true);
			expect(parser.getNormalized()).toBe('1501520');
		});

		test('should reject invalid decimal units', () => {
			parser.clear();
			expect(parse('1.5千5百')).toBe(false);
		});

		test('should reject decimal followed by raw digits', () => {
			parser.clear();
			expect(parse('1.5千500')).toBe(false);
		});
	});

	describe('longNumeric', () => {
		test('should parse very long numbers', () => {
			expect(parse('200000000000000000000万')).toBe(true);
			expect(parser.getNormalized()).toBe('2000000000000000000000000');
		});
	});

	describe('withComma', () => {
		test('should parse comma-separated numbers', () => {
			expect(parse('2,000,000')).toBe(true);
			expect(parser.getNormalized()).toBe('2000000');
		});

		test('should parse comma with units', () => {
			parser.clear();
			expect(parse('259万2,300')).toBe(true);
			expect(parser.getNormalized()).toBe('2592300');
		});

		test('should reject invalid comma placement', () => {
			parser.clear();
			expect(parse('200,00,000')).toBe(false);
			expect(parser.errorState).toBe(ParseError.COMMA);
		});

		test('should reject incomplete comma groups', () => {
			parser.clear();
			expect(parse('2,4')).toBe(false);
			expect(parser.errorState).toBe(ParseError.COMMA);
		});

		test('should reject leading zeros with comma', () => {
			parser.clear();
			expect(parse('000,000')).toBe(false);
			expect(parser.errorState).toBe(ParseError.COMMA);
		});

		test('should reject comma at start', () => {
			parser.clear();
			expect(parse(',000')).toBe(false);
			expect(parser.errorState).toBe(ParseError.COMMA);
		});

		test('should reject comma in decimal part', () => {
			parser.clear();
			expect(parse('256,55.1')).toBe(false);
			expect(parser.errorState).toBe(ParseError.COMMA);
		});
	});

	describe('notDigit', () => {
		test('should reject non-digit characters', () => {
			expect(parse('@@@')).toBe(false);
		});
	});

	describe('floatPoint', () => {
		test('should parse simple decimal', () => {
			expect(parse('6.0')).toBe(true);
			expect(parser.getNormalized()).toBe('6');
		});

		test('should reject trailing point', () => {
			parser.clear();
			expect(parse('6.')).toBe(false);
			expect(parser.errorState).toBe(ParseError.POINT);
		});

		test('should reject multiple points', () => {
			parser.clear();
			expect(parse('1.2.3')).toBe(false);
			expect(parser.errorState).toBe(ParseError.POINT);
		});
	});
});
