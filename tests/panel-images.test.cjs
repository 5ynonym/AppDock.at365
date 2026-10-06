const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHostApi } = require('../out/main/main/core/host-api.js');
test('image panels accept both SDK null defaults and bounded raster thumbnails', async () => {
  const api = createHostApi(
    {},
    '',
    () => {},
    () => {},
  );
  const e = { manifest: { id: 'test', capabilities: ['ui'] }, state: 'running' };
  const panel = { title: 'History', description: '', facts: [], actions: [], images: null };
  await api(e, 'host.ui.panel', panel);
  const image = {
    title: 'Image',
    description: 'Info',
    image: 'data:image/jpeg;base64,AA==',
    actions: [{ title: 'Open', command: 'test.open' }],
  };
  await api(e, 'host.ui.panel', { ...panel, images: [image] });
  const previous = e.panel;
  for (const images of [
    Array(5).fill(image),
    [{ ...image, image: 'https://example.com/image.png' }],
    [{ ...image, image: 'data:image/svg+xml;base64,AA==' }],
    [{ ...image, image: 'data:image/jpeg;base64,' + 'A'.repeat(200000) }],
    [{ ...image, actions: [{ title: 'Open', command: 'other.open' }] }],
  ]) {
    await assert.rejects(api(e, 'host.ui.panel', { ...panel, images }), /サムネイル/);
    assert.equal(e.panel, previous, 'invalid images must preserve the last valid panel');
  }
  await api(e, 'host.ui.panel', {
    ...panel,
    images: [{ title: 'Missing', description: null, image: null, actions: null }],
  });
  e.manifest.capabilities = [];
  await assert.rejects(api(e, 'host.ui.panel', panel), /capabilities/);
});
