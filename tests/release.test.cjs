const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRelease, CHECKS, asset, read, save } = require('../scripts/release.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'AppDock-release-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'AppDock.at365');
  const applet = path.join(directory, 'Applet.Fixture');
  for (const repo of [root, applet]) fs.mkdirSync(path.join(repo, 'publish'), { recursive: true });
  fs.mkdirSync(path.join(applet, '.git'));
  save(path.join(root, 'package.json'), { version: '1.2.3' });
  save(path.join(applet, 'extension.json'), { id: 'fixture', version: '1.0.0' });
  fs.writeFileSync(path.join(applet, 'publish/update.zip'), 'applet fixture');
  const notes = path.join(root, 'notes.md');
  fs.writeFileSync(notes, 'Reviewed release notes\n');
  const planPath = path.join(root, 'artifacts/plan.json');
  const commit = 'a'.repeat(40);
  const state = {
    calls: [],
    release: null,
    dirty: false,
    commit,
    remoteCommit: commit,
    corruptUpload: false,
    uploadFailure: false,
    tag: '',
  };
  const run = (exe, args) => {
    state.calls.push([exe, ...args]);
    if (exe === 'git') {
      const command = args.slice(4);
      if (command[0] === 'status') return state.dirty ? ' M file' : '';
      if (command[0] === 'rev-parse') return state.commit;
      if (command[0] === 'remote') return 'https://github.com/5ynonym/AppDock.at365.git';
      if (command[0] === 'ls-remote') return state.tag;
    }
    if (exe === 'gh') {
      if (args[0] === 'api') {
        if (args.at(-1).endsWith('/commits/main'))
          return JSON.stringify({ sha: state.remoteCommit });
        if (args.includes('--slurp')) return JSON.stringify([state.release ? [state.release] : []]);
        if (args[1].endsWith('/releases/42')) return JSON.stringify(state.release);
      }
      if (args[0] === 'release') {
        if (args[1] === 'create') {
          state.release = {
            id: 42,
            tag_name: 'v1.2.3',
            target_commitish: commit,
            name: 'AppDock.at365 v1.2.3',
            body: fs.readFileSync(notes, 'utf8'),
            draft: true,
            prerelease: false,
            assets: [],
            html_url: 'https://github.com/fixture/release',
          };
        } else if (args[1] === 'upload') {
          if (state.uploadFailure) throw Error('simulated interrupted upload');
          const item = asset(args[3]);
          state.release.assets.push({
            name: item.name,
            size: item.size,
            state: 'uploaded',
            digest: `sha256:${state.corruptUpload ? '0'.repeat(64) : item.sha256}`,
          });
        } else if (args[1] === 'edit') {
          assert.ok(args.includes('--draft=false'));
          state.release.draft = false;
        } else throw Error(`Unexpected mutation: ${args}`);
        return '';
      }
    }
    throw Error(`Unexpected command: ${exe} ${args}`);
  };
  const release = createRelease(root, run);
  release.preflight(planPath, notes);
  const exe = path.join(root, 'publish/AppDock.at365.exe');
  const archive = path.join(root, 'publish/AppDock.at365-all-in-one-1.2.3.zip');
  fs.writeFileSync(exe, 'host fixture');
  fs.writeFileSync(archive, 'archive fixture');
  const host = asset(exe);
  save(path.join(root, 'publish/update.json'), {
    schemaVersion: 1,
    kind: 'host',
    id: 'host',
    version: '1.2.3',
    payload: { file: host.name, size: host.size, sha256: host.sha256, format: 'exe' },
  });
  save(path.join(root, 'artifacts/checks.json'), CHECKS);
  for (const name of CHECKS) fs.writeFileSync(path.join(root, `artifacts/${name}.log`), 'passed');
  save(path.join(root, 'artifacts/bundle-ui.json'), {
    ok: true,
    version: '1.2.3',
    archiveSha256: asset(archive).sha256,
    bundle: {
      hostVersion: '1.2.3',
      hostCommit: commit,
      hostDirty: false,
      applets: [
        {
          repository: 'Applet.Fixture',
          commit,
          id: 'fixture',
          version: '1.0.0',
          dirty: false,
          updateZipSha256: asset(path.join(applet, 'publish/update.zip')).sha256,
        },
      ],
      files: [{ path: host.name, size: host.size, sha256: host.sha256 }],
    },
  });
  return { root, state, release, planPath, archive };
}
const mutations = (state) =>
  state.calls.filter((call) => call[0] === 'gh' && call[1] === 'release');

