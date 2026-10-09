const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pruneReleases } = require('../scripts/release-retention.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'AppDock-retention-'));
  t.after(() => {
    assert.equal(path.dirname(directory), os.tmpdir());
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const verified = { phase: 'verified', repo: 'fixture/AppDock.at365', releaseId: 5, tag: 'v5' };
  const state = {
    calls: [],
    latest: 5,
    interrupt: false,
    changeTarget: false,
    releases: [2, 5, 1, 4, 3].map((id) => ({
      id,
      tag_name: `v${id}`,
      draft: false,
      prerelease: id === 4,
      published_at: `2026-10-0${id}T00:00:00Z`,
      assets: [{ id: id * 10, name: 'app.zip', size: id, digest: `sha256:${id}` }],
    })),
  };
  state.releases.push({ id: 6, tag_name: 'draft', draft: true, published_at: null, assets: [] });
  const command = (...args) => {
    state.calls.push(args);
    const endpoint = args.at(-1);
    if (args.includes('--paginate')) {
      assert.ok(args.includes('--slurp'));
      return JSON.stringify([state.releases.slice(0, 2), state.releases.slice(2)]);
    }
    if (args.includes('DELETE')) {
      const id = Number(endpoint.split('/').at(-1));
      state.releases = state.releases.filter((item) => item.id !== id);
      if (state.interrupt) throw Error('response lost after delete');
      return '';
    }
    if (endpoint.endsWith('/latest')) return JSON.stringify({ id: state.latest });
    const release = state.releases.find((item) => item.id === Number(endpoint.split('/').at(-1)));
    return JSON.stringify(state.changeTarget ? { ...release, tag_name: 'changed' } : release);
  };
  const reportPath = path.join(directory, 'retention.json');
  return { state, verified, command, reportPath };
}
const deletes = (state) => state.calls.filter((args) => args.includes('DELETE'));

test('retention keeps three most recently published releases across pages and preserves drafts', (t) => {
  const { state, verified, command, reportPath } = fixture(t);
  const report = pruneReleases(verified, reportPath, command);
  assert.deepEqual(
    report.kept.map((item) => item.id),
    [5, 4, 3],
  );
  assert.deepEqual(report.deleted, [2, 1]);
  assert.deepEqual(state.releases.map((item) => item.id).sort(), [3, 4, 5, 6]);
  assert.ok(
    deletes(state).every((args) =>
      /^repos\/fixture\/AppDock\.at365\/releases\/\d+$/.test(args.at(-1)),
    ),
  );
  assert.equal(JSON.parse(fs.readFileSync(reportPath, 'utf8')).phase, 'complete');
});

test('three or fewer published releases require no deletion', (t) => {
  const { state, verified, command, reportPath } = fixture(t);
  state.releases = state.releases.filter((item) => item.id >= 4);
  pruneReleases(verified, reportPath, command);
  assert.equal(deletes(state).length, 0);
});

test('unverified publication and changed latest refuse deletion', (t) => {
  const { state, verified, command, reportPath } = fixture(t);
  assert.throws(
    () => pruneReleases({ ...verified, phase: 'published' }, reportPath, command),
    /verification must complete/,
  );
  assert.equal(state.calls.length, 0);
  state.latest = 4;
  assert.throws(() => pruneReleases(verified, reportPath, command), /Latest changed/);
  assert.equal(deletes(state).length, 0);
});

test('changed candidate metadata stops before deletion', (t) => {
  const { state, verified, command, reportPath } = fixture(t);
  state.changeTarget = true;
  assert.throws(() => pruneReleases(verified, reportPath, command), /Deletion target changed/);
  assert.equal(deletes(state).length, 0);
});

test('ambiguous deletion is journaled and retry re-reads the actual remaining releases', (t) => {
  const { state, verified, command, reportPath } = fixture(t);
  state.interrupt = true;
  assert.throws(() => pruneReleases(verified, reportPath, command), /response lost/);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.phase, 'failed');
  assert.equal(report.pendingDelete, 2);
  assert.deepEqual(report.deleted, []);
  assert.equal(deletes(state).length, 1);
  state.interrupt = false;
  const resumed = pruneReleases(verified, `${reportPath}.retry`, command);
  assert.deepEqual(resumed.deleted, [1]);
  assert.equal(deletes(state).length, 2);
});

test('missing publication time stops without selecting deletion targets', (t) => {
  const { state, verified, command, reportPath } = fixture(t);
  state.releases[0].published_at = null;
  assert.throws(
    () => pruneReleases(verified, reportPath, command),
    /Invalid published release metadata/,
  );
  assert.equal(deletes(state).length, 0);
});
