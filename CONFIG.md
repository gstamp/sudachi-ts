# Configuration Guide

Complete guide to configuring Sudachi-TS.

## Configuration File

Sudachi-TS uses JSON configuration files (default: `sudachi.json`). The configuration file can be placed in your project root or specified explicitly.

## Basic Configuration

### Minimal Configuration

```json
{
  "systemDict": "system_core.dic"
}
```

### Complete Configuration

```json
{
  "systemDict": "system_core.dic",
  "userDicts": [
    "user.dic",
    "custom.dic"
  ],
  "characterDefinitionFile": "char.def",
  "inputTextPlugin": [
    {
      "className": "sudachi-ts/plugins/inputText/defaultInputTextPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ],
  "oovProviderPlugin": [
    {
      "className": "sudachi-ts/plugins/oov/meCabOovProviderPlugin.js",
      "settings": {
        "oovPOS": "名詞,未知語,一般,*"
      }
    }
  ],
  "pathRewritePlugin": [
    {
      "className": "sudachi-ts/plugins/pathRewrite/joinNumericPlugin.js",
      "settings": {
        "minLength": 1
      }
    }
  ],
  "editConnectionCostPlugin": [
    {
      "className": "sudachi-ts/plugins/connection/editConnectionCostPlugin.js",
      "settings": {
        "editRules": [
          "名詞,*,*,* > 動詞,*,*,* = 5000"
        ]
      }
    }
  ]
}
```

## Configuration Options

### Dictionary Settings

#### systemDict (required)

Path to the system dictionary file.

```json
{
  "systemDict": "/path/to/system_core.dic"
}
```

**Type**: `string`

#### userDicts (optional)

Array of user dictionary paths.

```json
{
  "userDicts": [
    "/path/to/user.dic",
    "/path/to/custom.dic"
  ]
}
```

**Type**: `string[]`

**Default**: `[]`

#### characterDefinitionFile (optional)

Path to character definition file for OOV handling.

```json
{
  "characterDefinitionFile": "char.def"
}
```

**Type**: `string`

**Default**: `char.def`

### Plugin Settings

#### inputTextPlugin (optional)

List of input text plugins for preprocessing.

```json
{
  "inputTextPlugin": [
    {
      "className": "./plugins/myInputPlugin.js",
      "settings": {
        "option1": "value1",
        "option2": true
      }
    }
  ]
}
```

**Type**: `Array<{ className: string, settings: object }>`

**Default**: `[]`

#### oovProviderPlugin (optional)

List of OOV (Out-of-Vocabulary) provider plugins.

```json
{
  "oovProviderPlugin": [
    {
      "className": "./plugins/myOovPlugin.js",
      "settings": {
        "minLength": 1,
        "maxLength": 2,
        "cost": 30000
      }
    }
  ]
}
```

**Type**: `Array<{ className: string, settings: object }>`

**Default**: `[]`

#### pathRewritePlugin (optional)

List of path rewrite plugins for post-processing.

```json
{
  "pathRewritePlugin": [
    {
      "className": "./plugins/myRewritePlugin.js",
      "settings": {
        "minLength": 2
      }
    }
  ]
}
```

**Type**: `Array<{ className: string, settings: object }>`

**Default**: `[]`

#### editConnectionCostPlugin (optional)

List of connection cost editing plugins.

