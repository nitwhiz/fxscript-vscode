/*
  Generate data/movescript.json from Go sources.

  Usage:
    node scripts/generate-movescript-json.js <folder>
*/

const fs = require('fs');
const path = require('path');

// Config
const INPUT_PARSER_LOOKUP_FILENAME = 'parser_defines_lookup.go';
const INPUT_RUNTIME_FILENAME = 'runtime.go';
// Interface names to read method comments from
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

      let args = [];
      if (paramsRaw.length > 0) {
        // Split by commas not inside anything (simple: no generics in Go types here)
        const parts = paramsRaw.split(/\s*,\s*/);
        for (const p of parts) {
          // Two Go parameter declaration styles appear:
          //  - name type  (e.g., variable Variable)
          //  - multiple names share a type (rare in interfaces; ignore for now)
          //  - single name with type
          const m = p.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);
          if (m) {
            const paramName = m[1];
            const goType = m[2].trim();
            // If it looks like multiple names with one type: a, b Variable
            const multi = paramName.includes(' ');
            if (!multi) {
              const mapped = mapGoTypeToArg(paramName, goType);
              if (mapped) args.push({ name: paramName, type: mapped });
            }
          } else {
            // If no type given (shouldn't happen here), skip
          }
        }
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

function main() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error('Usage: node scripts/generate-movescript-json.js <folder>');
    process.exit(1);
  }

  const inputDir = path.resolve(process.cwd(), folderArg);
  const parserLookupPath = path.join(inputDir, INPUT_PARSER_LOOKUP_FILENAME);
  const runtimePath = path.join(inputDir, INPUT_RUNTIME_FILENAME);

  const parserSrc = readFileText(parserLookupPath);
  const runtimeSrc = readFileText(runtimePath);

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

  // Build commands array: { name, detail? }
  // Special cases: ignore synthetic entries used differently in runtime
  // - "count" (CmdCount)
  // - "none"  (CmdNone)
  const commands = cmdEntries
    .filter(({ key }) => key !== 'count' && key !== 'none')
    .map(({ key, value }) => {
      // value is like CmdNop; use it to find a comment in interface
      const methodName = value.replace(/\s+/g, '');
      const meta = methodMeta.get(methodName) || {};
      const detail = meta.detail || '';
      const args = Array.isArray(meta.args) ? meta.args : [];
      const obj = { name: key };
      // Always include args (explicitly empty array when no args)
      obj.args = args;
      if (detail) obj.detail = detail;
      return obj;
    });

  const result = { commands, flags, identifiers, variables };

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
