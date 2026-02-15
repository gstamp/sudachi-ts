# API Reference

Complete API documentation for Sudachi-TS.

## Core

### Dictionary

Main dictionary and tokenizer factory class.

```typescript
class Dictionary {
  constructor(grammar: Grammar, lexicon: Lexicon)
  create(): Tokenizer
  close(): Promise<void>
  getPartOfSpeechSize(): number
  getPartOfSpeechString(posId: number): string[]
  posMatcher(predicate: (pos: string[]) => boolean): PosMatcher
  posMatcherFromList(posList: Iterable<PartialPOS>): PosMatcher
}
```

#### Methods

**`create()`**
Creates a new tokenizer instance.

```typescript
const tokenizer = dict.create();
```

**`close()`**
Closes the dictionary and releases resources.

```typescript
await dict.close();
```

**`getPartOfSpeechSize()`**
Returns the number of part-of-speech definitions in the dictionary.

**`getPartOfSpeechString(posId: number)`**
Returns the part-of-speech string for a given POS ID.

```typescript
const pos = dict.getPartOfSpeechString(5);
// ["名詞", "普通名詞", "一般", "*"]
```

**`posMatcher(predicate)`**
Creates a POS matcher from a predicate function.

```typescript
const nounMatcher = dict.posMatcher(pos => pos[0] === '名詞');
```

**`posMatcherFromList(posList)`**
Creates a POS matcher from a list of partial POS patterns.

```typescript
const matcher = dict.posMatcherFromList([
  ['名詞', '固有名詞', '*', '*'],
  ['名詞', '普通名詞', '一般', '*']
]);
```

### Tokenizer

Interface for tokenization operations.

```typescript
interface Tokenizer {
  tokenize(mode: SplitMode, text: string): MorphemeList
  tokenize(text: string): MorphemeList
  tokenizeSentences(mode: SplitMode, text: string): Iterable<MorphemeList>
  tokenizeSentences(text: string): Iterable<MorphemeList>
  lazyTokenizeSentences(mode: SplitMode, input: ReadableStream<string> | AsyncIterable<string>): AsyncIterable<Morpheme[]>
  lazyTokenizeSentences(input: ReadableStream<string> | AsyncIterable<string>): AsyncIterable<Morpheme[]>
  setDumpOutput(output: WritableStream<string>): void
  dumpInternalStructures(text: string): string
}
```

#### Methods

**`tokenize(mode, text)`**
Tokenizes text using the specified split mode.

```typescript
const result = tokenizer.tokenize(SplitMode.A, '東京都に行きました');
```

**`tokenize(text)`**
Tokenizes text using the default mode.

```typescript
const result = tokenizer.tokenize('東京都に行きました');
```

**`tokenizeSentences(mode, text)`**
Tokenizes multiple sentences.

```typescript
for (const sentence of tokenizer.tokenizeSentences(SplitMode.A, text)) {
  for (const morpheme of sentence) {
    console.log(morpheme.surface());
  }
}
```

**`lazyTokenizeSentences(mode, input)`**
Lazily tokenizes sentences from a stream.

```typescript
const stream = new ReadableStream({ ... });
for await (const sentences of tokenizer.lazyTokenizeSentences(stream)) {
  for (const morpheme of sentences) {
    console.log(morpheme.surface());
  }
}
```

**`setDumpOutput(output)`**
Sets output stream for lattice dumps.

```typescript
const output = new WritableStream({
  write(chunk) { console.log(chunk); }
});
tokenizer.setDumpOutput(output);
```

**`dumpInternalStructures(text)`**
Returns lattice structure as JSON string.

```typescript
const lattice = tokenizer.dumpInternalStructures('東京都');
```

### SplitMode

Enumeration of tokenization modes.

```typescript
enum SplitMode {
  A,  // Shortest segmentation
  B,  // Medium segmentation
  C   // Longest segmentation
}
```

### Morpheme

Interface for morpheme information.

