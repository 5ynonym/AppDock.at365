const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  parseWebApplets,
  webUrl,
  allowedWebAppletNavigation,
  manifestDefaults,
} = require('../out/main/shared/web-applets');
const { createDefaultSettings, parseSettings } = require('../out/main/shared/settings-schema');
const { ribbonItems } = require('../out/main/shared/applet-pages');
const account = { id: `account.${randomUUID()}`, name: '仕事用' };
const item = {
  id: `web.${randomUUID()}`,
  name: 'ページ',
  url: 'https://app.example.com/start',
  accountId: account.id,
  enabled: true,
  display: 'page',
  navigation: 'same-origin',
  allowedOrigins: [],
  icon: '',
};
test('Legacy settings migrate without altering Gmail configuration', () => {
  const s = createDefaultSettings();
  delete s.webApplets;
  s.extensions['at365.gmail'] = { enabled: true, settings: { monitoring: true } };
  const next = parseSettings(s);
  assert.deepEqual(next.webApplets, { accounts: [], items: [] });
  assert.deepEqual(next.extensions, s.extensions);
});
test('Web account references, identity, limits, protocols and icon formats are validated', () => {
  const good = { accounts: [account], items: [item] };
  assert.deepEqual(parseWebApplets(good), good);
  for (const patch of [
    { accountId: 'at365.gmail' },
    { url: 'file:///A:/private' },
    { url: 'https://user:password@example.com/' },
    { icon: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { navigation: 'unsafe' },
    { allowedOrigins: ['https://example.com/path'] },
    { id: 'web.../../bad' },
  ])
    assert.throws(() => parseWebApplets({ ...good, items: [{ ...item, ...patch }] }));
  assert.throws(() => parseWebApplets({ ...good, accounts: [account, account] }));
  assert.throws(() => parseWebApplets({ ...good, items: [item, item] }));
  assert.throws(() => parseWebApplets({ ...good, accounts: [] }));
  for (const v of [
    'javascript:alert(1)',
    'data:text/html,secret',
    'ftp://example.com/',
    'https://example.com/\n',
  ])
    assert.throws(() => webUrl(v));
});
test('Navigation compares complete origins, not sibling subdomains or prefixes', () => {
  assert.equal(allowedWebAppletNavigation(item, 'https://app.example.com/other'), true);
  for (const url of [
    'https://app.example.com.evil.test/',
    'https://other.example.com/',
    'http://app.example.com/',
    'https://app.example.com:444/',
    'file:///A:/test',
  ])
    assert.equal(allowedWebAppletNavigation(item, url), false);
  assert.equal(
    allowedWebAppletNavigation({ ...item, navigation: 'none' }, item.url + '#anchor'),
    true,
  );
  assert.equal(
    allowedWebAppletNavigation({ ...item, navigation: 'none' }, 'https://app.example.com/other'),
    false,
  );
  assert.equal(
    allowedWebAppletNavigation(
      { ...item, allowedOrigins: ['https://login.example.com'] },
      'https://login.example.com/auth',
    ),
    true,
  );
  assert.equal(
    allowedWebAppletNavigation({ ...item, navigation: 'any' }, 'https://other.example.com/'),
    true,
  );
  assert.equal(
    allowedWebAppletNavigation({ ...item, navigation: 'any' }, 'javascript:alert(1)'),
    false,
  );
});
test('Remote manifest defaults cannot set account, commands, arbitrary permissions or broaden origins', () => {
  const raw = {
    name: 'アプリ',
    start_url: '/app/',
    icons: [{ src: '/icon.png' }],
    appdock: { schemaVersion: 1, navigation: 'any', accountId: account.id, commands: ['run.exe'] },
    extensions: { 'at365.gmail': { enabled: false } },
  };
  const defaults = manifestDefaults(raw, 'https://app.example.com/manifest.json', item.url);
  assert.equal(defaults.name, 'アプリ');
  assert.equal(defaults.url, 'https://app.example.com/app/');
  assert.equal(defaults.iconUrl, 'https://app.example.com/icon.png');
  assert.equal(defaults.navigation, undefined);
  assert.equal(defaults.accountId, undefined);
  assert.equal(defaults.extensions, undefined);
  assert.throws(() => manifestDefaults(raw, 'https://other.example.com/manifest.json', item.url));
  assert.equal(
    manifestDefaults(
      { ...raw, start_url: 'https://other.example.com/' },
      'https://app.example.com/manifest.json',
      item.url,
    ).url,
    undefined,
  );
  assert.equal(
    manifestDefaults(
      { ...raw, appdock: { schemaVersion: 1, navigation: 'none' } },
      'https://app.example.com/m',
      item.url,
    ).navigation,
    'none',
  );
  assert.throws(() =>
    manifestDefaults(
      { ...raw, appdock: { schemaVersion: 99 } },
      'https://app.example.com/m',
      item.url,
    ),
  );
});
test('Stable WebApplet identities retain ribbon preferences and saved settings', () => {
  const s = createDefaultSettings();
  s.webApplets = { accounts: [account], items: [item] };
  s.ribbon.order = [`page:${item.id}:main`];
  const renamed = parseSettings({
    ...s,
    webApplets: {
      accounts: [{ ...account, name: '新しい枠名' }],
      items: [{ ...item, name: '新しいページ名', display: 'window' }],
    },
  });
  assert.deepEqual(renamed.ribbon, s.ribbon);
  assert.equal(renamed.webApplets.items[0].id, item.id);
});
