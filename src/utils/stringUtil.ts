import { readFileSync } from 'node:fs';

export async function readFully(path: string): Promise<string> {
	return readFileSync(path, 'utf-8');
}

export async function readAllBytes(path: string): Promise<Uint8Array> {
	const buffer = readFileSync(path);
	return new Uint8Array(buffer);
}

export function stringToBytes(str: string): Uint8Array {
	return new TextEncoder().encode(str);
}

export function bytesToString(bytes: Uint8Array): string {
	return new TextDecoder().decode(bytes);
}

export function createDataView(bytes: Uint8Array): DataView {
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
