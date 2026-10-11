const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDefaultSettings } = require('../out/main/shared/settings-schema');
const { SettingsEditingSession } = require('../out/main/main/core/settings-editing-session');
const {
  settingsCatalog,
  settingsProjection,
  applySettingsJson,
  searchSettings,
  settingsItemId,
} = require('../out/main/shared/settings-catalog');
const applets = [
  {
    id: 'test.a.b',
    displayName: 'Fixture',
    runtime: 'node',
    settings: [
      { key: 'x.y', title: 'Interval', description: 'Polling seconds', type: 'number', minimum: 0 },
    ],
    pages: [{ id: 'main', title: 'Main' }],
    settingActions: [],
  },
];
function fixture() {
  let saved = { value: createDefaultSettings(), revision: 1, path: 'test' };
  let fail = false,
    saves = 0,
    confirm = true;
  const session = new SettingsEditingSession({
    current: () => saved,
    applets: () => applets,
    save: async (value, revision) => {
      if (fail) throw Error('disk failure');
      if (revision !== saved.revision) throw Error('revision conflict');
      saves++;
      return (saved = { ...saved, value, revision: revision + 1 });
    },
    confirmDiscard: async () => confirm,
    changed: () => {},
  });
  const act = (action, operationId = crypto.randomUUID()) => {
    const s = session.snapshot();
    return session.act({
      sessionId: s.sessionId,
      editRevision: s.editRevision,
      operationId,
      action,
    });
  };
  return {
    session,
    act,
    get saved() {
      return saved;
    },
    get saves() {
      return saves;
    },
    set fail(v) {
      fail = v;
    },
    set confirm(v) {
      confirm = v;
    },
    external() {
      saved = {
        ...saved,
        revision: saved.revision + 1,
        value: { ...saved.value, profile: { ...saved.value.profile, name: 'External' } },
      };
    },
  };
}
test('editing retains invalid JSON, failed save, external conflict, avatar and confirmed discard', async () => {
  const f = fixture();
  await f.act({ type: 'select-page', pageId: 'profile' });
  await f.act({ type: 'mode', value: 'json' });
  await f.act({ type: 'partial-text', pageId: 'profile', value: '{broken' });
  await assert.rejects(f.act({ type: 'mode', value: 'form' }), /JSON/);
  await assert.rejects(f.act({ type: 'save' }), /JSON/);
  assert.equal(f.session.snapshot().text, '{broken');
  await f.act({
    type: 'partial-text',
    pageId: 'profile',
    value: JSON.stringify({ profile: { name: 'Draft', avatar: null } }),
  });
  await f.act({ type: 'avatar', bytes: new Uint8Array([137, 80]), name: 'test.png' });
  f.fail = true;
  await assert.rejects(f.act({ type: 'save' }), /disk failure/);
  assert.equal(f.session.snapshot().draft.profile.name, 'Draft');
  assert.equal(f.session.snapshot().avatarChanged, true);
  f.fail = false;
  f.external();
  await assert.rejects(f.act({ type: 'save' }), /revision conflict/);
  f.confirm = false;
  await f.act({ type: 'discard' });
  assert.equal(f.session.snapshot().dirty, true);
  f.confirm = true;
  await f.act({ type: 'discard' });
  assert.equal(f.session.snapshot().draft.profile.name, 'External');
  assert.equal(f.session.snapshot().avatarChanged, false);
});
test('editing rejects stale writes and replays operation once', async () => {
  const f = fixture(),
    s = f.session.snapshot();
  await f.act({ type: 'draft', value: { ...s.draft, profile: { name: 'One', avatar: null } } });
  await assert.rejects(
    f.session.act({
      sessionId: s.sessionId,
      editRevision: s.editRevision,
      operationId: 'stale',
      action: { type: 'draft', value: s.draft },
    }),
    /別の画面/,
  );
  const id = crypto.randomUUID();
  await f.act({ type: 'save' }, id);
  await f.act({ type: 'save' }, id);
  assert.equal(f.saves, 1);
  f.external();
  assert.equal(f.session.snapshot().draft.profile.name, 'External');
});
test('all JSON pages round-trip only selected ranges; unknown owners, leaves and order survive', () => {
  const value = createDefaultSettings();
  value.extensions['test.a.b'] = {
    enabled: true,
    settings: { 'x.y': 3, unknown: 'keep' },
    pages: { main: { display: 'page' }, unknown: { display: 'window' } },
    updateSource: 'github:a/b',
  };
  value.extensions['missing.owner'] = { enabled: false, settings: { secret: 'keep' } };
  value.host.unknown = 'keep';
  value.profile.extra = 'keep';
  const catalog = settingsCatalog(applets, value);
  for (const page of catalog.filter((p) => p.json)) {
    const projected = settingsProjection(value, page, applets);
    const next = applySettingsJson(value, page, applets, JSON.stringify(projected));
    assert.deepEqual(next.extensions['missing.owner'], value.extensions['missing.owner']);
    assert.equal(next.host.unknown, 'keep');
    assert.equal(next.profile.extra, 'keep');
  }
  const page = catalog.find((p) => p.owner === 'test.a.b');
  const part = settingsProjection(value, page, applets);
  part.extensions['test.a.b'].settings = { 'x.y': 4 };
  const next = applySettingsJson(value, page, applets, JSON.stringify(part));
  assert.deepEqual(next.extensions['test.a.b'].settings, { 'x.y': 4 });
  assert.equal(next.extensions['test.a.b'].enabled, true);
  assert.equal(next.extensions['test.a.b'].pages.unknown.display, 'window');
  part.extensions['test.a.b'].enabled = false;
  assert.throws(
    () => applySettingsJson(value, page, applets, JSON.stringify(part)),
    /変更できない/,
  );
  assert.throws(
    () =>
      applySettingsJson(
        value,
        catalog[0],
        applets,
        '{"host":{"theme":"dark","notifications":false}}',
      ),
    /変更できない/,
  );
  assert.throws(() => applySettingsJson(value, catalog[0], applets, '{"host":{}}'), /theme/);
});
test('web partial arrays preserve other rows and immutable fields', () => {
  const v = createDefaultSettings(),
    id = 'web.11111111-1111-1111-1111-111111111111';
  v.webApplets.items = [
    {
      id,
      name: 'Site',
      url: 'https://example.com/',
      icon: '',
      enabled: false,
      display: 'page',
      navigation: 'none',
      allowedOrigins: [],
      accountId: 'account.11111111-1111-1111-1111-111111111111',
      imported: { name: 'Original' },
    },
  ];
  const a = [{ id, displayName: 'Site', runtime: 'web' }],
    p = settingsCatalog(a, v).find((p) => p.owner === id);
  const json = settingsProjection(v, p, a);
  json.webApplets.items[0].name = 'Changed';
  const next = applySettingsJson(v, p, a, JSON.stringify(json));
  assert.equal(next.webApplets.items[0].enabled, false);
  assert.deepEqual(next.webApplets.items[0].imported, { name: 'Original' });
  json.webApplets.items = [];
  assert.throws(() => applySettingsJson(v, p, a, JSON.stringify(json)), /ID/);
});
test('stable catalog search uses static metadata and NFKC AND matching', () => {
  const v = createDefaultSettings(),
    pages = settingsCatalog(applets, v);
  assert.equal(searchSettings(pages, 'ＦＩＸＴＵＲＥ interval')[0].key, 'setting:x.y');
  assert.equal(searchSettings(pages, 'polling seconds')[0].title, 'Interval');
  assert.equal(searchSettings(pages, 'secret-current-value').length, 0);
  assert.notEqual(settingsItemId('a.b', 'c'), settingsItemId('a', 'b.c'));
  assert.equal(
    new Set(pages.flatMap((p) => p.items.map((i) => i.id))).size,
    pages.flatMap((p) => p.items).length,
  );
});

