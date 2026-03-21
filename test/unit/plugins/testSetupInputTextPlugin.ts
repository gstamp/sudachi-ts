import { InputTextPlugin } from '../../../src/plugins/inputText/base.js';

export default class TestSetupInputTextPlugin extends InputTextPlugin {
	setUpCalled = false;

	setUp(): void {
		this.setUpCalled = true;
	}

	rewrite(): void {}
}
