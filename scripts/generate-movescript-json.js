/*
  Generate data/movescript.json from Go sources.

  Usage:
    node scripts/generate-movescript-json.js <runtime.go> <parser_defines_lookup.go> <logger_tags.go>
*/

const fs = require('fs');
const path = require('path');

// Config
// Interface names to read method comments from (defined in runtime.go)
const RUNTIME_INTERFACE_NAME = 'RuntimeEnvironment';
const BASE_RUNTIME_INTERFACE_NAME = 'baseRuntime';
const OUTPUT_DIR_REL = path.join('data');
const OUTPUT_FILENAME = 'movescript.json';

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

function collectMethodMetadata(interfaceBody) {
  // Returns Map name -> { detail?: string, args: { name: string, type: string }[] }
  const map = new Map();
  const lines = interfaceBody.split(/\r?\n/);
  let pendingComments = [];

  // Helper: map Go type + param name to ArgType
  const mapGoTypeToArg = (paramName, goType) => {
    const t = goType.trim();
    if (t === 'Variable') return 'variable';
    if (t === 'Flag') return 'flag';
    if (t === 'Identifier') return 'identifier';
    if (t === 'string') return 'string';
    if (t === 'int' || t === 'uint' || t === 'int32' || t === 'int64' || t === 'uint32' || t === 'uint64') {
      // Heuristic: addresses/labels are ints named *ptr, *Ptr, jumpPtr, fnPtr, ptr
      if (/^(?:jumpPtr|fnPtr|ptr)$/i.test(paramName)) return 'label';
      return 'number';
    }
    // Slices or interfaces we don't support as typed suggestions
    return undefined;
  };

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
  // Extract entries from: var <varName> = map[string]<Type>{ ... }
  const re = new RegExp(`var\\s+${varName}\\s*=\\s*map\\[string]\\s*[^{]*{([\\s\\S]*?)}\\s*`, 'm');
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
  const parserDefinesPath = process.argv[2];
  const parserLookupPath = process.argv[3];
  const loggerTagsPath = process.argv[4];
  if (!parserDefinesPath || !parserLookupPath || !loggerTagsPath) {
    console.error('Usage: node scripts/generate-movescript-json.js <runtime.go> <parser_defines_lookup.go> <logger_tags.go>');
    process.exit(1);
  }

  const runtimeSrc = readFileText(path.resolve(process.cwd(), parserDefinesPath));
  const parserSrc = readFileText(path.resolve(process.cwd(), parserLookupPath));
  const loggerTagsSrc = readFileText(path.resolve(process.cwd(), loggerTagsPath));

  // Parse method comments from both RuntimeEnvironment and baseRuntime interfaces
  const runtimeIfaceBody = extractInterfaceBody(runtimeSrc, RUNTIME_INTERFACE_NAME);
  const baseRuntimeIfaceBody = extractInterfaceBody(runtimeSrc, BASE_RUNTIME_INTERFACE_NAME);
  const runtimeMeta = collectMethodMetadata(runtimeIfaceBody);
  const baseMeta = collectMethodMetadata(baseRuntimeIfaceBody);

  // Merge metadata: prefer RuntimeEnvironment over baseRuntime on conflicts
  const methodMeta = new Map(baseMeta);
  for (const [k, v] of runtimeMeta.entries()) methodMeta.set(k, v);

  // Extract data from Go maps
  const cmdEntries = extractMapEntries(parserSrc, 'commandTypes');
  const flags = extractMapKeys(parserSrc, 'flags');
  const identifiers = extractMapKeys(parserSrc, 'identifiers');
  const variables = extractMapKeys(parserSrc, 'variables');
  const tags = extractConstStringValues(loggerTagsSrc);

  // Basic sanity: tags should be unique and non-empty
  const tagSet = new Set();
  for (const t of tags) {
    if (!t || typeof t !== 'string') continue;
    tagSet.add(t);
  }

  // Build commands array: { name, detail?, args? }
  // Special cases: ignore synthetic entries used differently in runtime
  // - "count" (CmdCount)
  // - "none"  (CmdNone)
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

  const commands = cmdEntries
    .filter(({ key }) => key !== 'count' && key !== 'none')
    .map(({ key, value }) => {
      // value is like CmdNop; use it to find a comment in interface
      const methodName = value.replace(/\s+/g, '');
      const meta = methodMeta.get(methodName) || {};
      const detail = meta.detail || '';
      // Start from generated args, then merge back any existing user-set properties (like optional)
      const genArgs = Array.isArray(meta.args) ? meta.args : [];
      const prevArgs = existing[key];
      const args = genArgs.map((ga, idx) => {
        const prev = Array.isArray(prevArgs) ? prevArgs[idx] : undefined;
        if (prev && typeof prev === 'object') {
          const out = { ...ga };
          // Preserve boolean optional exactly as specified if present
          if (Object.prototype.hasOwnProperty.call(prev, 'optional')) {
            out.optional = !!prev.optional;
          }
          return out;
        }
        return ga;
      });
      const obj = { name: key };
      // Always include args (explicitly empty array when no args)
      obj.args = args;
      if (detail) obj.detail = detail;
      return obj;
    });

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
