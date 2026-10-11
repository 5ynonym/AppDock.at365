const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDefaultSettings } = require('../out/main/shared/settings-schema');
const { SettingsEditingSession } = require('../out/main/main/core/settings-editing-session');
const { SettingsPageSession } = require('../out/main/main/core/settings-page');
function fixture() {
  let saved = { value: createDefaultSettings(), revision: 1 };
  saved.value.extensions['private.other'] = {
    enabled: false,
    settings: { secret: 'private-value' },
  };
  const applets = [
    {
      id: 'fixture.a.b',
      displayName: 'Fixture',
      runtime: 'node',
      settings: [{ key: 'n.x', title: 'Number', type: 'number', default: 1 }],
      pages: [],
    },
  ];
  const editor = new SettingsEditingSession({
    current: () => saved,
    applets: () => applets,
    save: async (value, revision) => {
      assert.equal(revision, saved.revision);
      return (saved = { value, revision: revision + 1 });
    },
    confirmDiscard: async () => true,
    changed() {},
  });
  let calls = 0;
  const navigation = { query: '' };
  const page = new SettingsPageSession(
    { id: 'full', route: 'settings', kind: 'settings', context: 'full' },
    {
      editor,
      navigation,
      host: () => ({ settings: saved, extensions: applets, dark: false }),
      auxiliary: () => ({}),
      actions: () => ({ sample: async () => ++calls }),
      changed() {},
    },
  );
  const act = (operation, opid = crypto.randomUUID()) => {
    const m = page.snapshot();
    return page.act({
      id: m.id,
      type: 'settings',
      sessionId: m.content.editing.sessionId,
      editRevision: m.content.editing.editRevision,
      operationId: opid,
      operation,
    });
  };
  return {
    page,
    editor,
    applets,
    navigation,
    replacement: () =>
      new SettingsPageSession(
        { id: 'replacement', route: 'settings', kind: 'settings', context: 'full' },
        {
          editor,
          navigation,
          host: () => ({ settings: saved, extensions: applets, dark: false }),
          auxiliary: () => ({}),
          actions: () => ({}),
          changed() {},
        },
      ),
    act,
    get saved() {
      return saved;
    },
    get calls() {
      return calls;
    },
  };
}
test('public settings models never expose unrelated values; issued operations are scoped and replayed once', async () => {
  const f = fixture(),
    m = f.page.snapshot();
  assert.equal(JSON.stringify(m).includes('private-value'), false);
  await assert.rejects(f.act({ kind: 'edit', action: { type: 'draft', value: {} } }), /不正/);
  await assert.rejects(
    f.act({
      kind: 'edit',
      action: { type: 'page-values', pageId: 'appearance', value: { profile: { name: 'attack' } } },
    }),
    /変更できない/,
  );
  await assert.rejects(f.act({ kind: 'invoke', actionId: 'sample' }), /許可/);
  const id = m.content.actions.sample;
  await f.act({ kind: 'invoke', actionId: id }, 'once');
  await f.act({ kind: 'invoke', actionId: id }, 'once');
  assert.equal(f.calls, 1);
  await f.act({ kind: 'select', pageId: 'general' });
  await assert.rejects(f.act({ kind: 'invoke', actionId: id }), /許可/);
  f.page.dispose();
  await assert.rejects(f.act({ kind: 'select', pageId: 'profile' }), /Stale/);
});
test('partial JSON and incomplete numeric input survive controller replacement and all-session save failure', async () => {
  const f = fixture();
  await f.act({ kind: 'select', pageId: 'applet:fixture.a.b' });
  const values = { extensions: { 'fixture.a.b': { settings: { 'n.x': '-' } } } };
  await f.act({
    kind: 'edit',
    action: { type: 'page-values', pageId: 'applet:fixture.a.b', value: values },
  });
  assert.equal(f.page.snapshot().content.values.extensions['fixture.a.b'].settings['n.x'], '-');
  await assert.rejects(f.act({ kind: 'edit', action: { type: 'save' } }));
  await f.act({ kind: 'select', pageId: 'appearance' });
  await f.act({ kind: 'select', pageId: 'applet:fixture.a.b' });
  assert.equal(f.editor.projection().extensions['fixture.a.b'].settings['n.x'], '-');
  values.extensions['fixture.a.b'].settings['n.x'] = 9;
  await f.act({
    kind: 'edit',
    action: { type: 'page-values', pageId: 'applet:fixture.a.b', value: values },
  });
  await f.act({ kind: 'edit', action: { type: 'mode', value: 'json' } });
  await f.act({
    kind: 'edit',
    action: { type: 'partial-text', pageId: 'applet:fixture.a.b', value: '{bad' },
  });
  await assert.rejects(f.act({ kind: 'select', pageId: 'general' }), /JSON/);
  assert.equal(f.editor.snapshot().text, '{bad');
  await f.act({
    kind: 'edit',
    action: { type: 'partial-text', pageId: 'applet:fixture.a.b', value: JSON.stringify(values) },
  });
  await f.act({ kind: 'edit', action: { type: 'save' } });
  assert.equal(f.saved.value.extensions['fixture.a.b'].settings['n.x'], 9);
  assert.equal(f.saved.value.extensions['private.other'].settings.secret, 'private-value');
  assert.equal(JSON.stringify(f.page.snapshot()).includes('private-value'), false);
});

