import { DictionaryVersion } from './dictionaryVersion.js';

export class DictionaryHeader {
	private readonly version: bigint;
	private readonly createTime: bigint;
	private readonly description: string;

	static readonly DESCRIPTION_SIZE = 256;
	static readonly STORAGE_SIZE = 8 + 8 + DictionaryHeader.DESCRIPTION_SIZE;

	constructor(
		bytes?: Uint8Array,
		offset?: number,
		version?: bigint,
		createTime?: bigint,
		description?: string,
	) {
		if (bytes !== undefined && offset !== undefined) {
			this.version = this.readInt64(offset, bytes);
			offset += 8;

			this.createTime = this.readInt64(offset, bytes);
			offset += 8;

			const byteDescription = bytes.subarray(
				offset,
				offset + DictionaryHeader.DESCRIPTION_SIZE,
			);
			let length: number;
			for (length = 0; length < DictionaryHeader.DESCRIPTION_SIZE; length++) {
				if (byteDescription[length]! === 0) {
					break;
				}
			}

			const decoder = new TextDecoder('utf-8');
			this.description = decoder.decode(byteDescription.subarray(0, length));
		} else if (
			version !== undefined &&
			createTime !== undefined &&
			description !== undefined
		) {
			this.version = version;
			this.createTime = createTime;
			this.description = description;
		} else {
			throw new Error('Invalid arguments for DictionaryHeader constructor');
		}
	}

	getVersion(): bigint {
		return this.version;
	}

	getCreateTime(): bigint {
		return this.createTime;
	}

	getDescription(): string {
		return this.description;
	}

	isSystemDictionary(): boolean {
		return DictionaryVersion.isSystemDictionary(this.version);
	}

	isUserDictionary(): boolean {
		return DictionaryVersion.isUserDictionary(this.version);
	}

	storageSize(): number {
		return DictionaryHeader.STORAGE_SIZE;
	}

	private readInt64(offset: number, bytes: Uint8Array): bigint {
		let result = 0n;
		for (let i = 0; i < 8; i++) {
			const byte = BigInt(bytes[offset + i]! & 0xff);
			result |= byte << BigInt(i * 8);
		}
		return result;
	}

	toBytes(): Uint8Array {
		const output = new Uint8Array(DictionaryHeader.STORAGE_SIZE);
		const encoder = new TextEncoder();

		for (let i = 0; i < 8; i++) {
			output[i] = Number((this.version >> BigInt(i * 8)) & 0xffn);
		}
		for (let i = 0; i < 8; i++) {
			output[8 + i] = Number((this.createTime >> BigInt(i * 8)) & 0xffn);
		}

		const encoded = encoder.encode(this.description);
		if (encoded.length > DictionaryHeader.DESCRIPTION_SIZE) {
			throw new Error('description is too long');
		}

		output.set(encoded, 16);

		return output;
	}
}
