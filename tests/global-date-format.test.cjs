const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
function loader() {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(file);
    if (!path.extname(file)) file += fs.existsSync(file + '.tsx') ? '.tsx' : '.ts';
    if (cache.has(file)) return cache.get(file);
    const out = {}; cache.set(file, out);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }}).outputText;
    const scoped = name => {
      if (name.endsWith('.module.css')) return {__esModule: true, default: {}};
      if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    };
    new Function('require', 'exports', code)(scoped, out);
    return out;
  };
}
const load = loader(), dates = load('src/lib/date-format.ts'), civil = load('src/lib/calendar-date.ts');
for (const value of ['2024-02-29', '2000-02-29', '2026-04-30', '2026-12-31']) {
  test(`civil display and strict manual round trip: ${value}`, () => {
    const display = value.split('-').reverse().join('/');
    assert.equal(dates.formatDisplayDate(value), display);
    assert.equal(civil.parseCalendarDisplay(display), value);
  });
}
for (const value of ['31/04/2026', '29/02/1900', '29/02/2025', '00/01/2026', '01/13/2026', '1/2/2026', '2026-02-01', '01-02-2026', '01/02/20260']) {
  test(`invalid display never becomes an API date: ${value}`, () => assert.equal(civil.parseCalendarDisplay(value), ''));
}
test('missing, malformed, overflow and legacy sentinel dates have safe fallbacks', () => {
  for (const value of [null, undefined, '', 'not-a-date', '0001-01-01', '2026-02-31', '2026-02-31T12:00:00Z', new Date(NaN), {}, {toDate() {throw Error('bad stamp');}}]) {
    assert.equal(dates.formatDisplayDate(value), '—');
    assert.equal(dates.formatDisplayDateTime(value, {}, 'Not recorded'), 'Not recorded');
  }
});
test('instants respect India and explicitly configured property timezones', () => {
  const value = '2026-01-31T20:00:00Z';
  assert.equal(dates.formatDisplayDateTime(value), '01/02/2026 01:30 am');
  assert.equal(dates.formatDisplayDateTime(value, {timeZone: 'America/Los_Angeles', hour12: false}), '31/01/2026 12:00');
  assert.equal(dates.formatDisplayDate(value, {timeZone: 'not-a-zone'}), '01/02/2026');
  assert.equal(dates.formatDisplayDateTime(value, {timeStyle: 'short'}), '01/02/2026 01:30 am');
});
test('civil dates never shift with the execution timezone', () => {
  const old = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Asia/Kolkata', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = tz;
      assert.equal(dates.formatDisplayDate('2024-03-10'), '10/03/2024');
      assert.equal(dates.formatDisplayDateTime('2024-03-10'), '10/03/2024');
      assert.equal(civil.parseCalendarDisplay('10/03/2024'), '2024-03-10');
    }
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
test('Date and Firestore timestamp representations are display-only and unchanged', () => {
  const date = new Date('2026-01-31T20:00:00Z'), before = date.getTime();
  const stamp = {seconds: before / 1000, nanoseconds: 0};
  for (const value of [date, before, stamp, {_seconds: stamp.seconds}, {toDate: () => date}]) assert.equal(dates.formatDisplayDate(value), '01/02/2026');
  assert.equal(date.getTime(), before);
  assert.deepEqual(stamp, {seconds: before / 1000, nanoseconds: 0});
});
test('shared form inputs show slashes but named values stay canonical', () => {
  const {DatePicker} = load('src/ui/date-picker.tsx');
  const html = renderToStaticMarkup(React.createElement(DatePicker, {name:'agreementStartDate',value:'2024-02-29',required:true}));
  assert.match(html, /type="text"/);
  assert.match(html, /placeholder="DD\/MM\/YYYY"/);
  assert.match(html, /value="29\/02\/2024"/);
  assert.match(html, /type="hidden" name="agreementStartDate" value="2024-02-29"/);
  assert.match(html, /required=""/);
  assert.doesNotMatch(html, /type="date"/);
});
test('billing month retains month-only granularity and storage representation', () => {
  assert.equal(dates.formatDisplayMonth('2026-11'), '11/2026');
  assert.equal(dates.formatDisplayMonth('2026-13'), '—');
  const {CalendarInput} = load('src/ui/date-picker.tsx');
  const html = renderToStaticMarkup(React.createElement(CalendarInput, {type:'month',name:'month',value:'2026-11'}));
  assert.match(html, /value="11\/2026"/);
  assert.match(html, /name="month" value="2026-11"/);
});
test('formatting does not change agreement periods or applicable rent', () => {
  const rent = load('src/lib/rent-schedule.ts'), resolver = load('src/lib/rent-resolution.ts');
  const start = civil.parseCalendarDisplay('01/01/2026'), end = rent.calculateAgreementEndDate(start, 24);
  assert.equal(end, '2027-12-31');
  const rows = rent.initializeRentSchedule([], start, end, '30000').map((r, i) => ({...r, amount:i?'36000':'30000'}));
  const before = JSON.stringify(rows), record = {monthlyRent:'30000',rentSchedule:rows};
  rows.forEach(row => { dates.formatDisplayDate(row.fromDate); dates.formatDisplayDate(row.toDate); });
  assert.equal(JSON.stringify(rows), before);
  assert.equal(resolver.resolveRent(record, '2026-12-31').amount, '30000');
  assert.equal(resolver.resolveRent(record, '2027-01-01').amount, '36000');
});
test('property termination submits canonical dates rather than formatted labels', () => {
  const source = fs.readFileSync('src/features/properties/PropertyDetails.tsx', 'utf8');
  assert.match(source, /const formattedStartDate = noticeStartDate;/);
  assert.match(source, /const startDate = parseCalendarDate\(noticeStartDate\)/);
  assert.match(source, /terminationDate = calendarValue\(calculatedDate\)/);
  assert.match(source, /noticeStartDate: formattedStartDate/);
  const start = civil.parseCalendarDate(civil.parseCalendarDisplay('01/11/2026'));
  start.setMonth(start.getMonth() + 1);
  assert.equal(civil.calendarValue(start), '2026-12-01');
});
test('email visit template uses centralized date-time formatting', () => {
  const {isolated, users} = require('./fixtures/native-server.cjs');
  const app = isolated({users});
  assert.equal(app.load('@/lib/server/services/group2-mail').formatIST(new Date('2026-11-18T06:30:00Z')), '18/11/2026 12:00 pm IST');
});
test('UI audit prevents locale-dependent full dates or native date controls reappearing', () => {
  function audit(dir) {
    for (const file of fs.readdirSync(dir, {withFileTypes:true})) {
      const name = path.join(dir, file.name);
      if (file.isDirectory()) audit(name);
      else if (name.endsWith('.tsx')) {
        const source = ts.createSourceFile(name, fs.readFileSync(name, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node) {
          if (!name.endsWith(path.join('ui','calendar.tsx')) && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
            assert.notEqual(node.expression.name.text, 'toLocaleDateString', name);
            assert.notEqual(node.expression.name.text, 'toLocaleTimeString', name);
          }
          if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
            if (node.tagName.getText(source) === 'input') for (const attr of node.attributes.properties) {
              if (ts.isJsxAttribute(attr) && attr.name.getText(source) === 'type' && attr.initializer && ts.isStringLiteral(attr.initializer)) assert.ok(!['date','datetime-local'].includes(attr.initializer.text), name);
            }
          }
          ts.forEachChild(node, visit);
        }
        visit(source);
      }
    }
  }
  audit('src');
});
