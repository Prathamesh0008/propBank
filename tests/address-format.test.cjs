const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const exportsObject = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/address-format.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText)(exportsObject);
const {formatAddress} = exportsObject;

test('optional components never produce leading, trailing or duplicate separators', () => {
  assert.equal(formatAddress(null, undefined, '', '  ', ' Pune ', '', ' Maharashtra ', null), 'Pune, Maharashtra');
  assert.equal(formatAddress(', , Pune,, ', ', Maharashtra, ', ' 411001 '), 'Pune, Maharashtra, 411001');
  assert.equal(formatAddress('', null, undefined, ' , , '), '');
  assert.equal(formatAddress('Mumbai'), 'Mumbai');
});
test('formatter preserves component ordering, meaningful punctuation and source data', () => {
  const parts = [' Flat 4/B ', 'Sector-2, Pune', null, ' Maharashtra ', 411001];
  const before = [...parts];
  assert.equal(formatAddress(...parts), 'Flat 4/B, Sector-2, Pune, Maharashtra, 411001');
  assert.deepEqual(parts, before);
  assert.equal(formatAddress({}, false, NaN), '');
});
test('property card renders a clean address through the shared formatter', () => {
  const out = {};
  const code = ts.transpileModule(fs.readFileSync('src/features/properties/PropertyCard.tsx', 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
  }).outputText;
  new Function('exports', 'require', code)(out, name => {
    if (name === '@/lib/address-format') return exportsObject;
    if (name.startsWith('@/ui/')) return new Proxy({}, {get: () => ({children}) => React.createElement('div', null, children)});
    return require(name);
  });
  const html = renderToStaticMarkup(React.createElement(out.default, {property: {
    id: 'P', title: 'Home', price: '1000', type: 'rent', location: ', Pune, , Maharashtra, ',
  }}));
  assert.match(html, />Pune, Maharashtra<\/p>/);
  assert.doesNotMatch(html, />,|, </);
});
test('both Manage Property relationship cards avoid unconditional address separators', () => {
  const source = fs.readFileSync('src/features/properties/ManageProperty.tsx', 'utf8');
  assert.equal((source.match(/\{formatAddress\(property.address\)\}/g) || []).length, 2);
  assert.ok(!source.includes('`, ${property.address}`'));
});