```json
{
  "editConnectionCostPlugin": [
    {
      "className": "./plugins/myConnectionPlugin.js",
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

**Type**: `Array<{ className: string, settings: object }>`

**Default**: `[]`

### Split Mode Settings

#### splitMode (optional)

Default split mode for tokenization.

```json
{
  "splitMode": "C"
}
```

**Type**: `"A"` | `"B"` | `"C"`

**Default**: `"C"`

- **A**: Shortest possible segmentation
- **B**: Medium segmentation
- **C**: Longest possible segmentation

### Resource Settings

#### resourcePath (optional)

Base path for resource files.

```json
{
  "resourcePath": "/path/to/resources"
}
```

**Type**: `string`

**Default**: Current directory

### Output Settings

#### outputFormat (optional)

Default output format for morphemes.

```json
{
  "outputFormat": "wakati"
}
```

**Type**: `"wakati"` | `"json"` | `"mecab"`

**Default**: `null` (uses morpheme objects)

## Built-in Plugin Configurations

### Default Input Text Plugin

Normalizes input text before tokenization.

```json
{
  "inputTextPlugin": [
    {
      "className": "sudachi-ts/plugins/inputText/defaultInputTextPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ]
}
```

**Settings**:
- `normalize` (boolean): Enable/disable normalization (default: `true`)

### Prolonged Sound Mark Plugin

Normalizes prolonged sound marks.

```json
{
  "inputTextPlugin": [
    {
      "className": "sudachi-ts/plugins/inputText/prolongedSoundMarkPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ]
}
```

**Settings**:
- `normalize` (boolean): Enable/disable normalization (default: `true`)

### Ignore Yomigana Plugin

Removes reading annotations (yomigana).

```json
{
  "inputTextPlugin": [
    {
      "className": "sudachi-ts/plugins/inputText/ignoreYomiganaPlugin.js",
      "settings": {
        "removeParens": true
      }
    }
  ]
}
```

**Settings**:
- `removeParens` (boolean): Remove parentheses around yomigana (default: `true`)

### MeCab OOV Provider Plugin

MeCab-compatible OOV handling.

```json
{
  "oovProviderPlugin": [
    {
      "className": "sudachi-ts/plugins/oov/meCabOovProviderPlugin.js",
      "settings": {
        "oovPOS": "名詞,未知語,一般,*",
        "cost": 5000
      }
    }
  ]
}
```

**Settings**:
- `oovPOS` (string): Part-of-speech for OOV words (default: `"名詞,未知語,一般,*"`)
- `cost` (number): Base cost for OOV words (default: `5000`)

### Simple OOV Provider Plugin

Simple single-character OOV handling.

```json
{
  "oovProviderPlugin": [
    {
      "className": "sudachi-ts/plugins/oov/simpleOovProviderPlugin.js",
      "settings": {
        "minLength": 1,
        "maxLength": 2,
        "cost": 30000
      }
    }
  ]
}
```

**Settings**:
- `minLength` (number): Minimum word length (default: `1`)
- `maxLength` (number): Maximum word length (default: `2`)
- `cost` (number): Cost for OOV words (default: `30000`)

### Join Numeric Plugin

Joins numeric sequences.

```json
{
  "pathRewritePlugin": [
    {
      "className": "sudachi-ts/plugins/pathRewrite/joinNumericPlugin.js",
      "settings": {
        "minLength": 1,
        "joinKanjiNumeric": true
      }
    }
  ]
}
```

**Settings**:
- `minLength` (number): Minimum length to join (default: `1`)
- `joinKanjiNumeric` (boolean): Join kanji numerics (default: `true`)

### Join Katakana OOV Plugin

Joins katakana OOV sequences.

```json
{
  "pathRewritePlugin": [
    {
      "className": "sudachi-ts/plugins/pathRewrite/joinKatakanaOovPlugin.js",
      "settings": {
        "minLength": 2,
        "maxLength": 10
      }
    }
  ]
}
```

**Settings**:
- `minLength` (number): Minimum length to join (default: `2`)
- `maxLength` (number): Maximum length to join (default: `10`)

### Edit Connection Cost Plugin

Modifies connection costs between morphemes.

```json
{
  "editConnectionCostPlugin": [
    {
      "className": "sudachi-ts/plugins/connection/editConnectionCostPlugin.js",
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

**Settings**:
- `editRules` (string[]): Array of edit rules

**Rule format**: `"leftPOS > rightPOS = cost"`

Example:
- `"名詞,*,*,* > 動詞,*,*,* = 5000"`: Sets cost between any noun and verb to 5000
- `"助詞,*,*,* > 名詞,*,*,* = 2000"`: Sets cost between any particle and noun to 2000
- `"BOS > 名詞,*,*,* = 0"`: Sets cost at sentence beginning to noun

### Inhibit Connection Plugin

Inhibits connections between specific POS.

```json
{
  "editConnectionCostPlugin": [
    {
      "className": "sudachi-ts/plugins/connection/inhibitConnectionPlugin.js",
      "settings": {
        "inhibitRules": [
          "名詞,*,*,* > 記号,*,*,*",
          "助詞,*,*,* > 助詞,*,*,*"
        ]
      }
    }
  ]
}
```

**Settings**:
- `inhibitRules` (string[]): Array of inhibition rules

**Rule format**: `"leftPOS > rightPOS"`

When a rule matches, the connection is prevented (cost set to maximum).

### Simple Morpheme Formatter

Formats morpheme output.

```json
{
  "morphemeFormatterPlugin": [
    {
      "className": "sudachi-ts/plugins/formatter/simpleMorphemeFormatter.js",
      "settings": {
        "fields": [
          "surface",
          "pos",
          "reading",
          "dictionaryForm"
        ]
      }
    }
  ]
}
```

**Settings**:
- `fields` (string[]): Output fields

**Available fields**:
- `surface`: Surface form
- `pos`: Part of speech
- `reading`: Reading form
- `dictionaryForm`: Dictionary form
- `normalizedForm`: Normalized form

## Loading Configuration

### From File

```typescript
import { loadConfig } from 'sudachi-ts/config/config.js';

// Load default config (sudachi.json)
const config = await loadConfig();

// Load custom config
const config = await loadConfig('./custom.json');
```

### From JSON String

```typescript
import { Config } from 'sudachi-ts/config/config.js';

const jsonString = JSON.stringify({
  systemDict: 'system_core.dic',
  splitMode: 'C'
});

const config = Config.parse(jsonString);
```

### Empty Configuration

```typescript
import { Config } from 'sudachi-ts/config/config.js';

const config = Config.empty();
```

## Path Resolution

Sudachi-TS provides flexible path resolution using path anchors.

### No Anchor

Paths are resolved relative to the current working directory.

```typescript
import { Config, PathAnchor } from 'sudachi-ts/config/config.js';

const config = Config.empty().setAnchor(PathAnchor.none());
```

### Filesystem Anchor

Paths are resolved relative to a base directory.

```typescript
import { Config, PathAnchor } from 'sudachi-ts/config/config.js';

const config = Config.empty().setAnchor(
  PathAnchor.filesystem('/path/to/dictionaries')
);
```

### Resource Anchor

Paths are resolved as resource names.

```typescript
import { Config, PathAnchor } from 'sudachi-ts/config/config.js';

const config = Config.empty().setAnchor(
  PathAnchor.resource('sudachi-dictionaries')
);
```

### Chained Anchors

Multiple anchors can be chained.

```typescript
import { Config, PathAnchor } from 'sudachi-ts/config/config.js';

const anchor = PathAnchor.filesystem('/path/to/dicts')
  .andThen(PathAnchor.resource('fallback'));

const config = Config.empty().setAnchor(anchor);
```

## Accessing Configuration Values

```typescript
import { Config } from 'sudachi-ts/config/config.js';

const config = await Config.fromFile('./sudachi.json');

// Get string value
const systemDict = config.getString('systemDict');

// Get integer value
const timeout = config.getInt('timeout', 5000);

// Get boolean value
const normalize = config.getBoolean('normalize', true);

// Get string list
const userDicts = config.getStringList('userDicts');

// Get integer list
const limits = config.getIntList('limits');

// Get plugin configurations
const inputTextPlugins = config.getPlugins('inputTextPlugin');
```

## Configuration Merging

You can merge multiple configurations with fallback values.

```typescript
import { Config } from 'sudachi-ts/config/config.js';

const baseConfig = Config.parse('{"systemDict": "system.dic"}');
const userConfig = Config.parse('{"userDicts": ["user.dic"]}');

const merged = userConfig.withFallback(baseConfig);
```

## Environment Variables

Configuration values can reference environment variables using `${VAR_NAME}` syntax.

```json
{
  "systemDict": "${DICT_PATH}/system.dic",
  "resourcePath": "${RESOURCE_DIR}"
}
```

Environment variables are automatically expanded when loading the configuration.

## Example Configurations

### Web Application

```json
{
  "systemDict": "/resources/dictionaries/system_core.dic",
  "characterDefinitionFile": "/resources/char.def",
  "inputTextPlugin": [
    {
      "className": "sudachi-ts/plugins/inputText/defaultInputTextPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ],
  "pathRewritePlugin": [
    {
      "className": "sudachi-ts/plugins/pathRewrite/joinNumericPlugin.js",
      "settings": {
        "minLength": 1
      }
    }
  ]
}
```

### Server-Side Application

```json
{
  "systemDict": "/var/lib/sudachi/system_core.dic",
  "userDicts": [
    "/etc/sudachi/user.dic",
    "/etc/sudachi/custom.dic"
  ],
  "characterDefinitionFile": "/etc/sudachi/char.def",
  "splitMode": "C",
  "inputTextPlugin": [
    {
      "className": "sudachi-ts/plugins/inputText/defaultInputTextPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ],
  "oovProviderPlugin": [
    {
      "className": "sudachi-ts/plugins/oov/meCabOovProviderPlugin.js",
      "settings": {
        "oovPOS": "名詞,未知語,一般,*"
      }
    }
  ],
  "pathRewritePlugin": [
    {
      "className": "sudachi-ts/plugins/pathRewrite/joinNumericPlugin.js",
      "settings": {}
    },
    {
      "className": "sudachi-ts/plugins/pathRewrite/joinKatakanaOovPlugin.js",
      "settings": {
        "minLength": 2
      }
    }
  ]
}
```

### Development Environment

```json
{
  "systemDict": "./dictionaries/system_core.dic",
  "userDicts": [
    "./test/user_test.dic"
  ],
  "characterDefinitionFile": "./resources/char.def",
  "inputTextPlugin": [
    {
      "className": "sudachi-ts/plugins/inputText/defaultInputTextPlugin.js",
      "settings": {
        "normalize": true
      }
    }
  ],
  "editConnectionCostPlugin": [
    {
      "className": "sudachi-ts/plugins/connection/editConnectionCostPlugin.js",
      "settings": {
        "editRules": []
      }
    }
  ]
}
```

### Minimal Configuration

```json
{
  "systemDict": "system_core.dic"
}
```

## Configuration Validation

Sudachi-TS performs basic validation on configuration:

- `systemDict` must be a valid file path
- `splitMode` must be one of: "A", "B", "C"
- Plugin classes must exist and implement correct interfaces
- Plugin settings must match expected types

Invalid configurations will throw errors during loading.

## Debugging Configuration

### Enable Logging

```typescript
import { Config } from 'sudachi-ts/config/config.js';

const config = await Config.fromFile('./sudachi.json');

// Log configuration values
console.log('System dict:', config.getString('systemDict'));
console.log('User dicts:', config.getStringList('userDicts'));
console.log('Plugins:', config.getPlugins('inputTextPlugin'));
```

### Test Configuration

```typescript
import { Dictionary } from 'sudachi-ts/core/dictionary.js';

try {
  const dict = await Dictionary.fromConfig(config);
  console.log('Dictionary loaded successfully');
} catch (error) {
  console.error('Configuration error:', error);
}
```

## Best Practices

1. **Use absolute paths** when possible to avoid ambiguity
2. **Document custom settings** in comments or separate documentation
3. **Version control configuration** files for reproducibility
4. **Use environment variables** for paths that vary between environments
5. **Test configuration** in development before production use
6. **Keep configuration simple** - only include what you need
7. **Validate paths** before loading to provide better error messages
8. **Use fallback configurations** for robust default behavior

## Troubleshooting

### Dictionary Not Found

```
Error: Cannot find dictionary: system_core.dic
```

**Solution**: Check that the path is correct and use `PathAnchor` to set the base directory.

```typescript
import { PathAnchor } from 'sudachi-ts/config/pathAnchor.js';

const config = Config.empty().setAnchor(
  PathAnchor.filesystem('/path/to/dicts')
);
```

### Plugin Not Loading

```
Error: Cannot load plugin: ./myPlugin.js
```

**Solution**: Verify the plugin file path and that the plugin exports the correct class.

```typescript
// myPlugin.ts
export class MyPlugin implements InputTextPlugin {
  // ...
}
```

### Invalid Configuration

```
Error: Invalid split mode: "D"
```

**Solution**: Ensure configuration values match expected types and ranges.

### Permission Errors

```
Error: Permission denied: /var/lib/sudachi/system.dic
```

**Solution**: Check file permissions and that the application has read access to dictionary files.

## Related Documentation

- [API Reference](./API.md) - Configuration API details
- [Plugin Development Guide](./PLUGINS.md) - Plugin configuration
- [README](./README.md) - Getting started guide