```typescript
interface Morpheme {
  surface(): string
  partOfSpeech(): string[]
  partOfSpeechId(): number
  dictionaryForm(): string
  normalizedForm(): string
  readingForm(): string
  morphemeId(): number
  wordId(): number
  dictionaryId(): number
  synonymGids(): number[]
  cost(): number
  begin(): number
  end(): number
  length(): number
  isOov(): boolean
  split(mode: SplitMode): MorphemeList
  getA(): MorphemeList
  getB(): MorphemeList
  getC(): MorphemeList
}
```

#### Methods

**`surface()`**
Returns the surface form of the morpheme.

```typescript
console.log(morpheme.surface()); // "東京都"
```

**`partOfSpeech()`**
Returns the part-of-speech tags.

```typescript
console.log(morpheme.partOfSpeech()); // ["名詞", "固有名詞", "地名", "一般"]
```

**`partOfSpeechId()`**
Returns the part-of-speech ID.

**`dictionaryForm()`**
Returns the dictionary (lemma) form.

```typescript
console.log(morpheme.dictionaryForm()); // "東京都"
```

**`normalizedForm()`**
Returns the normalized form.

```typescript
console.log(morpheme.normalizedForm()); // "東京都"
```

**`readingForm()`**
Returns the reading (katakana) form.

```typescript
console.log(morpheme.readingForm()); // "トウキョウト"
```

**`morphemeId()`**
Returns the morpheme ID.

**`wordId()`**
Returns the word ID.

```typescript
console.log(morpheme.wordId()); // 12345678
```

**`dictionaryId()`**
Returns the dictionary ID.

```typescript
console.log(morpheme.dictionaryId()); // 0 for system dict
```

**`synonymGids()`**
Returns synonym group IDs.

```typescript
console.log(morpheme.synonymGids()); // [1, 2, 3]
```

**`cost()`**
Returns the cost value.

```typescript
console.log(morpheme.cost()); // 5000
```

**`begin()`**
Returns the byte offset of the beginning.

**`end()`**
Returns the byte offset of the end.

**`length()`**
Returns the byte length.

```typescript
console.log(morpheme.length()); // 9
```

**`isOov()`**
Returns true if the morpheme is out-of-vocabulary.

```typescript
if (morpheme.isOov()) {
  console.log('Unknown word');
}
```

**`split(mode)`**
Splits the morpheme using a different mode.

```typescript
const modeBList = morpheme.split(SplitMode.B);
```

**`getA()`, `getB()`, `getC()`**
Shorthand methods for splitting.

```typescript
const modeA = morpheme.getA();
const modeB = morpheme.getB();
const modeC = morpheme.getC();
```

### MorphemeImpl

Implementation of Morpheme interface.

```typescript
class MorphemeImpl extends Morpheme {
  constructor(morphemeData: MorphemeData)
}
```

### MorphemeList

List of morphemes with lazy evaluation.

```typescript
class MorphemeList {
  constructor(input: InputText, morphemes: Morpheme[])
  size(): number
  toList(): Morpheme[]
  [Symbol.iterator](): Iterator<Morpheme>
  split(mode: SplitMode): MorphemeList[]
}
```

#### Methods

**`size()`**
Returns the number of morphemes.

**`toList()`**
Returns all morphemes as an array.

**`[Symbol.iterator]()`**
Iterates over morphemes.

```typescript
for (const morpheme of morphemeList) {
  console.log(morpheme.surface());
}
```

**`split(mode)`**
Splits all morphemes in the list.

### Lattice

Interface for the lattice graph.

```typescript
interface Lattice {
  clear(): void
  insert(node: LatticeNode): void
  connect(node: LatticeNode): void
  getEnd(node: LatticeNode): LatticeNode[] | null
  getBestPath(): LatticeNode[]
}
```

### LatticeNode

Interface for a node in the lattice.

```typescript
interface LatticeNode {
  wordId: number
  leftId: number
  rightId: number
  cost: number
  surface: string
  begin: number
  end: number
  rightEdges: LatticeNode[]
  extraCosts: number[]
}
```

### LatticeImpl

Implementation of Lattice interface.

