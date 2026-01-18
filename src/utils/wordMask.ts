export const MAX_LENGTH = 63;

export function addNth(positions: number, pos: number): number {
	return positions | nth(pos);
}

export function nth(position: number): number {
	if (position <= 0) {
		throw new RangeError(`position must be positive, got: ${position}`);
	}
	const fixedPosition = Math.min(position - 1, MAX_LENGTH);
	return 1 << fixedPosition;
}

export function hasNth(positions: number, position: number): boolean {
	return (positions & nth(position)) !== 0;
}
