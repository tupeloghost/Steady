'use strict';

// Builds one self contained page and writes it to dist/. No server involved, so this
// runs anywhere on a schedule: a laptop, a cron job, a hosted build.
//
// Each run also saves that day's edition into archive/ at the project root. On GitHub
// that folder is committed back to the repository every morning, which keeps a history
// and counts as activity, so GitHub never switches the daily schedule off.

const fs = require('fs');
const path = require('path');
const { buildEdition } = require('./pipeline');
const { enrich } = require('./opus');
const { render, renderArchiveIndex } = require('./render');

const ROOT = __dirname;
const OUT = process.env.OUT_DIR || path.join(ROOT, 'dist');
const ARCHIVE = path.join(ROOT, 'archive');

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.json'), 'utf8'));
  const css = fs.readFileSync(path.join(ROOT, 'public', 'style.css'), 'utf8');

  process.stdout.write('Reading ' + config.sources.length + ' feeds\n');
  const edition = await buildEdition(config);

  const stories = edition.lead.length + edition.sections.reduce((n, s) => n + s.stories.length, 0);
  if (!stories) throw new Error('no stories were assembled, refusing to publish an empty edition');

  await enrich(edition);

  // today's page
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), render(edition, config, { standalone: true, css, archiveLink: 'archive/' }));

  // keep today in the persistent archive
  fs.mkdirSync(ARCHIVE, { recursive: true });
  fs.writeFileSync(path.join(ARCHIVE, edition.date + '.html'),
    render(edition, config, { standalone: true, css, archiveLink: './' }));

  // publish every archived day alongside an index of them
  const outArchive = path.join(OUT, 'archive');
  fs.mkdirSync(outArchive, { recursive: true });
  const days = fs.readdirSync(ARCHIVE).filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort().reverse();
  for (const f of days) fs.copyFileSync(path.join(ARCHIVE, f), path.join(outArchive, f));
  fs.writeFileSync(path.join(outArchive, 'index.html'),
    renderArchiveIndex(days.map((f) => f.slice(0, 10)), { css }));

  process.stdout.write('Wrote ' + stories + ' stories from ' + edition.newsroomsRead.length
    + ' newsrooms. Archive holds ' + days.length + ' edition' + (days.length === 1 ? '' : 's') + '.\n');
}

main().catch((e) => {
  process.stderr.write('Build failed: ' + (e && e.message || e) + '\n');
  process.exit(1);
});