### LatticeNodeImpl

Implementation of LatticeNode interface.

### InputText

Interface for input text handling.

```typescript
interface InputText {
  getOriginalText(): string
  getModifiedText(): string
  getText(index: number, length: number): string
  getWordId(index: number): number
  setWordId(index: number, wordId: number): void
  getCodePointsOffset(): number
  getOffsetCodePoints(offset: number): number
}
```

### InputTextBuilder

Interface for building InputText.

```typescript
interface InputTextBuilder {
  build(text: string): InputText
}
```

### UTF8InputText

UTF-8 implementation of InputText.

```typescript
class UTF8InputText implements InputText {
  constructor(text: string, bytePositions: number[], codePoints: number[])
}
```

### UTF8InputTextBuilder

Builder for UTF8InputText.

```typescript
class UTF8InputTextBuilder implements InputTextBuilder {
  build(text: string): UTF8InputText
}
```

### LatticeDump

Interface for lattice dump data.

```typescript
interface LatticeDump {
  nodes: LatticeNodeDump[]
}
```

### LatticeNodeDump

Interface for lattice node dump data.

```typescript
interface LatticeNodeDump {
  wordId: number
  surface: string
  begin: number
  end: number
  cost: number
  leftId: number
  rightId: number
  extraCosts: number[]
}
```

**`dumpLattice(lattice: Lattice, input: InputText): LatticeDump`**
Dumps lattice structure.

```typescript
const dump = dumpLattice(lattice, input);
console.log(JSON.stringify(dump, null, 2));
```

## Dictionary

### BinaryDictionary

Binary dictionary loader.

```typescript
class BinaryDictionary {
  static fromFile(filePath: string): Promise<BinaryDictionary>
  constructor(
    header: DictionaryHeader,
    grammar: Grammar,
    lexicon: Lexicon,
    userId: number
  )
  create(): Tokenizer
  close(): Promise<void>
}
```

#### Static Methods

**`fromFile(filePath)`**
Loads a binary dictionary from file.

```typescript
const dict = await BinaryDictionary.fromFile('./system.dic');
```

#### Methods

**`create()`**
Creates a tokenizer from the dictionary.

**`close()`**
Closes the dictionary.

### Grammar

Interface for grammar data.

```typescript
interface Grammar {
  getPartOfSpeechSize(): number
  getPartOfSpeechId(pos: string[]): number
  getPartOfSpeechString(posId: number): string[]
  getConnectCost(leftId: number, rightId: number): number
  setConnectCost(leftId: number, rightId: number, cost: number): void
  getStorageSize(): number
}
```

### GrammarImpl

Implementation of Grammar interface.

```typescript
class GrammarImpl implements Grammar {
  constructor(posList: string[][], connectTable: Uint16Array, systemSize: number)
}
```

### Connection

Connection cost matrix.

```typescript
class Connection {
  constructor(connectTable: Uint16Array)
  getCost(leftId: number, rightId: number): number
  setCost(leftId: number, rightId: number, cost: number): void
  getTable(): Uint16Array
}
```

### POS

Part-of-speech utilities.

```typescript
const DEPTH: number = 4;
const MAX_COMPONENT_LENGTH: number = 8;
```

### WordInfo

Word information data structure.

```typescript
class WordInfo {
  surface: string
  headWordLength: number
  posId: number
  normalizedForm: string
  dictionaryFormWordId: number
  dictionaryForm: string
  readingForm: string
  aUnitSplit: number[]
  bUnitSplit: number[]
  wordStructure: number[][]
  synonymGids: number[]
}
```

### PosMatcher

Matcher for part-of-speech patterns.

```typescript
class PosMatcher {
  constructor(posIds: number[], posStringGetter: (id: number) => string[])
  matches(pos: string[]): boolean
  get(pos: string[]): number | null
  size(): number
}
```

#### Methods

**`matches(pos)`**
Returns true if the POS matches.

```typescript
if (nounMatcher.matches(['名詞', '普通名詞', '一般', '*'])) {
  // matches
}
```

