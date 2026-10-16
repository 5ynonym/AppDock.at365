const path = require('node:path');

function getPublishDirectory(repository) {
  return path.resolve(repository, '../../40.ARTIFACT', path.basename(repository));
}

module.exports = { getPublishDirectory };
