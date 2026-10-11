/** Locate the independent overlay surface rather than the host renderer. */
exports.ribbonPage = async (host) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const page = host
      .context()
      .pages()
      .find((p) => /\/shells\/default\/index\.html$/.test(p.url()));
    if (page) {
      await page.locator('.activity-rail').waitFor();
      return page;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error('Default Shell ribbon did not become ready');
};
exports.closingAction = async (action) => {
  try {
    await action;
  } catch (e) {
    if (!/Target page, context or browser has been closed/.test(String(e))) throw e;
  }
};
exports.overlayPage = async (host) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    const page = host
      .context()
      .pages()
      .find((p) => p.url().endsWith('/overlay.html'));
    if (page) {
      await page.locator('.command-palette').waitFor();
      return page;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error('Shell overlay did not become ready');
};
exports.logsPage = async (host, scope) => {
  const end = Date.now() + 15000;
  let detail = '';
  while (Date.now() < end) {
    for (const page of host
      .context()
      .pages()
      .filter((p) => p.url().endsWith('/logs.html'))) {
      try {
        const model = await page.evaluate(
          async () => (await window.appdockPage.connect()).snapshot,
        );
        detail = JSON.stringify(model.content.scope);
        if (
          scope &&
          (model.content.scope.type !== scope.type || model.content.scope.id !== scope.id)
        )
          continue;
        await page.locator('.log-toolbar').waitFor({ timeout: 1000 });
        return page;
      } catch (e) {
        detail = String(e);
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error('Shell log page did not become ready: ' + detail);
};

exports.homePage = async (host) => {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    for (const page of host
      .context()
      .pages()
      .filter((p) => p.url().endsWith('/home.html'))) {
      try {
        await page.getByRole('heading', { name: 'ホーム', exact: true }).waitFor({ timeout: 500 });
        return page;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error('Shell home page did not become ready');
};
