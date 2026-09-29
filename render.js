'use strict';

const { CAMP_NAME } = require('./analyze');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function longDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const CAMP_ORDER = ['left', 'center', 'right', 'state', 'independent'];

const SPREAD_SLOTS = [
  { camp: 'left', short: 'left' },
  { camp: 'center', short: 'center' },
  { camp: 'right', short: 'right' },
  { camp: 'state', short: 'state' },
  { camp: 'independent', short: 'indep' },
];

// Short names for the coverage line under each story.
const CAMP_SHORT = { left: 'left', center: 'center', right: 'right', state: 'government-funded', independent: 'independent' };

function coverageWords(story) {
  const who = CAMP_ORDER.filter((c) => story.camps.includes(c)).map((c) => CAMP_SHORT[c]).join(', ');
  return (story.outlets.length === 1 ? '1 outlet: ' : story.outlets.length + ' outlets: ') + who;
}

// The spread of the political spectrum a story reached, which is the whole point of
// the app and was previously only stated in words.
function spreadHtml(story) {
  const marks = SPREAD_SLOTS.map((slot) => {
    const on = story.camps.includes(slot.camp);
    const n = on ? story.coverage.filter((c) => c.camp === slot.camp).length : 0;
    return `<span class="seg${on ? ' on' : ''}${n >= 3 ? ' heavy' : ''}" title="${esc(slot.short)}" aria-hidden="true"><i></i></span>`;
  }).join('');
  return `
      <p class="spread">
        <span class="segs">${marks}</span>
        <span class="spread-words">${esc(coverageWords(story))}</span>
      </p>`;
}

