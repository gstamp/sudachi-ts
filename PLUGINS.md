# Plugin Development Guide

Sudachi-TS provides a flexible plugin system that allows you to extend and customize tokenization behavior at various stages of the processing pipeline.

## Plugin Types

There are five main plugin interfaces:

1. **InputTextPlugin** - Transform input text before tokenization
2. **OovProviderPlugin** - Handle out-of-vocabulary (OOV) words
3. **PathRewritePlugin** - Rewrite segmentation paths
4. **EditConnectionCostPlugin** - Modify connection costs between morphemes
5. **MorphemeFormatterPlugin** - Format morpheme output

## Plugin Base Class

All plugins extend the base `Plugin` class:

```typescript
import { Plugin, Settings } from 'sudachi-ts/plugins/index.js';

export class MyPlugin extends Plugin {
  override setSettings(settings: Settings): void {
    // Access plugin settings
    const mySetting = settings.getString('mySetting', 'default');
  }
}
```

## InputTextPlugin

Input text plugins transform the input before tokenization begins. This is useful for:

- Text normalization
- Character replacement
- Preprocessing operations

### Example: Normalization Plugin

```typescript
import { InputTextPlugin } from 'sudachi-ts/plugins/index.js';
import type { InputText } from 'sudachi-ts/core/inputText.js';

export class NormalizationPlugin extends Plugin implements InputTextPlugin {
  private normalize: boolean = true;

  override setSettings(settings: Settings): void {
    this.normalize = settings.getBoolean('normalize', true);
  }

  rewrite(input: InputText): InputText {
    if (!this.normalize) {
      return input;
    }

    // Replace full-width characters with half-width
    const modified = input.getOriginalText()
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

    // Return modified input text
    return input.replace(0, input.length(), modified);
  }
}
```

### Registration

```json
{
  "plugins": [
    {
      "className": "./plugins/normalizationPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ]
}
```

## OovProviderPlugin

OOV (Out-of-Vocabulary) provider plugins handle words that aren't in the dictionary. This is essential for:

- Handling unknown words
- Providing fallback tokenization
- Supporting dynamic vocabulary

### Example: Simple Single-Character OOV

```typescript
import { OovProviderPlugin } from 'sudachi-ts/plugins/index.js';
import type { InputText } from 'sudachi-ts/core/inputText.js';
import type { Lattice, LatticeNode } from 'sudachi-ts/core/lattice.js';
import type { Grammar } from 'sudachi-ts/dictionary/grammar.js';

export class SimpleOovPlugin extends Plugin implements OovProviderPlugin {
  private minLength: number = 1;
  private maxLength: number = 2;
  private cost: number = 30000;

  override setSettings(settings: Settings): void {
    this.minLength = settings.getInt('minLength', 1);
    this.maxLength = settings.getInt('maxLength', 2);
    this.cost = settings.getInt('cost', 30000);
  }

  getOov(
    inputText: InputText,
    offset: number,
    hasPrevWord: boolean,
    posId: number,
    grammar: Grammar
  ): LatticeNode | null {
    // Check if character is OOV
    const text = inputText.getOriginalText().slice(offset, offset + 1);

    // Determine POS ID
    const oovPosId = this.getPosId(hasPrevWord, grammar);

    // Create OOV node
    const node = {
      wordId: this.makeWordId(0, 0, 0), // OOV word ID
      leftId: oovPosId,
      rightId: oovPosId,
      cost: this.cost,
      surface: text,
      begin: offset,
      end: offset + text.length
    };

    return node;
  }

  private getPosId(hasPrevWord: boolean, grammar: Grammar): number {
    if (hasPrevWord) {
      return grammar.getPartOfSpeechId(['名詞', '普通名詞', '一般', '*']);
    }
    return grammar.getPartOfSpeechId(['名詞', '固有名詞', '一般', '*']);
  }

  private makeWordId(dicId: number, wordId: number, isOov: number): number {
    return (dicId << 28) | (wordId & 0x0FFFFFFF);
  }
}
```

### Example: MeCab-Compatible OOV

