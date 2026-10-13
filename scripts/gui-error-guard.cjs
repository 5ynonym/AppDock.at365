/** Fail isolated GUI runs on main-process exceptions, including shutdown; never leave an error dialog blocking the runner. */
const fs = require('node:fs'),
  path = require('node:path');
const { _electron } = require('playwright');
const launch = _electron.launch.bind(_electron);
const artifacts = path.resolve(__dirname, '../.artifacts');
_electron.launch = async function (options) {
  const app = await launch(options);
  const profileArg = options.args?.find((arg) => arg.startsWith('--test-profile='));
  let profile = profileArg?.slice('--test-profile='.length);
  if (!profile)
    profile =
      options.args?.find((arg) => arg.endsWith('main.cjs')) &&
      path.dirname(options.args.find((arg) => arg.endsWith('main.cjs')));
  if (!profile || !path.resolve(profile).startsWith(artifacts + path.sep))
    throw Error('GUI error guard requires an isolated project profile');
  const file = path.join(profile, 'main-error.txt');
  app.process().on('exit', (code) => {
    if (code && code !== 0) process.exitCode = 1;
  });
  await app.evaluate((_electron, file) => {
    process.prependListener('uncaughtException', (error) => {
      process.getBuiltinModule('fs').writeFileSync(file, error.stack || String(error));
      process.exit(1);
    });
  }, file);
  const close = app.close.bind(app);
  app.close = async () => {
    await close();
    if (fs.existsSync(file)) throw Error(fs.readFileSync(file, 'utf8'));
  };
  return app;
};
