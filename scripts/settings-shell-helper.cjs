async function settingsPage(host) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    for (const page of host
      .context()
      .pages()
      .filter((p) => p.url().endsWith('/settings.html'))) {
      try {
        const route = await host.evaluate(() =>
          window.dock.snapshot().then((s) => s.navigation.route),
        );
        const model = await page.evaluate(() =>
          window.appdockPage.connect().then((c) => c.snapshot),
        );
        if (
          model.kind === 'settings' &&
          model.content.context === (route === 'settings' ? 'full' : 'applet') &&
          (await page.locator('.settings-surface').count())
        )
          return page;
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw Error('Settings Shell was not ready');
}
/** Explicitly deferred page/locator chain for a native Shell view replaced by navigation. */
function deferred(resolve, chain = []) {
  const locate = async () => {
    let value = await resolve();
    for (const [name, args] of chain) value = value[name](...args);
    return value;
  };
  return new Proxy(
    {},
    {
      get(_target, name) {
        if (name === 'then') return undefined;
        if (
          [
            'getByRole',
            'getByLabel',
            'getByText',
            'getByPlaceholder',
            'getByAltText',
            'locator',
            'filter',
            'first',
            'last',
            'nth',
          ].includes(name)
        )
          return (...args) => deferred(resolve, [...chain, [name, args]]);
        return async (...args) => (await locate())[name](...args);
      },
    },
  );
}
module.exports = { settingsPage, deferred };