```typescript
export class MeCabOovPlugin extends Plugin implements OovProviderPlugin {
  private oovPos: string[] = ['名詞', '未知語', '一般', '*'];
  private baseCost: number = 5000;

  override setSettings(settings: Settings): void {
    this.baseCost = settings.getInt('baseCost', 5000);
  }

  getOov(
    inputText: InputText,
    offset: number,
    hasPrevWord: boolean,
    posId: number,
    grammar: Grammar
  ): LatticeNode | null {
    const char = inputText.getOriginalText().charAt(offset);

    // Check character category
    const category = this.getCharacterCategory(char);

    if (!category) {
      return null;
    }

    // Get appropriate POS for this category
    const categoryPosId = grammar.getPartOfSpeechId(
      category.pos || this.oovPos
    );

    // Create OOV node with category-specific cost
    return {
      wordId: this.makeOovWordId(category.id),
      leftId: categoryPosId,
      rightId: categoryPosId,
      cost: this.baseCost + category.cost,
      surface: char,
      begin: offset,
      end: offset + 1
    };
  }

  private getCharacterCategory(char: string): Category | null {
    // Implementation depends on character category definitions
    // This is simplified for illustration
    if (this.isHiragana(char)) {
      return { id: 1, pos: ['名詞', '普通名詞', '一般', '*'], cost: 3000 };
    }
    return null;
  }

  private isHiragana(char: string): boolean {
    return char >= '\u3040' && char <= '\u309F';
  }
}
```

## PathRewritePlugin

Path rewrite plugins modify the segmentation after initial lattice construction. This is useful for:

- Joining numeric sequences
- Combining katakana words
- Custom segmentation rules

### Example: Join Numeric Plugin

```typescript
import { PathRewritePlugin } from 'sudachi-ts/plugins/index.js';
import type { MorphemeList } from 'sudachi-ts/core/morphemeList.js';

export class JoinNumericPlugin extends Plugin implements PathRewritePlugin {
  override setSettings(settings: Settings): void {
    // Configuration if needed
  }

  rewrite(input: InputText, path: MorphemeList): MorphemeList | null {
    const morphemes = path.toList();
    const rewritten: Morpheme[] = [];
    let i = 0;

    while (i < morphemes.length) {
      const current = morphemes[i];

      // Check if current morpheme is numeric
      if (this.isNumeric(current)) {
        const joined = [current];
        i++;

        // Join consecutive numeric morphemes
        while (i < morphemes.length && this.isNumeric(morphemes[i])) {
          joined.push(morphemes[i]);
          i++;
        }

        // Create new morpheme from joined sequence
        const joinedMorpheme = this.joinMorphemes(joined);
        rewritten.push(joinedMorpheme);
      } else {
        rewritten.push(current);
        i++;
      }
    }

    // Return rewritten path if any changes were made
    if (rewritten.length !== morphemes.length) {
      return new MorphemeList(input, rewritten);
    }

    return null; // No changes
  }

  private isNumeric(morpheme: Morpheme): boolean {
    const surface = morpheme.surface();
    return /^[\d０-９,.]+$/.test(surface);
  }

  private joinMorphemes(morphemes: Morpheme[]): Morpheme {
    const surface = morphemes.map(m => m.surface()).join('');
    const reading = morphemes.map(m => m.readingForm()).join('');

    // Create new morpheme with combined properties
    return new MorphemeImpl({
      surface,
      readingForm: reading,
      dictionaryForm: surface,
      partOfSpeech: ['名詞', '数詞', '*', '*'],
      cost: morphemes.reduce((sum, m) => sum + m.cost(), 0) / morphemes.length
    });
  }
}
```

### Example: Join Katakana OOV Plugin

```typescript
export class JoinKatakanaOovPlugin extends Plugin implements PathRewritePlugin {
  private minLength: number = 2;
  private maxLength: number = 10;

  override setSettings(settings: Settings): void {
    this.minLength = settings.getInt('minLength', 2);
    this.maxLength = settings.getInt('maxLength', 10);
  }

  rewrite(input: InputText, path: MorphemeList): MorphemeList | null {
    const morphemes = path.toList();
    const rewritten: Morpheme[] = [];
    let i = 0;

    while (i < morphemes.length) {
      const current = morphemes[i];

      // Check if current is Katakana OOV
      if (this.isKatakanaOov(current)) {
        const katakanaSeq = [current];
        i++;

        // Join consecutive Katakana OOVs
        while (i < morphemes.length && this.isKatakanaOov(morphemes[i])) {
          katakanaSeq.push(morphemes[i]);
          i++;
        }

        // Only join if sequence is within length bounds
        const surface = katakanaSeq.map(m => m.surface()).join('');
        if (surface.length >= this.minLength && surface.length <= this.maxLength) {
          const joined = this.joinKatakana(katakanaSeq);
          rewritten.push(joined);
        } else {
          rewritten.push(...katakanaSeq);
        }
      } else {
        rewritten.push(current);
        i++;
      }
    }

    return rewritten.length !== morphemes.length
      ? new MorphemeList(input, rewritten)
      : null;
  }

  private isKatakanaOov(morpheme: Morpheme): boolean {
    return morpheme.isOov() && /^[\u30A0-\u30FF]+$/.test(morpheme.surface());
  }

  private joinKatakana(morphemes: Morpheme[]): Morpheme {
    const surface = morphemes.map(m => m.surface()).join('');
    return new MorphemeImpl({
      surface,
      readingForm: surface,
      dictionaryForm: surface,
      partOfSpeech: ['名詞', '普通名詞', '一般', '*'],
      cost: morphemes.reduce((sum, m) => sum + m.cost(), 0)
    });
  }
}
```

