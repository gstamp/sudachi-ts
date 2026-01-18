export const SYSTEM_DICT_VERSION = 0xce9f011a92394434n;
export const USER_DICT_VERSION = 0xca9811756ff64fb0n;

export class DictionaryHeader {
	private readonly _version: bigint;
	private readonly _createTime: bigint;
	private readonly _description: string;

	static readonly DESCRIPTION_SIZE = 256;
	static readonly STORAGE_SIZE = 8 + 8 + DictionaryHeader.DESCRIPTION_SIZE;

	constructor(version: bigint, createTime: bigint, description: string) {
		this._version = version;
		this._createTime = createTime;
		this._description = description;
	}

	toBytes(): Uint8Array {
		const encoder = new TextEncoder();
		const encoded = encoder.encode(this._description);

		const output = new Uint8Array(DictionaryHeader.STORAGE_SIZE);

		for (let i = 0; i < 8; i++) {
			output[i] = Number((this._version >> BigInt(i * 8)) & 0xffn);
		}
		for (let i = 0; i < 8; i++) {
			output[8 + i] = Number((this._createTime >> BigInt(i * 8)) & 0xffn);
		}

		const descStart = 16;
		const _descEnd = descStart + DictionaryHeader.DESCRIPTION_SIZE;
		output.set(encoded.slice(0, DictionaryHeader.DESCRIPTION_SIZE), descStart);

		return output;
	}
}
