const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { build, Platform } = require('electron-builder');
const builderRequire = createRequire(require.resolve('electron-builder'));
const { NsisTarget } = builderRequire('app-builder-lib/out/targets/nsis/NsisTarget');
const root = path.resolve(__dirname, '..');
const version = builderRequire('app-builder-lib/package.json').version;
// 26.15.3 ignores portable.script/include. Replace only its in-memory portable
// template; do not modify node_modules or the installer targets. Recheck this
// integration explicitly when changing the pinned builder version.
if (version !== '26.15.3')
  throw Error('Review the portable template integration for builder ' + version);
async function buildPortable(config) {
  const original = NsisTarget.prototype.computeFinalScript;
  NsisTarget.prototype.computeFinalScript = function (source, ...args) {
    if (this.isPortable) {
      if (!source.includes('ExecWait "$INSTDIR\\${APP_EXECUTABLE_FILENAME} $R0"'))
        throw Error('Unexpected upstream portable lifecycle');
      source = fs.readFileSync(path.join(root, 'scripts/portable.nsi'), 'utf8');
    }
    return original.call(this, source, ...args);
  };
  try {
    return await build({
      projectDir: root,
      targets: Platform.WINDOWS.createTarget('portable', builderRequire('builder-util').Arch.x64),
      publish: 'never',
      config,
    });
  } finally {
    NsisTarget.prototype.computeFinalScript = original;
  }
}
exports.buildPortable = buildPortable;
if (require.main === module)
  buildPortable(process.argv.includes('--store') ? { compression: 'store' } : undefined).catch(
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