**`get(pos)`**
Returns the POS ID if matches, null otherwise.

### PartialPOS

Partial POS pattern for matching.

```typescript
class PartialPOS {
  constructor(components: (string | null)[])
  size(): number
  get(index: number): string | null
}
```

### CategoryType

Character category types.

```typescript
enum CategoryType {
  DEFAULT,
  ALPHA,
  GREEK,
  CYRILLIC,
  HIRAGANA,
  KATAKANA,
  KANJI,
  KANJINUMERIC,
  NUMERIC,
  SYMBOL,
  // ... more categories
}
```

### CharacterCategory

Character category definitions.

```typescript
class CharacterCategory {
  getCategory(codePoint: number): CategoryType
  getCategories(codePoint: number): CategoryType[]
}
```

### Lexicon

Interface for lexicon data.

```typescript
interface Lexicon {
  size(): number
  get(wordId: number): WordInfo
  getLeftId(wordId: number): number
  getRightId(wordId: number): number
  getCost(wordId: number): number
  lookup(word: string, offset: number): number[]
  getWordIds(text: string): number[]
}
```

### DoubleArrayLexicon

Double array trie-based lexicon.

```typescript
class DoubleArrayLexicon implements Lexicon {
  constructor(doubleArray: Int32Array, wordIdTable: WordIdTable, wordInfos: WordInfo[])
}
```

### DoubleArrayLookup

Double array trie lookup utilities.

### DictionaryHeader

Dictionary file header.

```typescript
class DictionaryHeader {
  version: number
  createTime: number
  dictionarySize: number
  storageSize: number
  description: string
  copyright: string
}
```

### WordIdTable

Table mapping word IDs to word info.

### WordParameterList

List of word parameters.

### WordInfoList

List of word information.

## Dictionary Building

### SystemDictionaryBuilder

Builder for system dictionaries.

```typescript
class SystemDictionaryBuilder {
  constructor()
  addLexicon(csvPath: string): Promise<void>
  build(): Promise<void>
  write(outputPath: string): Promise<void>
}
```

### UserDictionaryBuilder

Builder for user dictionaries.

```typescript
class UserDictionaryBuilder {
  constructor(systemDictionary: BinaryDictionary)
  addLexicon(csvPath: string): Promise<void>
  build(): Promise<void>
  write(outputPath: string): Promise<void>
}
```

### CsvLexicon

CSV lexicon parser.

### ConnectionMatrix

Connection cost matrix builder.

### PosTable

POS table builder.

### Index

Index builder for trie.

### DoubleArrayBuilder

Double array trie builder.

### DictionaryHeader

Dictionary header builder.

### DicBuffer

Buffer for dictionary building.

### Progress

Progress tracking for dictionary building.

### WriteDictionary

Dictionary writer.

## Plugins

### Plugin

Base plugin class.

```typescript
abstract class Plugin {
  abstract setSettings(settings: Settings): void
}
```

### InputTextPlugin

Interface for input text plugins.

```typescript
interface InputTextPlugin extends Plugin {
  rewrite(input: InputText): InputText
}
```

### OovProviderPlugin

Interface for OOV provider plugins.

```typescript
interface OovProviderPlugin extends Plugin {
  getOov(
    inputText: InputText,
    offset: number,
    hasPrevWord: boolean,
    posId: number,
    grammar: Grammar
  ): LatticeNode | null
}
```

### PathRewritePlugin

Interface for path rewrite plugins.

```typescript
interface PathRewritePlugin extends Plugin {
  rewrite(input: InputText, path: MorphemeList): MorphemeList | null
}
```

### EditConnectionCostPlugin

Interface for connection cost editing plugins.

```typescript
interface EditConnectionCostPlugin extends Plugin {
  edit(
    left: Morpheme | null,
    right: Morpheme,
    cost: number
  ): number | null
}
```

### MorphemeFormatterPlugin

Interface for morpheme formatter plugins.

```typescript
interface MorphemeFormatterPlugin extends Plugin {
  format(morpheme: Morpheme): string
}
```

