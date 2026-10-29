const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const output = {};
const code = ts.transpileModule(fs.readFileSync('src/lib/api-response.ts', 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
}).outputText;
new Function('exports', code)(output);
const {readApiResponse} = output;

test('API reader preserves successful records and structured failure messages', async () => {
  const records = {success: true, connections: [{id: 'pending'}]};
  assert.deepEqual(await readApiResponse(Response.json(records), 'Load failed'), records);
  await assert.rejects(readApiResponse(Response.json({success: false, message: 'Verify your email'}, {status: 403}), 'Load failed'), /Verify your email/);
  await assert.rejects(readApiResponse(Response.json({success: false, message: 'Connection changed'}), 'Load failed'), /Connection changed/);
});

test('API reader handles plain text, HTML, empty and malformed responses without parsing errors', async () => {
  for (const body of ['Internal server error', '<html>Bad gateway</html>', '', '{broken']) {
    await assert.rejects(readApiResponse(new Response(body, {status: 502}), 'Connections unavailable'), {message: 'Connections unavailable (HTTP 502)'});
  }
  for (const body of ['null', '[]', '"unexpected"']) {
    await assert.rejects(readApiResponse(new Response(body), 'Invalid response'), {message: 'Invalid response (HTTP 200)'});
  }
});