### Built-In Placeholder: TokenChunkerPlugin

Sudachi-TS also provides a built-in `TokenChunkerPlugin` for coarse-token
chunking behavior.

Current proof-of-concept rule:
- Merge consecutive noun tokens into one chunk (compound noun style), similar to
  `tryCompoundNouns` in token-chunker-ts.
- Conservative pattern-rule families (fixed expressions, suru/progressive, te-form,
  noun-particle, pronoun+の, ために).
- Reading-aware counter normalization (for example, `三本 -> サンボン`, `一日 -> ツイタチ`) with contextual safeguards for chained counters (for example, `一日三回 -> イチニチ | サンカイ`).

Settings:
- `enablePatternRules` (default: `true`)
- `enableBroadRules` (default: `false`) for more aggressive phrase-merging rules
- `enableCompoundNouns` (default: `true`)
- `minCompoundLength` (default: `2`)
- `excludedNounSubcategories` (default: `["数詞", "接尾"]`)

```typescript
import { TokenChunkerPlugin } from 'sudachi-ts/plugins/index.js';
```

## EditConnectionCostPlugin

Connection cost plugins modify the cost of connecting two morphemes. This is useful for:

- Adjusting segmentation preferences
- Implementing domain-specific rules
- Fine-tuning output

### Example: Inhibit Certain POS Connections

```typescript
import { EditConnectionCostPlugin } from 'sudachi-ts/plugins/index.js';
import type { Morpheme } from 'sudachi-ts/core/morpheme.js';

export class InhibitConnectionPlugin extends Plugin implements EditConnectionCostPlugin {
  private inhibitions: InhibitionRule[] = [];

  override setSettings(settings: Settings): void {
    const rules = settings.getStringList('inhibitRules');
    this.inhibitions = rules.map(rule => this.parseRule(rule));
  }

  edit(
    left: Morpheme | null,
    right: Morpheme,
    cost: number
  ): number | null {
    for (const rule of this.inhibitions) {
      if (this.matches(left, rule.leftPOS) &&
          this.matches(right, rule.rightPOS)) {
        // Return null to inhibit connection, or high cost to discourage
        return rule.cost;
      }
    }
    return null; // No change
  }

  private matches(
    morpheme: Morpheme | null,
    posPattern: string[]
  ): boolean {
    if (morpheme === null) {
      return posPattern[0] === 'BOS'; // Beginning of sentence
    }

    const morphemePos = morpheme.partOfSpeech();
    for (let i = 0; i < posPattern.length; i++) {
      if (posPattern[i] !== '*' && posPattern[i] !== morphemePos[i]) {
        return false;
      }
    }
    return true;
  }

  private parseRule(rule: string): InhibitionRule {
    // Parse rule like "名詞,*,*,* > 動詞,*,*,* = 10000"
    const [left, rest] = rule.split('>');
    const [right, cost] = rest.split('=');

    return {
      leftPOS: left.split(','),
      rightPOS: right.split(','),
      cost: parseInt(cost.trim(), 10)
    };
  }
}

interface InhibitionRule {
  leftPOS: string[];
  rightPOS: string[];
  cost: number;
}
```

### Example: Edit Connection Costs

```typescript
export class EditConnectionCostPluginImpl extends Plugin implements EditConnectionCostPlugin {
  private edits: ConnectionEdit[] = [];

  override setSettings(settings: Settings): void {
    const editRules = settings.getStringList('editRules');
    this.edits = editRules.map(rule => this.parseEdit(rule));
  }

  edit(
    left: Morpheme | null,
    right: Morpheme,
    cost: number
  ): number | null {
    for (const edit of this.edits) {
      if (this.matches(left, edit.leftPOS) &&
          this.matches(right, edit.rightPOS)) {
        return edit.cost;
      }
    }
    return null;
  }

  private matches(
    morpheme: Morpheme | null,
    posPattern: string[]
  ): boolean {
    if (morpheme === null) {
      return posPattern[0] === 'BOS';
    }

    const morphemePos = morpheme.partOfSpeech();
    for (let i = 0; i < posPattern.length; i++) {
      if (posPattern[i] !== '*' && posPattern[i] !== morphemePos[i]) {
        return false;
      }
    }
    return true;
  }

  private parseEdit(rule: string): ConnectionEdit {
    const [left, rest] = rule.split('>');
    const [right, cost] = rest.split('=');

    return {
      leftPOS: left.split(','),
      rightPOS: right.split(','),
      cost: parseInt(cost.trim(), 10)
    };
  }
}

interface ConnectionEdit {
  leftPOS: string[];
  rightPOS: string[];
  cost: number;
}
```