test('release stages every verified asset before the single publication operation', async (t) => {
  const { state, release, planPath } = fixture(t);
  release.seal(planPath);
  await release.remote('draft', planPath, 'gh');
  assert.equal(state.release.draft, true);
  assert.equal(state.release.assets.length, 3);
  const beforeResume = mutations(state).length;
  await release.remote('draft', planPath, 'gh');
  assert.equal(mutations(state).length, beforeResume, 'Resume must not overwrite assets');
  await release.remote('publish', planPath, 'gh');
  assert.deepEqual(
    mutations(state).map((call) => call[2]),
    ['create', 'upload', 'upload', 'upload', 'edit'],
  );
  assert.equal(read(planPath).phase, 'published');
  await assert.rejects(release.remote('draft', planPath, 'gh'), /Published releases/);
});

test('failed or incomplete preparation cannot make any GitHub mutation', async (t) => {
  const { root, state, release, planPath } = fixture(t);
  save(path.join(root, 'artifacts/checks.json'), CHECKS.slice(0, 2));
  assert.throws(() => release.seal(planPath), /All checks/);
  await assert.rejects(release.remote('draft', planPath, 'gh'), /Prepare must complete/);
  assert.equal(mutations(state).length, 0);
});

test('changed assets, sources and remote main stop before creating a draft', async (t) => {
  const { state, release, planPath, archive } = fixture(t);
  release.seal(planPath);
  state.remoteCommit = 'b'.repeat(40);
  await assert.rejects(release.remote('draft', planPath, 'gh'), /Push the reviewed/);
  state.remoteCommit = state.commit;
  state.dirty = true;
  await assert.rejects(release.remote('draft', planPath, 'gh'), /outstanding changes/);
  state.dirty = false;
  state.commit = 'c'.repeat(40);
  await assert.rejects(release.remote('draft', planPath, 'gh'), /Sources changed/);
  state.commit = 'a'.repeat(40);
  fs.appendFileSync(archive, 'changed');
  await assert.rejects(release.remote('draft', planPath, 'gh'), /Prepared file changed/);
  assert.equal(mutations(state).length, 0);
});

test('interrupted uploads remain draft and resume without replacing completed assets', async (t) => {
  const { state, release, planPath } = fixture(t);
  release.seal(planPath);
  state.uploadFailure = true;
  await assert.rejects(release.remote('draft', planPath, 'gh'), /interrupted upload/);
  assert.equal(state.release.draft, true);
  await assert.rejects(release.remote('publish', planPath, 'gh'), /Draft verification/);
  state.uploadFailure = false;
  await release.remote('draft', planPath, 'gh');
  assert.equal(state.release.assets.length, 3);
  assert.equal(mutations(state).filter((call) => call[2] === 'edit').length, 0);
});

test('bad remote digest or a missing asset prevents publication', async (t) => {
  const { state, release, planPath } = fixture(t);
  release.seal(planPath);
  state.corruptUpload = true;
  await assert.rejects(release.remote('draft', planPath, 'gh'), /Remote digest mismatch/);
  assert.equal(state.release.draft, true);
  state.corruptUpload = false;
  state.release.assets = [];
  await release.remote('draft', planPath, 'gh');
  state.release.assets.pop();
  await assert.rejects(release.remote('publish', planPath, 'gh'), /Missing assets/);
  assert.equal(state.release.draft, true);
  assert.equal(mutations(state).filter((call) => call[2] === 'edit').length, 0);
});

test('version update increases stable version and leaves other package data unchanged', (t) => {
  const { root, release } = fixture(t);
  release.setVersion('1.3.0');
  assert.deepEqual(read(path.join(root, 'package.json')), { version: '1.3.0' });
  assert.throws(() => release.setVersion('1.2.9'), /must increase/);
  assert.throws(() => release.setVersion('2.0.0-beta.1'), /stable/);
});