### PluginLoader

Dynamic plugin loader.

```typescript
class PluginLoader {
  constructor(anchor?: PathAnchor)

  async loadInputTextPlugin(
    className: string,
    settings: Settings
  ): Promise<InputTextPlugin>

  async loadOovProviderPlugin(
    className: string,
    settings: Settings
  ): Promise<OovProviderPlugin>

  async loadPathRewritePlugin(
    className: string,
    settings: Settings
  ): Promise<PathRewritePlugin>

  async loadEditConnectionCostPlugin(
    className: string,
    settings: Settings
  ): Promise<EditConnectionCostPlugin>

  async loadMorphemeFormatterPlugin(
    className: string,
    settings: Settings
  ): Promise<MorphemeFormatterPlugin>
}
```

### LoadedPlugin

Type for loaded plugin.

```typescript
type LoadedPlugin<T> = T & { className: string };
```

## Sentence Detection

### SentenceDetector

Sentence boundary detection.

```typescript
class SentenceDetector {
  constructor(grammar: Grammar, limit: number = DEFAULT_LIMIT)
  detect(text: string): number[]
  detectStream(input: ReadableStream<string>): AsyncIterable<number>
}
```

#### Methods

**`detect(text)`**
Returns sentence boundary offsets.

```typescript
const detector = new SentenceDetector(grammar);
const boundaries = detector.detect('東京都は首都です。大阪は商業都市です。');
// [0, 8, 15]
```

**`detectStream(input)`**
Detects boundaries from a stream.

```typescript
const stream = new ReadableStream({ ... });
for await (const boundary of detector.detectStream(stream)) {
  console.log('Boundary at:', boundary);
}
```

### NonBreakChecker

Interface for non-break checker.

```typescript
interface NonBreakChecker {
  check(codePoint: number): boolean
}
```

### DEFAULT_LIMIT

Default sentence limit.

```typescript
const DEFAULT_LIMIT: number = 4096;
```

## Utilities

### Word ID Functions

```typescript
// Make word ID
make(dicId: number, wordId: number): number

// Make dictionary word ID
dic(wordId: number, dicId: number): number

// Get word ID component
word(wordId: number): number

// Dictionary ID mask
dicIdMask: number

// Apply mask to word ID
applyMask(wordId: number, mask: number): number

// Maximum word ID
MAX_WORD_ID: number

// Maximum dictionary ID
MAX_DIC_ID: number
```

### Word Mask Functions

```typescript
// Get nth bit
nth(n: number): number

// Add nth bit
addNth(mask: number, n: number): number

// Check if nth bit is set
hasNth(mask: number, n: number): boolean

// Maximum length
MAX_LENGTH: number
```

### StringUtil

String utility functions.

```typescript
// Parse UTF-8 code point
parseUtf8CodePoint(text: string, offset: number): { codePoint: number; byteLength: number }

// Count code points
countCodePoints(text: string): number

// Get code point at position
getCodePointAt(text: string, index: number): number
```

### NumericParser

Japanese numeric parser.

```typescript
class NumericParser {
  parse(text: string): number | null
}
```

## Configuration

### Config

Configuration manager.

```typescript
class Config {
  static empty(): Config
  static async fromFile(filePath: string): Promise<Config>
  static parse(json: string): Config
  static async defaultConfig(): Promise<Config>
  getSettings(): Settings
  getAnchor(): PathAnchor
  setAnchor(anchor: PathAnchor): Config
  withFallback(other: Config): Config
  anchoredWith(anchor: PathAnchor): Config
  getString(key: string, defaultValue?: string): string | null
  getInt(key: string, defaultValue?: number): number
  getBoolean(key: string, defaultValue?: boolean): boolean
  getStringList(key: string): string[]
  getIntList(key: string): number[]
  getPlugins<T>(key: string): { className: string; settings: Settings }[] | null
}
```

#### Static Methods

**`empty()`**
Creates an empty configuration.

**`fromFile(filePath)`**
Loads configuration from file.