test('search is metadata-only and persistent; explicit movement switches page and latest acknowledgement wins', async () => {
  const f = fixture();
  const before = f.editor.snapshot();
  await f.act({ kind: 'search', text: 'ＦＩＸＴＵＲＥ number' });
  const results = f.page.snapshot().content.results;
  assert.equal(results.length, 1);
  assert.equal(results[0].definition, undefined);
  assert.deepEqual(f.editor.snapshot(), before);
  assert.equal(f.replacement().snapshot().content.query, 'ＦＩＸＴＵＲＥ number');
  await f.act({ kind: 'move', itemId: results[0].id });
  const move = f.page.snapshot().content.move;
  assert.equal(f.editor.snapshot().pageId, 'applet:fixture.a.b');
  assert.equal(f.editor.snapshot().dirty, false);
  await f.act({ kind: 'move', itemId: results[0].id });
  const latest = f.page.snapshot().content.move;
  await assert.rejects(f.act({ kind: 'moved', requestId: move.id, pageId: move.pageId }), /古く/);
  await f.act({ kind: 'moved', requestId: latest.id, pageId: latest.pageId });
  assert.equal(f.page.snapshot().content.move.completed, true);
  await f.act({ kind: 'search', text: 'private-value' });
  assert.equal(f.page.snapshot().content.results.length, 0);
  assert.equal(f.editor.snapshot().pageId, latest.pageId);
  await assert.rejects(f.act({ kind: 'search', text: 'x'.repeat(513) }), /512/);
});
test('invalid JSON prevents result movement without clearing query or raw input; removed targets are rejected', async () => {
  const f = fixture();
  await f.act({ kind: 'edit', action: { type: 'mode', value: 'json' } });
  await f.act({
    kind: 'edit',
    action: { type: 'partial-text', pageId: 'appearance', value: '{broken' },
  });
  await f.act({ kind: 'search', text: 'Number' });
  const result = f.page.snapshot().content.results[0];
  await assert.rejects(f.act({ kind: 'move', itemId: result.id }), /JSON/);
  assert.equal(f.editor.snapshot().text, '{broken');
  assert.equal(f.editor.snapshot().pageId, 'appearance');
  await f.act({ kind: 'edit', action: { type: 'discard' } });
  await f.act({ kind: 'move', itemId: result.id });
  f.applets.splice(0);
  assert.equal(f.page.snapshot().content.results.length, 0);
  assert(f.page.snapshot().content.page.unavailableReason);
  await assert.rejects(f.act({ kind: 'move', itemId: result.id }), /見つかりません/);
  await f.act({ kind: 'select', pageId: 'profile' });
  assert.equal(f.page.snapshot().content.page.id, 'profile');
});
