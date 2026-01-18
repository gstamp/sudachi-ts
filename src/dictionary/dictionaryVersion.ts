// biome-ignore lint/complexity/noStaticOnlyClass: This class is part of the public API and changing it would be a breaking change
export class DictionaryVersion {
	static readonly SYSTEM_DICT_VERSION_1: bigint = 0x7366d3f18bd111e7n;
	static readonly SYSTEM_DICT_VERSION_2: bigint = 0xce9f011a92394434n;
	static readonly USER_DICT_VERSION_1: bigint = 0xa50f31188bd211e7n;
	static readonly USER_DICT_VERSION_2: bigint = 0x9fdeb5a90168d868n;
	static readonly USER_DICT_VERSION_3: bigint = 0xca9811756ff64fb0n;

	static isSystemDictionary(version: bigint): boolean {
		return (
			version === DictionaryVersion.SYSTEM_DICT_VERSION_1 ||
			version === DictionaryVersion.SYSTEM_DICT_VERSION_2
		);
	}

	static isUserDictionary(version: bigint): boolean {
		return (
			version === DictionaryVersion.USER_DICT_VERSION_1 ||
			version === DictionaryVersion.USER_DICT_VERSION_2 ||
			version === DictionaryVersion.USER_DICT_VERSION_3
		);
	}

	static hasGrammar(version: bigint): boolean {
		return (
			DictionaryVersion.isSystemDictionary(version) ||
			version === DictionaryVersion.USER_DICT_VERSION_2 ||
			version === DictionaryVersion.USER_DICT_VERSION_3
		);
	}

	static hasSynonymGroupIds(version: bigint): boolean {
		return (
			version === DictionaryVersion.SYSTEM_DICT_VERSION_2 ||
			version === DictionaryVersion.USER_DICT_VERSION_3
		);
	}
}