When a referenced path is not absolute, resolution tries:
1) the config file directory, then
2) the current working directory.

```typescript
const config = await Config.fromFile('./sudachi.json');
```

**`parse(json)`**
Parses configuration from JSON string.

```typescript
const config = Config.parse('{ "systemDict": "system.dic" }');
```

**`defaultConfig()`**
Loads default configuration from `./sudachi.json`.

```typescript
const config = await Config.defaultConfig();
```

#### Methods

**`getString(key, defaultValue)`**
Gets a string value.

**`getInt(key, defaultValue)`**
Gets an integer value.

**`getBoolean(key, defaultValue)`**
Gets a boolean value.

**`getStringList(key)`**
Gets a list of strings.

**`getIntList(key)`**
Gets a list of integers.

**`getPlugins(key)`**
Gets plugin configurations.

```typescript
const plugins = config.getPlugins('inputTextPlugins');
```

### Settings

Settings container.

```typescript
class Settings {
  static empty(): Settings
  static parse(json: string, basePathOrAnchor?: string | PathAnchor): Settings
  getAnchor(): PathAnchor
  withAnchor(anchor: PathAnchor): Settings
  withFallback(other: Settings): Settings
  getString(key: string, defaultValue?: string): string | null
  getPath(key: string, defaultValue?: string): Promise<string | null>
  getInt(key: string, defaultValue?: number): number
  getBoolean(key: string, defaultValue?: boolean): boolean
  getStringList(key: string): string[]
  getIntList(key: string): number[]
  getPlugins<T>(key: string): { className: string; settings: Settings }[] | null
}
```

### PathAnchor

Path resolution anchor.

```typescript
class PathAnchor {
  static none(): PathAnchor
  static filesystem(baseDir: string): PathAnchor
  resolve(relativePath: string): Promise<string>
  andThen(other: PathAnchor): PathAnchor
}
```

#### Static Methods

**`none()`**
No anchor (use current directory).

**`filesystem(baseDir)`**
File system directory anchor.

```typescript
const anchor = PathAnchor.filesystem('/path/to/dict');
```

#### Methods

**`resolve(relativePath)`**
Resolves a relative path.

```typescript
const fullPath = anchor.resolve('system.dic');
```

**`andThen(other)`**
Combines with another anchor.

### loadConfig

Helper function to load configuration.

```typescript
async function loadConfig(configPath?: string): Promise<Config>
```

```typescript
const config = await loadConfig('./custom.json');
```

## Examples

### Basic Tokenization

```typescript
import { Dictionary, SplitMode } from 'sudachi-ts';
import { BinaryDictionary } from 'sudachi-ts/dictionary/binaryDictionary.js';

const dict = await BinaryDictionary.fromFile('./system.dic');
const tokenizer = dict.create();

const result = tokenizer.tokenize('東京都に行きました');
for (const morpheme of result) {
  console.log(morpheme.surface());
}

await dict.close();
```

### Using Configuration

```typescript
import { loadConfig } from 'sudachi-ts/config/config.js';
import { Dictionary } from 'sudachi-ts/core/dictionary.js';

const config = await loadConfig();
const dict = await Dictionary.fromConfig(config);
```

### POS Filtering

```typescript
import { Dictionary } from 'sudachi-ts/core/dictionary.js';

const dict = await Dictionary.loadSystem();
const nounMatcher = dict.posMatcher(pos => pos[0] === '名詞');

const tokenizer = dict.create();
const result = tokenizer.tokenize('東京都に行きました');

for (const morpheme of result) {
  if (nounMatcher.matches(morpheme.partOfSpeech())) {
    console.log('Noun:', morpheme.surface());
  }
}
```

### Lazy Tokenization

```typescript
const stream = new ReadableStream({
  async start(controller) {
    for await (const sentence of sentences) {
      controller.enqueue(sentence);
    }
    controller.close();
  }
});

for await (const morphemes of tokenizer.lazyTokenizeSentences(stream)) {
  for (const morpheme of morphemes) {
    console.log(morpheme.surface());
  }
}
```
