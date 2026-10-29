const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');

// Exercise actual component event handlers without a browser or network.
function harness() {
  const state = [], cache = new Map(), submitted = [];
  let cursor = 0;
  const service = {createVisit: async body => {submitted.push(body); return {...body, id: 'saved'};}};
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const output = {}; cache.set(file, output);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    }}).outputText;
    const scopedRequire = name => {
      if (name === 'react') return {...require('react'),
        useState: initial => {const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => {state[index] = typeof value === 'function' ? value(state[index]) : value;}];},
        useEffect: () => {}, useCallback: fn => fn, useRef: initial => ({current: initial}),
      };
      if (name === '@/lib/navigation') return {useLocation: () => ({search: ''})};
      if (name === '@/contexts/AuthContext') return {useAuth: () => ({user: {uid: 'requester'}, loading: false})};
      if (name === '@/hooks/use-toast') return {useToast: () => ({toast: () => {}})};
      if (name === '@/services/visitService') return {visitService: service};
      if (name === '@/services/propertyService') return {propertyService: {}};
      if (name.startsWith('@/ui/')) return new Proxy({}, {get: (_, key) => key === '__esModule' ? false : String(key)});
      if (name.endsWith('.module.css')) return new Proxy({}, {get: (_, key) => String(key)});
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
      return require(name);
    };
    new Function('require', 'exports', code)(scopedRequire, output);
    return output;
  }
  const Planner = load('src/features/visit-planner/VisitPlanner.tsx').default;
  return {load, submitted, render: (Component = Planner, props = {}) => {cursor = 0; return Component(props);}};
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
const find = (tree, predicate) => nodes(tree).find(predicate);
function open(app) {
  find(app.render(), node => node.type === 'Button' && JSON.stringify(node.props.children).includes('Schedule New Visit')).props.onClick();
  return app.render();
}
const submit = tree => find(tree, node => node.type === 'form').props.onSubmit({preventDefault() {}});
function change(app, field, value) {
  const tree = app.render();
  if (field === 'date') find(tree, node => node.type === 'DatePicker').props.onChange(value);
  else if (field === 'time') find(tree, node => node.type === 'TimePicker').props.onChange(value);
  else find(tree, node => node.props.id === field).props.onChange({target: {value}});
}

test('missing fields get individual errors; valid corrections clear only their errors', async () => {
  const app = harness(); await submit(open(app));
  let tree = app.render();
  for (const id of ['title', 'date', 'time']) {
    assert.equal(find(tree, node => node.props.id === id).props['aria-invalid'], true);
    assert.ok(find(tree, node => node.props.id === `${id}-error`));
  }
  assert.equal(find(tree, node => node.props.id === 'description').props['aria-invalid'], undefined);
  change(app, 'time', '15:30'); tree = app.render();
  assert.equal(find(tree, node => node.type === 'TimePicker').props.value, '15:30');
  assert.equal(find(tree, node => node.props.id === 'time').props['aria-invalid'], false);
  assert.equal(find(tree, node => node.props.id === 'title').props['aria-invalid'], true);
  assert.equal(app.submitted.length, 0);
});

test('valid general visit submits controlled values with optional details and 30-minute email reminder', async () => {
  const app = harness(); open(app);
  change(app, 'title', '  General consultation  ');
  change(app, 'date', '2099-06-15'); change(app, 'time', '15:30');
  change(app, 'description', 'Meet at reception');
  await submit(app.render());
  assert.deepEqual(app.submitted, [{title: 'General consultation', description: 'Meet at reception', visitDate: new Date('2099-06-15T15:30').toISOString(), reminderType: 'email', reminderTime: 30}]);
});

test('validation rejects whitespace, invalid calendar dates/times and past times without requiring property or details', () => {
  const {validateVisitForm, localDateValue} = harness().load('src/features/visit-planner/visit-form.ts');
  const now = new Date(2099, 5, 15, 12, 0);
  const form = {title: 'Consultation', date: '2099-06-15', time: '15:30', propertyId: '', description: ''};
  assert.deepEqual(validateVisitForm(form, now), {});
  for (const [patch, expected] of [[{title: '  '}, 'title'], [{date: '2099-02-30'}, 'date'], [{date: '2099-06-14'}, 'date'], [{time: '25:00'}, 'time'], [{time: '12:00'}, 'time']]) {
    assert.deepEqual(Object.keys(validateVisitForm({...form, ...patch}, now)), [expected]);
  }
  assert.equal(localDateValue(new Date(2099, 5, 15, 0, 1)), '2099-06-15');
});

test('every time selection path emits controlled HH:mm values without submitting the form', () => {
  const app = harness(), {TimePicker} = app.load('src/ui/time-picker.tsx');
  let value = '';
  const render = () => app.render(TimePicker, {value, onChange: next => {value = next;}, required: true, id: 'time', 'aria-invalid': true, 'aria-describedby': 'time-error'});
  let tree = render();
  const trigger = find(tree, node => node.props.id === 'time');
  assert.equal(trigger.props['aria-invalid'], true); assert.equal(trigger.props['aria-required'], true);
  for (const button of nodes(tree).filter(node => node.type === 'Button')) assert.equal(button.props.type, 'button');
  find(tree, node => node.type === 'Button' && node.props.children === '3:00 PM').props.onClick(); assert.equal(value, '15:00');
  tree = render(); find(tree, node => node.type === 'Input' && node.props.type === 'time').props.onChange({target: {value: '10:45'}}); assert.equal(value, '10:45');
  tree = render(); find(tree, node => node.type === 'Button' && node.props.children === '10:30 AM').props.onClick(); assert.equal(value, '10:30');
  tree = render(); find(tree, node => node.type === 'Button' && node.props.children === '12:00 AM').props.onClick(); assert.equal(value, '00:00');
});
