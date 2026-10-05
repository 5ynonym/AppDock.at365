const fs = require('node:fs');
const path = require('node:path');
// Install only into the isolated profile selected by an integration/UI test.
module.exports = function installTestExtensions(profile, settings) {
  fs.cpSync(
    path.resolve(__dirname, '../../artifacts/test-extensions'),
    path.join(profile, 'extensions'),
    {
      recursive: true,
    },
  );
  settings.extensions['appdock.welcome'] = { enabled: true, settings: {} };
  settings.extensions['appdock.dotnet-demo'] ??= {
    enabled: false,
    settings: { intervalSeconds: 30 },
  };
  return settings;
};