function verdictHtml(story) {
  const measured = story.frame.verdict ? story.frame.verdict.reasons : [];
  if (story.ai) {
    const v = story.ai.verdict;
    if (!v) return '';
    return `
      <aside class="verdict verdict-${esc(v.key)}">
        <p class="verdict-kicker">Worth knowing about this coverage</p>
        <p class="verdict-title">${esc(v.title)}</p>
        ${v.reasoning ? `<p class="verdict-reasoning">${esc(v.reasoning)}</p>` : ''}
        <p class="verdict-by">Judged by ${esc(story.ai.model)}</p>
        ${measured.length ? `<p class="verdict-measured">What we counted</p>
        <ul>${measured.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      </aside>`;
  }
  const v = story.frame.verdict;
  if (!v) return '';
  // A reason that only restates the title adds reading, not information.
  const norm = (t) => t.toLowerCase().replace(/[^a-z]/g, '');
  const reasons = v.reasons.filter((r) => !norm(r).includes(norm(v.title)) && norm(r) !== 'basedonhowthestorywascovered');
  return `
      <aside class="verdict verdict-${esc(v.key)}">
        <p class="verdict-kicker">Worth knowing about this coverage</p>
        <p class="verdict-title">${esc(v.title)}</p>
        ${reasons.length ? `<ul>${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      </aside>`;
}

function briefHtml(story) {
  if (!story.ai || !story.ai.summary) return '';
  const n = story.outlets.length;
  return `
      <div class="brief">
        <p class="brief-text">${esc(story.ai.summary)}</p>
        ${story.ai.differences ? `<p class="brief-diff">${esc(story.ai.differences)}</p>` : ''}
        <p class="brief-credit">Summary by ${esc(story.ai.model)}, from ${n === 1 ? '1 outlet' : n + ' outlets'}</p>
      </div>`;
}

function frameHtml(frame) {
  const parts = [];

  if (frame.shared.length) {
    parts.push(`
        <div class="block block-agreed">
          <h4>What every side agrees on</h4>
          <ul class="shared">${frame.shared.map((s) => `
            <li><q>${esc(s.text)}</q><cite>${esc(s.outlet)}</cite></li>`).join('')}
          </ul>
        </div>`);
  }

  if (frame.framing.length) {
    parts.push(`
        <div class="block block-framing">
          <h4>Same thing, different words</h4>
          <dl class="framing">${frame.framing.map((f) => `
            <dt>${esc(f.about)}</dt>
            <dd>${CAMP_ORDER.filter((c) => f.byCamp[c]).map((c) =>
              `<span class="who">${esc(CAMP_NAME[c])}</span> ${f.byCamp[c].map((w) => `<b>${esc(w)}</b>`).join(' ')}`).join('<span class="sep"></span>')}</dd>`).join('')}
          </dl>
        </div>`);
  }

  return parts.length ? `<div class="frame">${parts.join('')}</div>` : '';
}

function coverageDetails(story) {
  const groups = CAMP_ORDER.filter((c) => story.coverage.some((x) => x.camp === c)).map((c) => `
          <div class="camp-group">
            <p class="also-head">${esc(CAMP_NAME[c])}</p>
            <ul>${story.coverage.filter((x) => x.camp === c).map((x) => `
              <li><a href="${esc(x.link)}" target="_blank" rel="noopener"><span class="who">${esc(x.source)}</span>${esc(x.asPublished)}</a></li>`).join('')}
            </ul>
          </div>`).join('');

  return `
      <details class="original">
        <summary>See every outlet's headline</summary>
        <div class="original-body">${groups}</div>
      </details>`;
}

function storyHtml(story, { lead = false } = {}) {
  // When the agreed account carries the story, one outlet's own summary above it is
  // both a repetition and a thumb on the scale. The shared version does the work.
  const showSummary = !story.ai && story.summary && story.frame.shared.length < 2;
  return `
    <article class="story${lead ? ' story-lead' : ''}">
      <h3><a class="headline" href="${esc(story.link)}" target="_blank" rel="noopener">${esc(story.headline)}</a></h3>
      ${showSummary ? `<p class="summary">${esc(story.summary)}</p>` : ''}
      ${briefHtml(story)}
      ${spreadHtml(story)}
      ${verdictHtml(story)}
      ${frameHtml(story.frame)}
      ${coverageDetails(story)}
    </article>`;
}

function sourcesHtml(edition, config) {
  const quiet = new Map(edition.newsroomsQuiet.map((q) => [q.name, q.why]));
  const seen = new Set();
  const rows = CAMP_ORDER.flatMap((camp) => config.sources.filter((s) => s.camp === camp).filter((s) => {
    if (seen.has(s.outlet)) return false;
    seen.add(s.outlet);
    return true;
  })).map((s) => `
        <tr>
          <td>${esc(s.outlet)}</td>
          <td><span class="lean">${esc(s.lean)}</span>${esc(s.owner)}${quiet.has(s.outlet) ? '<span class="review">Couldn\u2019t be reached today</span>' : ''}</td>
        </tr>`).join('');

  const gone = config.unavailable.map((s) => `
        <tr><td>${esc(s.name)}</td><td>${esc(s.why)}</td></tr>`).join('');

  return `
    <details class="colophon">
      <summary><span>How this works, and which outlets are included</span></summary>
      <div class="body">
        <p>${esc(config.rule)}</p>
        <p>Each morning Steady reads news outlets from the left, center and right, plus
        government-funded and independent ones. Stories that several of them covered go first.</p>
        ${edition.model ? `<p>${esc(edition.model)} writes the short summary at the top of each story, using only what
        the outlets reported. It also flags coverage that looks coordinated, one-sided or poorly
        sourced. The outlets' own words sit underneath so you can check it.</p>` : `<p>The quotes under each story are
        things outlets on different sides both reported, in their own words.</p>`}
        <p>Headlines are reworded to remove charged language. Tap "See every outlet's headline"
        to read the originals.</p>
        <p>Every outlet has a political lean, and many have owners or funders with interests of
        their own. They are listed below.</p>
        <table>${rows}</table>
        <p class="left-out">Outlets we couldn\u2019t include:</p>
        <table>${gone}</table>
      </div>
    </details>`;
}

function render(edition, config, { standalone = false, css = '', archiveLink = null } = {}) {
  const total = edition.lead.length + edition.sections.reduce((n, s) => n + s.stories.length, 0);

  const empty = total ? '' : `
    <div class="empty">
      <p>No news today. None of the outlets could be reached, or none published anything
      new in the last three days.</p>
    </div>`;

  const index = edition.sections.length ? `
    <nav class="index" aria-label="sections in this edition">
      ${edition.lead.length ? '<a href="#lead">Top stories</a>' : ''}
      ${edition.sections.map((s) => `<a href="#${esc(s.beat)}">${esc(s.title)}</a>`).join('')}
    </nav>
` : '';

  const lead = edition.lead.length ? `
    <section class="section section-lead" id="lead">
      <h2><span>Top stories</span></h2>
      ${edition.lead.map((s) => storyHtml(s, { lead: true })).join('')}
    </section>` : '';

  const sections = edition.sections.map((s) => `
    <section class="section" id="${esc(s.beat)}">
      <h2><span>${esc(s.title)}</span></h2>
      ${s.stories.map((st) => storyHtml(st)).join('')}
    </section>`).join('');

  const body = `
  <main>
    <header class="masthead">
      <h1 class="wordmark">steady</h1>
      <p class="dateline">${esc(longDate(edition.date))}</p>
      <p class="standing">Updated once each morning</p>
      <div class="appearance" id="appearance" hidden>
        <button type="button" data-theme-choice="auto">auto</button>
        <button type="button" data-theme-choice="light">light</button>
        <button type="button" data-theme-choice="dark">dark</button>
      </div>
    </header>

    ${empty}
    ${index}
    ${lead}
    ${sections}

    <div class="ending">
      <p><strong>That\u2019s everything for today.</strong></p>
      <p>The next edition arrives tomorrow morning.</p>
      ${archiveLink ? `<p class="archive-link"><a href="${esc(archiveLink)}">Earlier editions</a></p>` : ''}
      ${sourcesHtml(edition, config)}
    </div>
  </main>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Steady</title>
<meta name="description" content="Top stories read across the spectrum, condensed to what every side agrees on.">
<meta name="robots" content="noindex, nofollow">
${standalone ? `<style>${css}</style>` : '<link rel="stylesheet" href="style.css">'}
<script>
/* Applied before the page paints, so switching never flashes the other theme.
   Without JavaScript the control stays hidden and the system setting decides. */
(function () {
  var KEY = 'steady-theme';
  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }
  if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;

  function paint(choice) {
    var box = document.getElementById('appearance');
    if (!box) return;
    box.hidden = false;
    var buttons = box.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.themeChoice === choice));
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var current = document.documentElement.dataset.theme || 'auto';
    paint(current);
    var box = document.getElementById('appearance');
    if (!box) return;
    box.addEventListener('click', function (e) {
      var choice = e.target && e.target.dataset && e.target.dataset.themeChoice;
      if (!choice) return;
      if (choice === 'auto') {
        delete document.documentElement.dataset.theme;
        try { localStorage.removeItem(KEY); } catch (err) {}
      } else {
        document.documentElement.dataset.theme = choice;
        try { localStorage.setItem(KEY, choice); } catch (err) {}
      }
      paint(choice);
    });
  });
})();
</script>
</head>
<body>${body}
</body>
</html>
`;
}

const THEME_SCRIPT = (render.toString().match(/<script>[\s\S]*?<\/script>/) || [''])[0];

function renderArchiveIndex(dates, { css = '' } = {}) {
  const rows = dates.map((d) => `
      <li><a href="${esc(d)}.html">${esc(longDate(d))}</a></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Steady, earlier editions</title>
<meta name="robots" content="noindex, nofollow">
<style>${css}</style>
${THEME_SCRIPT}
</head>
<body>
  <main>
    <header class="masthead">
      <h1 class="wordmark">steady</h1>
      <p class="dateline">Earlier editions</p>
      <p class="standing">Past days, newest first.</p>
      <div class="appearance" id="appearance" hidden>
        <button type="button" data-theme-choice="auto">auto</button>
        <button type="button" data-theme-choice="light">light</button>
        <button type="button" data-theme-choice="dark">dark</button>
      </div>
    </header>
    <ul class="archive-list">${rows}
    </ul>
    <div class="ending">
      <p class="archive-link"><a href="../">Today\u2019s edition</a></p>
    </div>
  </main>
</body>
</html>
`;
}

module.exports = { render, renderArchiveIndex };
