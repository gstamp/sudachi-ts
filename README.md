# Sudachi-TS

TypeScript port of [Sudachi](https://github.com/WorksApplications/Sudachi) Japanese morphological analyzer.

<div style="border-left:4px solid #36c; padding:0.5em 1em; background:#f1f8ff; border-radius:4px;"> <strong>Note:</strong> This project is still in early development and may not be fully functional or stable. Use at your own risk. </div>

<strong>Warning:</strong> Dictionary files are required for Sudachi-TS to function. Please download them from the Sudachi releases page before using this library.

## Features

- **Full Tokenization Support**: A/B/C split modes for different granularities
- **Binary Dictionary Compatibility**: Load and use pre-built Sudachi dictionaries
- **Dynamic Plugin System**: Extensible architecture with runtime plugin loading
- **Dictionary Building**: Complete CSV to binary dictionary conversion
- **Sentence Detection**: Multi-sentence text processing
- **UTF-8 Handling**: Proper Japanese text normalization and character encoding
- **POS Matching**: Flexible part-of-speech filtering and matching

## Requirements

- **Node.js**: >= 18.0.0
- **TypeScript**: >= 5.0.0 (peer dependency)

## Installation

```bash
npm install sudachi-ts
```

Or using yarn:

```bash
yarn add sudachi-ts
```

## Quick Start

```typescript
import { Dictionary, SplitMode } from 'sudachi-ts';
import { BinaryDictionary } from 'sudachi-ts/dictionary/binaryDictionary.js';

// Load dictionary
const dict = await BinaryDictionary.loadSystem('./path/to/system.dic');

// Create tokenizer
const tokenizer = dict.create();

// Tokenize text
const result = tokenizer.tokenize('東京都に行きました。');

// Access morphemes
for (const morpheme of result) {
  console.log(morpheme.surface()); // Surface form
  console.log(morpheme.readingForm()); // Reading
  console.log(morpheme.partOfSpeech()); // POS tags
  console.log(morpheme.normalizedForm()); // Normalized form
}

// Use different split modes
const modeAResult = tokenizer.tokenize(SplitMode.A, '京都に行きました');
const modeBResult = tokenizer.tokenize(SplitMode.B, '京都に行きました');
const modeCResult = tokenizer.tokenize(SplitMode.C, '京都に行きました');

// Clean up
await dict.close();
```

## Dictionary Files

**Important**: This package does not include dictionary files. You need to provide your own:

- **System Dictionary**: Download from [Sudachi releases](https://github.com/WorksApplications/Sudachi/releases)
- **User Dictionary**: Build your own using the CLI tools or provide existing `.dic` files

Example dictionary paths:
- `system_core.dic` - Core system dictionary
- `system_full.dic` - Full system dictionary
- `user.dic` - User dictionary (optional)

## Split Modes

Sudachi provides three tokenization modes:

- **Mode A**: Shortest possible segmentation (most granular)
- **Mode B**: Medium segmentation (balanced)
- **Mode C**: Longest possible segmentation (least granular)

Example with "京都に行きました":

```
Mode A: 京都|に|行き|まし|た
Mode B: 京都|に|行きました
Mode C: 京都|に行きました
```

## Configuration

Load configuration from a JSON file:

```typescript
import { loadConfig } from 'sudachi-ts/config/config.js';
import { Dictionary } from 'sudachi-ts/core/dictionary.js';

const config = await loadConfig('./sudachi.json');
const dict = Dictionary.create();
```

Example `sudachi.json`:

```json
{
  "systemDict": "system_core.dic",
  "userDicts": ["user.dic"],
  "characterDefinitionFile": "char.def",
  "plugins": [
    {
      "className": "sudachi-ts/plugins/inputText/defaultInputTextPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ]
}
```

For non-absolute file references in config (dictionary files, plugin module paths,
and built-in plugin file settings), Sudachi-TS tries paths relative to the config
file first, then relative to the current working directory.

By default, Sudachi-TS enables a built-in compound-particle lexicon
(`"enableDefaultCompoundParticles": true`) so forms such as `かも`, `のか`,
and `だから` are tokenized as single morphemes. Set it to `false` to disable:

```json
{
  "enableDefaultCompoundParticles": false
}
```

## Working with Morphemes

Access detailed morpheme information:

```typescript
const morpheme = result[0];

// Surface form
console.log(morpheme.surface());

// Word forms
console.log(morpheme.dictionaryForm()); // Dictionary form
console.log(morpheme.normalizedForm()); // Normalized form
console.log(morpheme.readingForm()); // Reading form

// Part of speech
console.log(morpheme.partOfSpeech()); // e.g., ["名詞", "固有名詞", "地名", "一般"]

// Word ID and dictionary
console.log(morpheme.wordId());
console.log(morpheme.dictionaryId());

// Morpheme bounds
console.log(morpheme.begin());
console.log(morpheme.end());
console.log(morpheme.length());

// Check morpheme properties
console.log(morpheme.isOov()); // True if out-of-vocabulary
```

## Splitting Morphemes

Use the split method to change granularity:

```typescript
const result = tokenizer.tokenize(SplitMode.A, '東京都に行きました');
const morpheme = result[0]; // "東京都"

// Split to different modes
const modeAList = morpheme.split(SplitMode.A);
const modeBList = morpheme.split(SplitMode.B);
const modeCList = morpheme.split(SplitMode.C);
```

## Sentence Detection

Process multi-sentence text:

```typescript
import { SentenceDetector } from 'sudachi-ts/sentdetect/sentenceDetector.js';

const sentences = tokenizer.tokenizeSentences('東京都は日本の首都です。大阪は商業都市です。');

for (const sentence of sentences) {
  console.log('--- Sentence ---');
  for (const morpheme of sentence) {
    console.log(morpheme.surface());
  }
}
```

`tokenizeSentences(...)` treats quoted dialogue endings (for example `「...！」` and
`「...。」`) as sentence boundaries and skips leading inter-sentence whitespace such
as newlines before tokenization.

Lazy sentence processing for streaming:

```typescript
async function* streamSentences(textStream: ReadableStream<string>) {
  for await (const sentences of tokenizer.lazyTokenizeSentences(textStream)) {
    for (const morphemes of sentences) {
      yield morphemes;
    }
  }
}
```

## Part of Speech Matching

Filter morphemes by POS:

```typescript
import { Dictionary } from 'sudachi-ts/core/dictionary.js';

const dict = await Dictionary.loadSystem();

// Create matcher for specific POS
const nounMatcher = dict.posMatcher(pos => pos[0] === '名詞');

// Find words matching POS pattern
const result = tokenizer.tokenize('東京都に行きました');
for (const morpheme of result) {
  if (nounMatcher.matches(morpheme.partOfSpeech())) {
    console.log('Noun:', morpheme.surface());
  }
}

// Create matcher from partial POS list
const properNounMatcher = dict.posMatcherFromList([
  ['名詞', '固有名詞', '*', '*']
]);
```

## Plugin Development

Create custom plugins to extend functionality:

```typescript
import { InputTextPlugin } from 'sudachi-ts/plugins/index.js';

export class MyCustomPlugin implements InputTextPlugin {
  setSettings(settings: Settings): void {
    // Configure plugin
  }

  rewrite(input: InputText): InputText {
    // Transform input text before tokenization
    return input;
  }
}
```

Load plugins dynamically:

```typescript
import { PluginLoader } from 'sudachi-ts/plugins/loader.js';

const loader = new PluginLoader();
const plugin = await loader.loadInputTextPlugin(
  './myCustomPlugin.js',
  new Settings({ option: 'value' })
);
```

See [PLUGINS.md](./PLUGINS.md) for detailed plugin development guide.

Quick local comparison for the PoC token chunker plugin:

```bash
npm exec tsx examples/token-chunker-plugin.ts /path/to/system.dic "東京大学"
```

This example prints each token as `surface/reading` so the chunking impact on
readings is visible in the baseline vs plugin outputs.
`TokenChunkerPlugin` is designed and validated against the full Sudachi system
dictionary (`system_full.dic` / `system.dic`), so prefer full-dictionary checks
when adding or tuning chunk rules.
`TokenChunkerPlugin` requires `enableDefaultCompoundParticles: true`. Dictionary
creation throws an error when this plugin is configured with default compound
particles disabled.
`TokenChunkerPlugin` is intended for `SplitMode.C` tokenization; calling
`tokenize(SplitMode.A, ...)` or `tokenize(SplitMode.B, ...)` with this plugin
enabled throws an error.

## Dictionary Building

Build binary dictionaries from CSV source:

```typescript
import { SystemDictionaryBuilder } from 'sudachi-ts/dictionary-build/dicBuilder.js';

const builder = new SystemDictionaryBuilder();

// Add lexicon entries from CSV
await builder.buildFromCsv('./lexicon.csv');

// Write binary dictionary
await builder.write('./output.dic');
```

CSV format:

```
東京都,4,4,3816,京都,-1,-1,東京都,名詞,固有名詞,地名,一般,*,*,東京都,トウキョウト,東京
```

## Debug and Inspection

Dump internal structures for debugging:

```typescript
// Set output stream for lattice dumps
const output = new WritableStream({
  write(chunk) {
    console.log(chunk);
  }
});
tokenizer.setDumpOutput(output);

// Get lattice as JSON
const latticeJson = tokenizer.dumpInternalStructures('東京都');
console.log(latticeJson);
```

## API Reference

See [API.md](./API.md) for complete API documentation.

## Configuration

See [CONFIG.md](./CONFIG.md) for detailed configuration options.

## Development

```bash
# Clone repository
git clone https://github.com/your-org/sudachi-ts.git
cd sudachi-ts

# Install dependencies
npm install

# Type check
npm run typecheck

# Run tests
npm test

# Lint
npm run check:fix
```

## Architecture

```
sudachi-ts/
├── core/              # Tokenization engine
│   ├── tokenizer.ts   # Tokenizer interface and SplitMode
│   ├── dictionary.ts  # Dictionary and tokenizer factory
│   ├── morpheme.ts    # Morpheme interface and implementation
│   ├── lattice.ts     # Lattice graph implementation
│   └── inputText.ts   # Input text handling
├── dictionary/        # Dictionary system
│   ├── binaryDictionary.ts    # Binary dictionary loading
│   ├── grammar.ts             # Grammar and POS data
│   ├── lexicon.ts             # Lexicon interface
│   ├── doubleArrayLexicon.ts  # Double array trie lookup
│   └── characterCategory.ts   # Character categories
├── plugins/          # Plugin system
│   ├── base.ts       # Plugin base classes
│   ├── inputText/    # Input text plugins
│   ├── oov/          # OOV provider plugins
│   ├── pathRewrite/  # Path rewrite plugins
│   ├── connection/   # Connection edit plugins
│   └── loader.ts     # Dynamic plugin loader
├── dictionary-build/ # Dictionary builder
│   ├── csvLexicon.ts         # CSV parsing
│   ├── doubleArrayBuilder.ts # Double array construction
│   ├── connectionMatrix.ts   # Connection cost matrix
│   └── dicBuilder.ts         # Builder API
├── sentdetect/       # Sentence detection
│   └── sentenceDetector.ts
├── utils/           # Utilities
│   ├── wordId.ts    # Word ID encoding
│   ├── wordMask.ts  # OOV tracking
│   └── numericParser.ts # Japanese numeral parsing
└── config/          # Configuration
    ├── config.ts    # Config management
    ├── settings.ts  # Settings parsing
    └── pathAnchor.ts # Path resolution
```

## License

Apache License 2.0

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## References

- [Original Sudachi (Java)](../sudachi-java/)
- [SudachiPy](https://github.com/WorksApplications/SudachiPy)
- [Sudachi Documentation](https://github.com/WorksApplications/Sudachi/blob/develop/docs/sudachi.md)
