import type { Part } from '../dictionary-build/dicBuilder.js';

export interface BuildStatsData {
	inputs: Part[];
	outputs: Part[];
}

export class BuildStatsFormatter {
	private readonly stats: BuildStatsData;

	constructor(stats: BuildStatsData) {
		this.stats = stats;
	}

	toConsole(): string {
		const lines: string[] = ['=== Build Statistics ===', ''];

		lines.push('Input Files:');
		if (this.stats.inputs.length === 0) {
			lines.push('  (none)');
		} else {
			for (const input of this.stats.inputs) {
				const timeMs = input.time.toFixed(2);
				lines.push(`  ${input.name}: ${timeMs}ms, ${input.size} entries`);
			}
		}
		lines.push('');

		lines.push('Output Parts:');
		if (this.stats.outputs.length === 0) {
			lines.push('  (none)');
		} else {
			for (const output of this.stats.outputs) {
				const timeMs = output.time.toFixed(2);
				lines.push(`  ${output.name}: ${timeMs}ms, ${output.size} bytes`);
			}
		}
		lines.push('');

		const totalInputTime = this.stats.inputs.reduce(
			(sum, i) => sum + i.time,
			0,
		);
		const totalOutputSize = this.stats.outputs.reduce(
			(sum, o) => sum + o.size,
			0,
		);
		lines.push(`Total input time: ${totalInputTime.toFixed(2)}ms`);
		lines.push(`Total output size: ${totalOutputSize} bytes`);

		return lines.join('\n');
	}

	toJSON(): string {
		return JSON.stringify(
			{
				inputs: this.stats.inputs.map((i) => ({
					name: i.name,
					time_ms: i.time,
					entries: i.size,
				})),
				outputs: this.stats.outputs.map((o) => ({
					name: o.name,
					time_ms: o.time,
					bytes: o.size,
				})),
			},
			null,
			2,
		);
	}

	toCSV(): string {
		const lines: string[] = [];

		lines.push('type,name,time_ms,size');
		for (const input of this.stats.inputs) {
			lines.push(
				`input,"${input.name}",${input.time.toFixed(3)},${input.size}`,
			);
		}
		for (const output of this.stats.outputs) {
			lines.push(
				`output,"${output.name}",${output.time.toFixed(3)},${output.size}`,
			);
		}

		return lines.join('\n');
	}
}

export function formatBuildStats(
	stats: BuildStatsData,
	format: 'console' | 'json' | 'csv' = 'console',
): string {
	const formatter = new BuildStatsFormatter(stats);
	switch (format) {
		case 'console':
			return formatter.toConsole();
		case 'json':
			return formatter.toJSON();
		case 'csv':
			return formatter.toCSV();
		default:
			return formatter.toConsole();
	}
}
