// Verification of the no-fabrication guards in src/lib/extract.ts.
// Dependency-free: `node dissect.verify.mjs` (Node 24+ strips TS types) / `npm test`.
import { numAppears, snippetInText } from './src/lib/guards.ts';

let fails = 0;
const ok = (cond, label) => { if (!cond) fails++; console.log(`${cond ? '✓' : '✗ FAIL'}  ${label}`); };

const abstract = 'Using a sample of N = 1,698 nurses, engagement correlated with performance (r = .34, p < .001). Analyses used structural equation modeling in Mplus.';

console.log('— numAppears: trust a number only if it is verbatim in the text —');
ok(numAppears(0.34, abstract), '.34 reported as "r = .34" → found');
ok(numAppears(1698, abstract), '1698 reported as "1,698" → found (thousands sep)');
ok(numAppears(0.001, abstract), '.001 reported as "p < .001" → found');
ok(!numAppears(0.42, abstract), '0.42 NOT in text → rejected (would be fabricated)');
ok(!numAppears(2500, abstract), '2500 NOT in text → rejected');
ok(numAppears(0.3, '... beta of 0.30 ...'), '0.3 matches "0.30" (trailing zero)');

console.log('— snippetInText: evidence must occur in the source —');
ok(snippetInText('structural equation modeling in Mplus', abstract), 'verbatim phrase → found');
ok(snippetInText('Structural   Equation  Modeling', abstract), 'spacing/case-insensitive → found');
ok(!snippetInText('hierarchical linear modeling in R', abstract), 'phrase not present → not found (flagged unverified)');
ok(!snippetInText('the', abstract), 'too-short snippet → not accepted as evidence');

console.log(fails === 0 ? '\n✅ ALL PASS' : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
