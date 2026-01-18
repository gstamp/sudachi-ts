import type { InputTextBuilder } from '../../core/inputTextBuilder.js';
import type { Grammar } from '../../dictionary/grammar.js';
import { Plugin } from '../base.js';

export abstract class InputTextPlugin extends Plugin {
	setUp(_grammar: Grammar): void {}

	abstract rewrite(builder: InputTextBuilder): void;
}