test('host projections preserve unknown sibling fields and exclude builtin update sources', () => {
  const value = createDefaultSettings();
  value.gestures.futureOption = 'keep';
  const all = [
    {
      id: 'builtin.fixture',
      displayName: 'Builtin',
      sourceKind: 'builtin',
      runtime: 'node',
      pages: [],
    },
  ];
  const pages = settingsCatalog(all, value),
    page = pages.find((p) => p.id === 'gestures');
  const json = settingsProjection(value, page, all);
  assert.equal(json.gestures.futureOption, undefined);
  json.gestures.enabled = !value.gestures.enabled;
  assert.equal(
    applySettingsJson(value, page, all, JSON.stringify(json)).gestures.futureOption,
    'keep',
  );
  assert.equal(
    settingsProjection(
      value,
      pages.find((p) => p.id === 'about'),
      all,
    ).extensions,
    undefined,
  );
});

test('search includes legacy key aliases and static object fields, never dynamic choices or data values', () => {
  const v = createDefaultSettings();
  const rows = [
    {
      id: 'test.search',
      displayName: 'Search',
      runtime: 'node',
      settings: [
        {
          key: 'modern',
          aliases: ['legacy'],
          title: 'Canonical',
          description: 'Description',
          type: 'object-list',
          fields: [
            {
              key: 'location',
              title: 'Folder',
              type: 'select',
              options: [{ label: 'Static choice', value: 'static' }],
            },
          ],
        },
      ],
      settingOptions: { modern: [{ label: 'Secret dynamic', value: 'secret' }] },
    },
  ];
  const pages = settingsCatalog(rows, v);
  assert.equal(searchSettings(pages, 'LEGACY folder')[0].key, 'setting:modern');
  assert.equal(searchSettings(pages, 'static choice')[0].title, 'Canonical');
  assert.equal(searchSettings(pages, 'secret dynamic').length, 0);
  assert.equal(searchSettings(pages, 'Canonical')[0].title, 'Canonical');
});
