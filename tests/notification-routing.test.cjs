const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  notificationProtocol,
  notificationXml,
  notificationToken,
  NotificationRoutes,
} = require('../out/main/main/core/notification-routing');

test('notification launch identities isolate installed, test and development copies and survive path casing', () => {
  const protocol = notificationProtocol('A:\\Tools\\AppDock.exe', 'A:\\Tools', true);
  assert.equal(protocol, notificationProtocol('a:/tools/./AppDock.exe', 'a:/tools/', true));
  assert.notEqual(protocol, notificationProtocol('A:\\Test\\AppDock.exe', 'A:\\Test', true));
  assert.notEqual(protocol, notificationProtocol('A:\\Tools\\AppDock.exe', 'A:\\Test', true));
  assert.notEqual(protocol, notificationProtocol('A:\\Tools\\AppDock.exe', 'A:\\Tools', false));
});

test('a notification URI runs its callback once; foreign and malformed URIs cannot run commands', () => {
  const routes = new NotificationRoutes('appdock-notify-test');
  let clicks = 0,
    fallback = 0;
  const uri = routes.add(() => clicks++);
  const open = () => fallback++;
  assert.ok(notificationToken([uri], routes.protocol));
  assert.equal(routes.activate([uri], open), true);
  assert.equal(clicks, 1);
  assert.equal(routes.activate([uri], open), true);
  assert.equal(clicks, 1);
  assert.equal(fallback, 1);
  for (const value of [
    uri.replace('test', 'other'),
    `${uri}?command=appdock.quit`,
    `${uri}#fragment`,
    uri.replace('notification/', 'evil@notification/'),
    uri.replace('notification/', 'notification:42/'),
    uri + '/more',
    'broken:',
  ]) {
    assert.equal(routes.activate([value], open), false);
  }
  assert.equal(fallback, 1);
  // A host restart has no callback from the previous Applet process.
  assert.equal(new NotificationRoutes(routes.protocol).activate([uri], open), true);
  assert.equal(fallback, 2);
});

test('toast XML uses protocol activation and escapes mail content while retaining silence', () => {
  const toast = notificationXml(
    'Gmail <&"',
    "body > ' \u0000\nnext",
    true,
    'appdock-notify-x://notification/id',
  );
  assert.ok(toast.includes('activationType="protocol"'));
  assert.ok(toast.includes('launch="appdock-notify-x://notification/id"'));
  assert.ok(toast.includes('Gmail &lt;&amp;&quot;'));
  assert.ok(toast.includes('body &gt; &apos; \nnext'));
  assert.ok(toast.includes('<audio silent="true"/>'));
  assert.ok(!toast.includes('\u0000'));
  assert.ok(!notificationXml('title', 'body', false, 'url').includes('<audio'));
});
