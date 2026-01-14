/*
  Generate data/movescript.json from Go sources.

  Usage:
    node scripts/generate-movescript-json.js <env.go> <movescript_defines_lookup.go> <logger_tags.go>
*/

const fs = require('fs');
const path = require('path');

// Config
// Interface names to read method comments from (defined in env.go)
const RUNTIME_INTERFACE_NAME = 'Environment';
const OUTPUT_DIR_REL = path.join('data');
const OUTPUT_FILENAME = 'movescript.json';

const CMD_PREFIX = 'Cmd';

const BASE_COMMANDS = [
  { name: 'nop', args: [] },
  { name: 'hostCall', args: [] },
  {
    name: 'goto',
    args: [{ name: 'jumpPc', type: 'label' }]
  },
  {
    name: 'set',
    args: [
      { name: 'variable', type: 'variable' },
      { name: 'value', type: 'number' }
    ]
  },
  {
    name: 'copy',
    args: [
      { name: 'from', type: 'variable' },
      { name: 'to', type: 'variable' }
    ]
  },
  {
    name: 'setFlag',
    args: [
      { name: 'variable', type: 'variable' },
      { name: 'flag', type: 'flag' }
    ]
  },
  {
    name: 'clearFlag',
    args: [
      { name: 'variable', type: 'variable' },
      { name: 'flag', type: 'flag' }
    ]
  },
  {
    name: 'add',
    args: [
      { name: 'variable', type: 'variable' },
      { name: 'value', type: 'number' }
    ]
  },
  {
    name: 'call',
    args: [{ name: 'addr', type: 'label' }]
  },
  { name: 'ret', args: [] },
  {
    name: 'jumpIf',
    args: [
      { name: 'variable', type: 'variable' },
      { name: 'value', type: 'number' },
      { name: 'jumpPc', type: 'label' }
    ]
  },
  {
    name: 'jumpIfFlag',
    args: [
      { name: 'variable', type: 'variable' },
      { name: 'flag', type: 'flag' },
      { name: 'jumpPc', type: 'label' }
    ]
  },
  {
    name: 'jumpIfNotFlag',
    args: [
      { name: 'variable', type: 'variable' },
      { name: 'flag', type: 'flag' },
      { name: 'jumpPc', type: 'label' }
    ]
  }
];

