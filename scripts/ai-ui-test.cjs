const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  net = require('node:net'),
  assert = require('node:assert/strict');
const { spawn } = require('node:child_process'),
  { createHash } = require('node:crypto'),
  { chromium } = require('playwright'),
  { parse } = require('smol-toml');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const {
  StreamableHTTPClientTransport,
} = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { settingsPage } = require('./settings-shell-helper.cjs'),
  { settleSettings } = require('./settings-immediate-helper.cjs');
const { freePort, inspect, electronExpression } = require('./electron-main-helper.cjs');
const root = path.resolve(__dirname, '..'),
  profile = path.join(root, '.artifacts', `ai-ui-${Date.now()}`),
  local = path.join(profile, 'local');
fs.mkdirSync(profile, { recursive: true });
const checks = [],
  requests = [];
let child, browser, host, client, server;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    await pause(50);
  }
  throw Error(label);
}
const snapshot = () => host.evaluate(() => window.dock.snapshot());
async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  if (r.isError)
    throw Object.assign(Error(r.structuredContent?.message ?? JSON.stringify(r)), {
      code: r.structuredContent?.code,
    });
  return r.structuredContent;
}
(async () => {
  try {
    server = http.createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/v1/models') {
        res.end(JSON.stringify({ data: [{ id: 'fixture-model' }] }));
        return;
      }
      let text = '';
      for await (const chunk of req) text += chunk;
      const body = JSON.parse(text);
      requests.push({ body, auth: req.headers.authorization });
      if (body.messages.at(-1).content === 'slow') {
        await pause(2000);
        if (res.destroyed) return;
      }
      res.end(
        JSON.stringify({
          choices: [
            { finish_reason: 'stop', message: { content: '架空の入力から生成した短い文章です。' } },
          ],
        }),
      );
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { newAiConnection } = require('../out/main/shared/ai');
    const settings = require('../out/main/shared/settings-schema').createDefaultSettings();
    settings.host.hardwareAcceleration = false;
    settings.host.notifications = false;
    settings.keybindings = [];
    settings.gestures.enabled = false;
    settings.ai = {
      commonPrompt: '共通の架空指示',
      defaultConnectionId: 'preview',
      connections: ['preview', 'sdk', 'mcp'].map((id) => ({
        ...newAiConnection(id),
        name: id,
        baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
        defaultModel: 'fixture-model',
        authentication: id === 'preview' ? 'bearer' : 'none',
      })),
    };
    for (const [id, dotnet] of [
      ['fixture.ai-node', false],
      ['fixture.ai-dotnet', true],
    ]) {
      const dir = path.join(profile, 'extensions', id);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'extension.json'),
        JSON.stringify({
          apiVersion: 1,
          id,
          name: id,
          version: '1.0.0',
          runtime: dotnet ? 'dotnet' : 'node',
          entry: dotnet ? 'AppDock.Extensions.AiProbe.dll' : 'index.cjs',
          ...(dotnet ? { type: 'AppDock.Extensions.AiProbe.AiProbe' } : {}),
          capabilities: ['appdock-api'],
          commands: [{ id: id + '.generate', title: 'AI probe', automation: true }],
        }),
      );
      settings.extensions[id] = { enabled: true, settings: {} };
      if (dotnet)
        fs.copyFileSync(
          path.join(
            root,
            'tests/fixtures/dotnet/AppDock.Extensions.AiProbe/bin/Release/net10.0/AppDock.Extensions.AiProbe.dll',
          ),
          path.join(dir, 'AppDock.Extensions.AiProbe.dll'),
        );
      else
        fs.writeFileSync(
          path.join(dir, 'index.cjs'),
          `exports.activate=async c=>c.commands.register('${id}.generate','AI probe',async()=>{let r;try{await c.appdock.call('ai.models.list',{connectionId:'sdk'});const j=await c.appdock.call('ai.text.generate',{connectionId:'sdk',model:'node-model',additionalPrompt:'用途の架空指示',input:'架空の入力',requestId:require('node:crypto').randomUUID()});let v;do{await new Promise(r=>setTimeout(r,50));v=await c.appdock.call('ai.jobs.get',{jobId:j.jobId});}while(['queued','running'].includes(v.state));r={ok:v.state==='completed',jobId:j.jobId};}catch(e){r={code:e.code};}await c.log.info('ai-probe:'+JSON.stringify(r));});`,
        );
    }
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
    const probe = net.createServer();
    await new Promise((r) => probe.listen(0, '127.0.0.1', r));
    const port = probe.address().port;
    await new Promise((r) => probe.close(r));
    const mainPort = await freePort();
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    let executable = require('electron'),
      args = [root];
    if (process.argv[2]) {
      executable = path.join(profile, 'AppDock.at365.exe');
      fs.copyFileSync(path.resolve(process.argv[2]), executable);
      assert.equal(
        createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),
        createHash('sha256').update(fs.readFileSync(process.argv[2])).digest('hex'),
      );
      args = [];
    }
    child = spawn(
      executable,
      [
        ...args,
        `--test-profile=${profile}`,
        `--test-local-state=${local}`,
        `--remote-debugging-port=${port}`,
        `--inspect=${mainPort}`,
      ],
      { env, cwd: profile, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    child.stderr.on('data', (b) => fs.appendFileSync(path.join(profile, 'electron.log'), b));
    browser = await until(
      () => chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 1000 }),
      'CDP',
    );
    host = await until(
      () =>
        browser
          .contexts()
          .flatMap((c) => c.pages())
          .find((p) => p.url().startsWith('appdock://host/')),
      'host',
    );
    host.setDefaultTimeout(15000);
    await until(async () => {
      const s = await snapshot();
      return (
        s.startupReady &&
        s.extensions
          .filter((e) => e.id.startsWith('fixture.ai-'))
          .every((e) => e.state === 'running')
      );
    }, 'startup');
    await host.evaluate(() => window.dock.executeCommand('appdock.settings.open'));
    let page = await settingsPage(host);
    await page.getByRole('button', { name: 'AI', exact: true }).click();
    await page.getByLabel('共通プロンプト', { exact: true }).waitFor();
    assert.equal(
      await page.getByLabel('共通プロンプト', { exact: true }).inputValue(),
      '共通の架空指示',
    );
    await page.getByLabel('AIのAPIキー', { exact: true }).fill('fixture-ai-secret');
    await page.getByRole('button', { name: 'AIのAPIキーを設定', exact: true }).click();
    await until(() => fs.existsSync(path.join(local, 'ai-keys.json')), 'key saved');
    assert(
      !fs.readFileSync(path.join(local, 'ai-keys.json'), 'utf8').includes('fixture-ai-secret'),
    );
    assert(
      !JSON.stringify(await page.evaluate(() => window.appdockPage.connect())).includes(
        'fixture-ai-secret',
      ),
    );
    await page.getByLabel('このPCでAI接続を使用', { exact: true }).click();
    await until(
      async () =>
        JSON.parse(fs.readFileSync(path.join(local, 'ai-access.json'), 'utf8')).entries.preview,
      'approval saved',
    );
    await page.getByRole('button', { name: 'モデル一覧を更新', exact: true }).click();
    await page.getByText('1件のモデルを取得しました。', { exact: true }).waitFor();
    await page.getByLabel('試験のAIモデル', { exact: true }).fill('override-model');
    await page.getByLabel('試験の追加プロンプト', { exact: true }).fill('用途別の架空指示');
    await page.getByLabel('試験の入力データ', { exact: true }).fill('架空の入力');
    await page.getByRole('button', { name: '文章を生成', exact: true }).click();
    await page.getByText('架空の入力から生成した短い文章です。', { exact: true }).waitFor();
    assert.equal(requests[0].body.model, 'override-model');
    assert.equal(requests[0].auth, 'Bearer fixture-ai-secret');
    assert.equal(requests[0].body.messages[1].content, '架空の入力');
    checks.push('settings, encrypted key, approval, models and override generation');
    for (const id of ['sdk', 'mcp']) {
      await page.getByLabel('編集するAI接続', { exact: true }).selectOption(id);
      await page.getByLabel('このPCでAI接続を使用', { exact: true }).click();
      await until(
        () => JSON.parse(fs.readFileSync(path.join(local, 'ai-access.json'), 'utf8')).entries[id],
        id + ' approved',
      );
    }
    await host.evaluate(() =>
      window.dock.setAppletApiPermissions({ read: true, execute: true, useAi: true }),
    );
    for (const id of ['fixture.ai-node', 'fixture.ai-dotnet']) {
      await host.evaluate((id) => window.dock.executeCommand(id + '.generate'), id);
      const result = await until(async () => {
        const log = (await snapshot()).logs.find(
          (l) => l.source === id && l.message.startsWith('ai-probe:'),
        );
        return log && JSON.parse(log.message.slice(9));
      }, id + ' result');
      assert.equal(result.ok, true);
      checks.push(id + ' real SDK/RPC generated');
    }
    assert(requests.some((r) => r.body.model === 'node-model'));
    assert(requests.some((r) => r.body.model === 'dotnet-model'));
    const configFile = path.join(profile, 'config.toml');
    fs.writeFileSync(configFile, '');
    await host.evaluate(async (configFile) => {
      await window.dock.automation({ kind: 'selectConfig', file: configFile });
      await window.dock.automation({
        kind: 'configure',
        enabled: true,
        allowWrite: false,
        port: 0,
      });
      await window.dock.automation({ kind: 'setExecution', allowed: true });
      await window.dock.automation({ kind: 'register' });
    }, configFile);
    const mcp = (await host.evaluate(() => window.dock.automation({ kind: 'status' }))).state;
    const headers = parse(fs.readFileSync(configFile, 'utf8')).mcp_servers[mcp.serverId]
      .http_headers;
    client = new Client({ name: 'AI integration', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(mcp.endpoint), { requestInit: { headers } }),
    );
    const tools = (await client.listTools()).tools;
    for (const name of [
      'appdock_ai_generate_text',
      'appdock_ai_get_job',
      'appdock_ai_cancel_job',
      'appdock_ai_list_models',
    ])
      assert(tools.some((t) => t.name === name));
    const denied = await client.callTool({
      name: 'appdock_ai_generate_text',
      arguments: { requestId: 'denied', connectionId: 'mcp', input: '架空の入力' },
    });
    assert.equal(denied.isError, true);
    assert.equal(denied.structuredContent.code, 'API_DISABLED');
    await host.evaluate(() => window.dock.automation({ kind: 'setAi', allowed: true }));
    assert.equal(
      (await call('appdock_ai_list_models', { connectionId: 'mcp' })).models[0].id,
      'fixture-model',
    );
    const request = {
      requestId: 'mcp-one',
      connectionId: 'mcp',
      model: 'mcp-model',
      additionalPrompt: 'MCPの用途指示',
      input: '架空の入力',
    };
    const accepted = await call('appdock_ai_generate_text', request);
    assert.equal((await call('appdock_ai_generate_text', request)).jobId, accepted.jobId);
    await until(
      async () =>
        (await call('appdock_ai_get_job', { jobId: accepted.jobId })).state === 'completed',
      'MCP completed',
    );
    const log = (await snapshot()).logs.find(
      (l) => l.source === 'fixture.ai-node' && l.message.startsWith('ai-probe:'),
    );
    const foreign = JSON.parse(log.message.slice(9)).jobId;
    const foreignReply = await client.callTool({
      name: 'appdock_ai_get_job',
      arguments: { jobId: foreign },
    });
    assert.equal(foreignReply.structuredContent.code, 'NOT_FOUND');
    const cancel = await call('appdock_ai_generate_text', {
      requestId: 'mcp-cancel',
      connectionId: 'mcp',
      input: 'slow',
    });
    assert.equal((await call('appdock_ai_cancel_job', { jobId: cancel.jobId })).state, 'canceled');
    checks.push(
      'MCP discovery, separate permission, generate/get/cancel, deduplication and owner isolation',
    );
    await host.evaluate(() => window.dock.automation({ kind: 'setAi', allowed: false }));
    const revoked = await client.callTool({
      name: 'appdock_ai_get_job',
      arguments: { jobId: accepted.jobId },
    });
    assert.equal(revoked.structuredContent.code, 'NOT_FOUND');
    await host.evaluate(() => window.dock.automation({ kind: 'setAi', allowed: true }));
    await host.evaluate(async () => {
      await window.dock.automation({ kind: 'rotateToken' });
      await window.dock.automation({ kind: 'register' });
    });
    await client.close();
    const rotatedHeaders = parse(fs.readFileSync(configFile, 'utf8')).mcp_servers[mcp.serverId]
      .http_headers;
    client = new Client({ name: 'AI integration after rotation', version: '1' });
    await client.connect(
      new StreamableHTTPClientTransport(new URL(mcp.endpoint), {
        requestInit: { headers: rotatedHeaders },
      }),
    );
    const oldJob = await client.callTool({
      name: 'appdock_ai_get_job',
      arguments: { jobId: accepted.jobId },
    });
    assert.equal(oldJob.structuredContent.code, 'NOT_FOUND');
    checks.push('MCP permission revocation and token rotation reclaim prior jobs');
    await page.getByLabel('編集するAI接続', { exact: true }).selectOption('preview');
    await page.getByLabel('試験の入力データ', { exact: true }).fill('slow');
    await page.getByRole('button', { name: '文章を生成', exact: true }).click();
    await until(async () => {
      const m = (await page.evaluate(() => window.appdockPage.connect())).snapshot;
      return m.content.auxiliary.ai.jobs.at(-1)?.state === 'running';
    }, 'slow started');
    await page.getByLabel('共通プロンプト', { exact: true }).fill('変更後の共通方針');
    await settleSettings(page);
    await until(async () => {
      const m = (await page.evaluate(() => window.appdockPage.connect())).snapshot;
      return m.content.auxiliary.ai.jobs.at(-1)?.state === 'canceled';
    }, 'old prompt canceled');
    await page
      .getByLabel('AIのAPIのURL', { exact: true })
      .fill(`http://127.0.0.1:${server.address().port}/changed/v1`);
    await page.getByLabel('AIのAPIのURL', { exact: true }).press('Enter');
    await settleSettings(page);
    await until(
      async () =>
        (await page
          .getByLabel('このPCでAI接続を使用', { exact: true })
          .getAttribute('aria-checked')) === 'false',
      'URL change loses approval',
    );
    checks.push('common prompt cancels old jobs and URL change invalidates approval');
    for (const [theme, width] of [
      ['dark', 1280],
      ['light', 760],
    ]) {
      await host.evaluate(
        async ({ theme, width }) => {
          const s = await window.dock.snapshot();
          await window.dock.saveSettings(
            { ...s.settings.value, host: { ...s.settings.value.host, theme } },
            s.settings.revision,
          );
        },
        { theme, width },
      );
      // Resize the actual native window via CDP, as in the existing settings tests.
      await inspect(
        mainPort,
        electronExpression +
          `.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('appdock://host/')).setSize(${width},850)`,
      );
      await pause(300);
      await page.screenshot({ path: path.join(profile, `${theme}-${width}.png`) });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      );
      assert.equal(overflow, false);
    }
    assert(!JSON.stringify((await snapshot()).logs).includes('fixture-ai-secret'));
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify({ ok: true, checks, requests: requests.length }, null, 2),
    );
    console.log(JSON.stringify({ ok: true, profile, checks }));
  } catch (e) {
    fs.writeFileSync(path.join(profile, 'failure.txt'), e.stack ?? String(e));
    fs.writeFileSync(
      path.join(profile, 'result.json'),
      JSON.stringify({ ok: false, checks }, null, 2),
    );
    console.error(e.stack ?? e);
    console.log('Profile: ' + profile);
    process.exitCode = 1;
  } finally {
    await client?.close().catch(() => {});
    if (host) await host.evaluate(() => window.dock.executeCommand('appdock.quit')).catch(() => {});
    if (child) {
      try {
        await until(() => child.exitCode !== null, 'shutdown', 15000);
      } catch {
        child.kill();
        await pause(400);
      }
    }
    await browser?.close().catch(() => {});
    await new Promise((r) => {
      if (server) {
        server.close(r);
        server.closeAllConnections();
      } else r();
    });
  }
})();
