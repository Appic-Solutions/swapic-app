// Fails when UI code shows a word the app must never show (spec section 2, plan rule 4),
// an em dash, or a hyphen used as a separator. It reads only what a person can see: JSX text
// and string literals in UI folders, never identifiers or API field names.
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// the one exception is the slow route, named on purpose so a user knows why it takes 20 minutes: "ckETH minter" as shown,
// `ckMinter` as the route id is read
export const BANNED = [
  /\bshares?\b/i, /\bcircle\b/i, /\bcctp\b/i, /\beco\b/i, /\bck minter\b/i, /(?<!ckETH )\bminter\b/i,
  /\brebalanc/i, /\bpockets?\b/i, /\boperator\b/i, /\bkyber/i, /\bicpswap\b/i, /\bintent\b/i, /\brails?\b/i,
];
const EM_DASH = /—/;
const SEPARATOR = /\s-\s/;
const UI_DIRS = ['src/app', 'src/components', 'src/features', 'src/lib/copy'];

/** Every visible text in `source`: JSX text and string or template literal parts. */
export function visibleTexts(source, fileName = 'x.tsx') {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxText(node)) out.push(node.getText());
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const isKey = parent && ts.isPropertyAssignment(parent) && parent.name === node;
      // `{ name: 'field', type: 'uint256' }`: an EIP-712 or ABI field definition; its name is a protocol identifier
      const isFieldName = parent && ts.isPropertyAssignment(parent) && parent.name.getText() === 'name' && parent.initializer === node
        && ts.isObjectLiteralExpression(parent.parent)
        && parent.parent.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'type' && ts.isStringLiteral(p.initializer));
      // `'Variant' in value`: a key name tested, never shown (candid variants are objects keyed by their name)
      const isInKey = parent && ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.InKeyword && parent.left === node;
      const isClass = parent && ts.isJsxAttribute(parent) && parent.name.getText() === 'className';
      if (!isKey && !isClass && !isInKey && !isFieldName) out.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      out.push(node.head.text, ...node.templateSpans.map((s) => s.literal.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

export function problems(texts) {
  const found = [];
  for (const t of texts) {
    for (const re of BANNED) if (re.test(t)) found.push(`banned word ${re} in "${t.trim()}"`);
    if (EM_DASH.test(t)) found.push(`em dash in "${t.trim()}"`);
    if (SEPARATOR.test(t)) found.push(`hyphen separator in "${t.trim()}"`);
  }
  return found;
}

function* files(dir) {
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx?|mjs)$/.test(n) && !/\.test\./.test(n)) yield p;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  let bad = 0;
  for (const dir of UI_DIRS) {
    for (const f of files(join(root, dir))) {
      for (const p of problems(visibleTexts(readFileSync(f, 'utf8'), f))) {
        bad++;
        console.log(`${relative(root, f)}: ${p}`);
      }
    }
  }
  if (bad) { console.log(`${bad} copy problem(s)`); process.exit(1); }
  console.log('copy ok');
}