// Helpers
function readFileText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read file: ${filePath}\n${err.message}`);
  }
}

function writeJsonFile(filePath, obj) {
  const text = JSON.stringify(obj, null, 2) + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function extractInterfaceBody(src, interfaceName) {
  const re = new RegExp(`type\\s+${interfaceName}\\s+interface\\s*{([\\s\\S]*?)}`, 'm');
  const m = src.match(re);
  if (!m) return '';
  return m[1];
}

function mapGoTypeToArg(paramName, goType) {
  const t = goType.trim();
  if (t === 'Variable' || t === 'fx.Variable') return 'variable';
  if (t === 'Flag' || t === 'fx.Flag') return 'flag';
  if (t === 'Identifier' || t === 'fx.Identifier') return 'identifier';
  if (t === 'string') return 'string';
  if (t === 'int' || t === 'uint' || t === 'int32' || t === 'int64' || t === 'uint32' || t === 'uint64') {
    // Heuristic: addresses/labels are ints named *ptr, *Ptr, jumpPtr, fnPtr, ptr, *Pc
    if (/^(?:jumpPtr|fnPtr|ptr|.*Pc)$/i.test(paramName)) return 'label';
    return 'number';
  }
  // Slices or interfaces we don't support as typed suggestions
  return undefined;
}

function collectMethodMetadata(interfaceBody) {
  // Returns Map name -> { detail?: string, args: { name: string, type: string }[] }
  const map = new Map();
  const lines = interfaceBody.split(/\r?\n/);
  let pendingComments = [];

  for (const rawLine of lines) {
    const line = rawLine; // keep indentation
    const commentMatch = line.match(/^\s*\/\/\s?(.*)$/);
    if (commentMatch) {
      pendingComments.push(commentMatch[1]);
      continue;
    }

    // Match interface method signature on a single line
    // Example: CmdCopy(from, to Variable)
    // Example: CmdJumpIf(variable Variable, value int, jumpPtr int) (pc int, jump bool)
    const methMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
    if (methMatch) {
      const name = methMatch[1];
      const paramsRaw = methMatch[2].trim();
      const detail = pendingComments.join('\n').trim();
      pendingComments = [];

      const args = [];
      if (paramsRaw.length > 0) {
        // Split by commas at top level. Grouped params like "from, to Variable" become
        // ["from", "to Variable"]. We buffer names without a type and backfill when we see a type.
        const parts = paramsRaw.split(/\s*,\s*/);
        let pendingNames = [];
        for (const part of parts) {
          const typed = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);
          if (typed) {
            const paramName = typed[1];
            const goType = typed[2].trim();
            const mapped = mapGoTypeToArg(paramName, goType);
            if (mapped) {
              // Apply this type to all pending names first
              for (const n of pendingNames) {
                const m2 = mapGoTypeToArg(n, goType);
                if (m2) args.push({ name: n, type: m2 });
              }
              pendingNames = [];
              // Then add the current param with the same type
              args.push({ name: paramName, type: mapped });
            } else {
              // Unknown type: clear pending and skip
              pendingNames = [];
            }
          } else {
            // No type in this segment; this should be a bare parameter name
            const nameOnly = part.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
            if (nameOnly) {
              pendingNames.push(nameOnly[1]);
            }
          }
        }
        // If any names remain without a discovered type, we drop them (no suggestions)
      }

      const meta = { args };
      if (detail) meta.detail = detail;
      map.set(name, meta);
      continue;
    }

    // Reset on blank lines
    if (line.trim().length === 0) {
      pendingComments = [];
    }
  }

  return map;
}

function extractMapEntries(src, varName) {
  // Extract entries from: var <varName> = map[string]<Type>{ ... } or var <varName> = <CustomType>{ ... }
  const re = new RegExp(`var\\s+${varName}\\s*=\\s*(?:map\\[string]\\s*[^{]*|[A-Za-z0-9_\\.]+){([\\s\\S]*?)}\\s*`, 'm');
  const m = src.match(re);
  if (!m) return [];
  const body = m[1];
  const entries = [];
  const reEntry = /"([^"]+)"\s*:\s*([A-Za-z0-9_\.]+)/g;
  let mm;
  while ((mm = reEntry.exec(body)) !== null) {
    entries.push({ key: mm[1], value: mm[2] });
  }
  return entries;
}

function extractMapKeys(src, varName) {
  const entries = extractMapEntries(src, varName);
  return entries.map(e => e.key);
}

function extractConstStringValues(src) {
  // Extract string literal values from a const ( ... ) block.
  // Example:
  //   const (
  //     TagFoo = "foo"
  //     TagBar = "bar"
  //   )
  // Returns ["foo", "bar"]
  const values = [];
  // Find first top-level const group
  const groupMatch = src.match(/const\s*\(\s*([\s\S]*?)\s*\)/m);
  if (!groupMatch) return values;
  const body = groupMatch[1];
  const lineRe = /^(?:\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*)(.+)$/gm;
  let m;
  while ((m = lineRe.exec(body)) !== null) {
    const rhs = m[2].trim();
    const strMatch = rhs.match(/^"((?:\\.|[^"])*)"/);
    if (strMatch) {
      // Unescape common escapes in Go string
      const raw = strMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
      values.push(raw);
    }
  }
  return values;
}

function main() {
  const envFilePath = process.argv[2];
  const definesLookupPath = process.argv[3];
  const loggerTagsPath = process.argv[4];
  if (!envFilePath || !definesLookupPath || !loggerTagsPath) {
    console.error('Usage: node scripts/generate-movescript-json.js <env.go> <movescript_defines_lookup.go> <logger_tags.go>');
    process.exit(1);
  }

  const envSrc = readFileText(path.resolve(process.cwd(), envFilePath));
  const definesSrc = readFileText(path.resolve(process.cwd(), definesLookupPath));
  const loggerTagsSrc = readFileText(path.resolve(process.cwd(), loggerTagsPath));

  // Parse method comments from Environment interface
  const envIfaceBody = extractInterfaceBody(envSrc, RUNTIME_INTERFACE_NAME);
  const methodMeta = collectMethodMetadata(envIfaceBody);

  // Extract data from Go maps
  const cmdEntries = extractMapEntries(definesSrc, 'commandTypes');
  const flags = extractMapKeys(definesSrc, 'flags');
  const identifiers = extractMapKeys(definesSrc, 'identifiers');
  const variables = extractMapKeys(definesSrc, 'variables');
  const tags = extractConstStringValues(loggerTagsSrc);

  // Basic sanity: tags should be unique and non-empty
  const tagSet = new Set();
  for (const t of tags) {
    if (!t || typeof t !== 'string') continue;
    tagSet.add(t);
  }

  // To preserve user-specified fields like `optional` on args, read existing output (if any)
  let existing = {};
  try {
    const outExisting = path.resolve(process.cwd(), OUTPUT_DIR_REL, OUTPUT_FILENAME);
    if (fs.existsSync(outExisting)) {
      const prev = JSON.parse(fs.readFileSync(outExisting, 'utf8'));
      if (Array.isArray(prev?.commands)) {
        for (const c of prev.commands) {
          if (!c || typeof c.name !== 'string') continue;
          if (Array.isArray(c.args)) {
            existing[c.name] = c.args;
          }
        }
      }
    }
  } catch {
    existing = {};
  }

  const commands = [...BASE_COMMANDS];

  for (const { key, value } of cmdEntries) {
    if (key === 'count' || key === 'none') continue;
    // Skip base commands that are already in BASE_COMMANDS
    if (BASE_COMMANDS.some(bc => bc.name === key)) continue;

    const methodName = value.startsWith(CMD_PREFIX) ? value.replace(/\s+/g, '') : CMD_PREFIX + value.replace(/\s+/g, '');
    const meta = methodMeta.get(methodName);
    // If we can't find it in the interface, skip it (unless it's a base command, but we already handled those)
    if (!meta) {
      // console.warn(`Warning: command ${key} (${methodName}) not found in Environment interface, skipping.`);
      continue;
    }

    const detail = meta.detail || '';
    const genArgs = Array.isArray(meta.args) ? meta.args : [];
    const prevArgs = existing[key];
    const args = genArgs.map((ga, idx) => {
      const prev = Array.isArray(prevArgs) ? prevArgs[idx] : undefined;
      if (prev && typeof prev === 'object') {
        const out = { ...ga };
        if (Object.prototype.hasOwnProperty.call(prev, 'optional')) {
          out.optional = !!prev.optional;
        }
        return out;
      }
      return ga;
    });

    const obj = { name: key, args };
    if (detail) obj.detail = detail;
    commands.push(obj);
  }

  const result = { commands, flags, identifiers, variables, string_tags: [...tagSet] };

  const outPath = path.resolve(process.cwd(), OUTPUT_DIR_REL, OUTPUT_FILENAME);
  writeJsonFile(outPath, result);
  console.log(`Generated ${outPath}`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message || String(err));
    process.exit(1);
  }
}
