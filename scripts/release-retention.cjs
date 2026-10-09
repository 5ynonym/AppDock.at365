// Run only after the new release's public downloads and update check succeeded.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

function pruneReleases(verified, reportPath, command) {
  assert.equal(verified.phase, 'verified', 'Public verification must complete before retention');
  assert.match(verified.repo, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  assert.ok(Number.isSafeInteger(verified.releaseId) && verified.releaseId > 0);
  assert.ok(typeof verified.tag === 'string' && verified.tag.length > 0);
  assert.ok(!fs.existsSync(reportPath), 'Use a new retention report path');
  const endpoint = `repos/${verified.repo}/releases`;
  const api = (suffix) => JSON.parse(command('api', `${endpoint}/${suffix}`));
  const summary = ({ id, tag_name, draft, published_at, prerelease, assets }) => ({
    id,
    tag_name,
    draft,
    published_at,
    prerelease,
    assets: assets.map(({ id, name, size, digest }) => ({ id, name, size, digest })),
  });
  function list() {
    const releases = JSON.parse(
      command('api', '--paginate', '--slurp', `${endpoint}?per_page=100`),
    ).flat();
    assert.equal(
      new Set(releases.map((item) => item.id)).size,
      releases.length,
      'Duplicate release ID',
    );
    return releases
      .filter((item) => item.draft === false)
      .map((item) => {
        assert.ok(
          Number.isSafeInteger(item.id) &&
            item.id > 0 &&
            Number.isFinite(Date.parse(item.published_at)),
          'Invalid published release metadata',
        );
        return item;
      })
      .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id - a.id);
  }
  const report = {
    repo: verified.repo,
    verifiedReleaseId: verified.releaseId,
    verifiedTag: verified.tag,
    keepCount: 3,
    phase: 'checking',
    deleted: [],
    pendingDelete: null,
  };
  function write() {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
  try {
    const before = list();
    const current = before.find((item) => item.id === verified.releaseId);
    assert.equal(current?.tag_name, verified.tag, 'Verified release identity changed');
    assert.equal(api('latest').id, verified.releaseId, 'Latest changed since public verification');
    const keep = before.slice(0, 3);
    assert.ok(
      keep.some((item) => item.id === verified.releaseId),
      'Verified release is not among the newest three',
    );
    report.before = before.map(summary);
    report.kept = keep.map(summary);
    report.planned = before.slice(3).map(summary);
    report.phase = 'deleting';
    write();
    for (const candidate of report.planned) {
      // Refuse a changed candidate or roster; never act on a stale list alone.
      const fresh = list();
      assert.deepEqual(
        fresh.slice(0, 3).map(summary),
        report.kept,
        'Newest releases changed during retention',
      );
      assert.equal(api('latest').id, verified.releaseId, 'Latest changed during retention');
      assert.deepEqual(summary(api(candidate.id)), candidate, 'Deletion target changed');
      report.pendingDelete = candidate.id;
      write();
      // The release endpoint removes the release/assets and does not delete Git tags.
      command('api', '--method', 'DELETE', `${endpoint}/${candidate.id}`);
      report.deleted.push(candidate.id);
      report.pendingDelete = null;
      write();
    }
    const after = list();
    assert.deepEqual(
      after.map(summary),
      report.kept,
      'Remaining releases differ from the retained set',
    );
    assert.equal(api('latest').id, verified.releaseId, 'Latest changed after retention');
    report.phase = 'complete';
    report.after = after.map(summary);
    write();
    return report;
  } catch (error) {
    report.phase = 'failed';
    report.error = error.message;
    write();
    throw error;
  }
}

module.exports = { pruneReleases };
if (require.main === module) {
  const [verifiedFile, reportPath, gh = 'gh'] = process.argv.slice(2);
  try {
    assert.ok(
      verifiedFile && reportPath,
      'Usage: release-retention.cjs <verified-receipt.json> <new-report.json> [gh-path]',
    );
    const verified = JSON.parse(fs.readFileSync(verifiedFile, 'utf8').replace(/^\uFEFF/, ''));
    const report = pruneReleases(verified, reportPath, (...args) =>
      execFileSync(gh, args, {
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
      }),
    );
    console.log(
      `Retained ${report.kept.length} published releases; deleted ${report.deleted.length}. ${reportPath}`,
    );
  } catch (error) {
    console.error(
      `Release retention stopped: ${error.message}. Inspect the report and GitHub state before retrying.`,
    );
    process.exitCode = 1;
  }
}
