const assert = require('node:assert/strict');
/** Wait for the UI write queue and durable host state; there is no global save action. */
async function settleSettings(page) {
  const host = page
    .context()
    .pages()
    .find((p) => p.url().startsWith('appdock://host/'));
  assert(host, 'host page for settings flush');
  for (const p of page
    .context()
    .pages()
    .filter((p) => p.url().endsWith('/settings.html')))
    await p.waitForFunction(
      () =>
        ![...document.querySelectorAll('.profile-actions button')].some((e) =>
          e.textContent.includes('読み込み中'),
        ),
    );
  await host.evaluate(() => window.dock.flushSettings());
  const deadline = Date.now() + 30000;
  while (true) {
    const state = await host.evaluate(() => window.dock.settingsEditing());
    if (!state.pending) return state;
    assert(Date.now() < deadline, 'settings write did not complete');
    await host.waitForTimeout(50);
  }
}
module.exports = { settleSettings };
