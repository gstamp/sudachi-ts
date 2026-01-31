import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

export abstract class PathAnchor {
	static none(): PathAnchor {
		return NoneAnchor.INSTANCE;
	}

	static filesystem(basePath: string): PathAnchor {
		return new FilesystemAnchor(basePath);
	}

	static resolvePath(part: string): string {
		return part;
	}

	async resolve(part: string): Promise<string> {
		return PathAnchor.resolvePath(part);
	}

	async exists(path: string): Promise<boolean> {
		try {
			await readFile(path, { flag: 'r' });
			return true;
		} catch {
			return false;
		}
	}

	andThen(other: PathAnchor): PathAnchor {
		if (this === other) {
			return this;
		}
		return new ChainAnchor(this, other);
	}

	async lookupClass(name: string): Promise<unknown> {
		const module = await import(name);
		return module.default || module;
	}
}

class NoneAnchor extends PathAnchor {
	static INSTANCE = new NoneAnchor();

	private constructor() {
		super();
	}

	override toString(): string {
		return 'None{}';
	}
}

class FilesystemAnchor extends PathAnchor {
	constructor(private readonly basePath: string) {
		super();
	}

	override async resolve(part: string): Promise<string> {
		if (isAbsolute(part)) {
			return part;
		}
		return join(this.basePath, part);
	}

	override async exists(path: string): Promise<boolean> {
		try {
			await readFile(path, { flag: 'r' });
			return true;
		} catch {
			return false;
		}
	}

	override toString(): string {
		return `Filesystem{base=${this.basePath}}`;
	}
}

class ChainAnchor extends PathAnchor {
	private readonly children: PathAnchor[] = [];

	constructor(...items: PathAnchor[]) {
		super();
		for (const item of items) {
			if (item instanceof ChainAnchor) {
				const chain = item as ChainAnchor;
				for (const child of chain.children) {
					this.add(child);
				}
			} else {
				this.add(item);
			}
		}
	}

	private add(item: PathAnchor): void {
		if (!this.children.includes(item)) {
			this.children.push(item);
		}
	}

	override async resolve(part: string): Promise<string> {
		for (const p of this.children) {
			const path = await p.resolve(part);
			if (await p.exists(path)) {
				return path;
			}
		}
		return (await this.children[0]?.resolve(part)) ?? part;
	}

	override async exists(path: string): Promise<boolean> {
		for (const child of this.children) {
			if (await child.exists(path)) {
				return true;
			}
		}
		return false;
	}

	override async lookupClass(name: string): Promise<unknown> {
		for (const child of this.children) {
			try {
				return await child.lookupClass(name);
			} catch {}
		}
		throw new Error(`Class not found: ${name}`);
	}

	override toString(): string {
		return `[${this.children.map((a) => a.toString()).join(', ')}]`;
	}
}