## MorphemeFormatterPlugin

Formatter plugins control how morpheme output is formatted. This is useful for:

- Custom output formats
- Filtering morphemes
- Adding metadata

### Example: Simple Morpheme Formatter

```typescript
import { MorphemeFormatterPlugin } from 'sudachi-ts/plugins/index.js';
import type { Morpheme } from 'sudachi-ts/core/morpheme.js';

export class SimpleMorphemeFormatter extends Plugin implements MorphemeFormatterPlugin {
  private fields: string[] = ['surface', 'pos'];

  override setSettings(settings: Settings): void {
    const fields = settings.getStringList('fields');
    if (fields.length > 0) {
      this.fields = fields;
    }
  }

  format(morpheme: Morpheme): string {
    const parts: string[] = [];

    for (const field of this.fields) {
      switch (field) {
        case 'surface':
          parts.push(morpheme.surface());
          break;
        case 'pos':
          parts.push(morpheme.partOfSpeech().join(','));
          break;
        case 'reading':
          parts.push(morpheme.readingForm());
          break;
        case 'dictionaryForm':
          parts.push(morpheme.dictionaryForm());
          break;
        case 'normalizedForm':
          parts.push(morpheme.normalizedForm());
          break;
        default:
          parts.push('');
      }
    }

    return parts.join('\t');
  }
}
```

## Plugin Loader

Load plugins dynamically at runtime:

```typescript
import { PluginLoader } from 'sudachi-ts/plugins/loader.js';
import { Settings } from 'sudachi-ts/config/settings.js';

const loader = new PluginLoader();

// Load input text plugin
const inputTextPlugin = await loader.loadInputTextPlugin(
  './myPlugin.js',
  new Settings({ option: 'value' })
);

// Load OOV provider plugin
const oovPlugin = await loader.loadOovProviderPlugin(
  './myOovPlugin.js',
  new Settings({ minCost: 3000 })
);

// Load path rewrite plugin
const pathRewritePlugin = await loader.loadPathRewritePlugin(
  './myRewritePlugin.js',
  new Settings({ minLength: 2 })
);
```

## Configuration

Configure plugins in `sudachi.json`:

```json
{
  "plugins": [
    {
      "className": "./plugins/normalizationPlugin.js",
      "settings": {
        "normalize": true,
        "replaceFullWidth": true
      }
    },
    {
      "className": "./plugins/joinNumericPlugin.js",
      "settings": {
        "minLength": 1
      }
    },
    {
      "className": "./plugins/editConnectionCostPlugin.js",
      "settings": {
        "editRules": [
          "名詞,*,*,* > 動詞,*,*,* = 5000",
          "助詞,*,*,* > 名詞,*,*,* = 2000"
        ]
      }
    }
  ]
}
```

## Plugin Execution Order

Plugins are executed in the order they are registered:

1. **InputTextPlugin** - Before tokenization
2. **OOVProviderPlugin** - During lattice construction
3. **PathRewritePlugin** - After best path is found
4. **EditConnectionCostPlugin** - During path calculation
5. **MorphemeFormatterPlugin** - During output formatting

## Best Practices

1. **Keep plugins focused** - Each plugin should do one thing well
2. **Document settings** - Clearly document all configuration options
3. **Handle errors gracefully** - Return null or default values for invalid input
4. **Test thoroughly** - Write unit tests for plugin behavior
5. **Consider performance** - Avoid expensive operations in hot paths
6. **Use proper types** - Leverage TypeScript for type safety

## Testing Plugins

```typescript
import { test, expect } from 'bun:test';
import { MyPlugin } from './myPlugin.js';

test('MyPlugin transforms input correctly', () => {
  const plugin = new MyPlugin();
  plugin.setSettings(new Settings({ option: 'test' }));

  const input = createMockInputText('テスト');
  const result = plugin.rewrite(input);

  expect(result.getOriginalText()).toBe('TEST');
});
```

## Examples

See the `examples/` directory for complete plugin examples:

- `plugin-usage.ts` - Basic plugin loading example
- Built-in plugins in `src/plugins/` for reference implementations

## Troubleshooting

### Plugin Not Loading

- Check file paths in configuration
- Verify plugin exports the correct class/interface
- Ensure TypeScript compilation succeeds

### Settings Not Applied

- Verify settings object structure
- Check for type mismatches
- Ensure `setSettings()` is called before use

### Unexpected Behavior

- Add logging to plugin methods
- Use lattice dump to debug tokenization
- Test with simple inputs first
