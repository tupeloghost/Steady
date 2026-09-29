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

function coverageWords(story) {
  const camps = CAMP_ORDER.filter((c) => story.camps.includes(c)).map((c) => CAMP_NAME[c]);
  const who = camps.length > 1
    ? camps.slice(0, -1).join(', ') + ' and ' + camps[camps.length - 1]
    : camps[0];
  return (story.outlets.length === 1 ? 'one outlet, ' : story.outlets.length + ' outlets, ') + who;
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

function verdictHtml(v) {
  if (!v) return '';
  return `
      <aside class="verdict verdict-${esc(v.key)}">
        <p class="verdict-kicker">what the coverage pattern shows</p>
        <p class="verdict-title">${esc(v.title)}</p>
        <ul>${v.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </aside>`;
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

  if (frame.only.length) {
    parts.push(`
        <div class="block block-only">
          <h4>Reported on one side only</h4>
          ${frame.only.map((only) => {
            const bits = [];
            if (only.facts.length) bits.push('figures no one else gives: ' + only.facts.join(', '));
            if (only.terms.length) bits.push(only.terms.join(', '));
            return `
          <div class="side">
            <p class="side-name">${esc(CAMP_NAME[only.camp])}</p>
            <p class="side-body">${esc(bits.join('. '))}</p>
            ${only.quote ? `<p class="side-quote"><q>${esc(only.quote.text)}</q><cite>${esc(only.quote.outlet)}</cite></p>` : ''}
          </div>`;
          }).join('')}
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
        <summary>every headline, side by side</summary>
        <div class="original-body">${groups}</div>
      </details>`;
}

function storyHtml(story, { lead = false } = {}) {
  // When the agreed account carries the story, one outlet's own summary above it is
  // both a repetition and a thumb on the scale. The shared version does the work.
  const showSummary = story.summary && story.frame.shared.length < 2;
  return `
    <article class="story${lead ? ' story-lead' : ''}">
      <h3><a class="headline" href="${esc(story.link)}" target="_blank" rel="noopener">${esc(story.headline)}</a></h3>
      ${showSummary ? `<p class="summary">${esc(story.summary)}</p>` : ''}
      ${spreadHtml(story)}
      ${verdictHtml(story.frame.verdict)}
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
          <td><span class="lean">${esc(s.lean)}</span>${esc(s.owner)}${quiet.has(s.outlet) ? '<span class="review">Quiet today: ' + esc(quiet.get(s.outlet)) + '</span>' : ''}</td>
        </tr>`).join('');

  const gone = config.unavailable.map((s) => `
        <tr><td>${esc(s.name)}</td><td>${esc(s.why)}</td></tr>`).join('');

  return `
    <details class="colophon">
      <summary><span>How this is put together, and who is in it</span></summary>
      <div class="body">
        <p>${esc(config.rule)}</p>
        <p>The shared account is built by taking the claims that outlets on opposite sides
        both carry. What only one side says is listed separately rather than blended in.
        Nothing here is written by a machine: every line is a sentence a named outlet
        published, and the outlet is named next to it.</p>
        <p>The verdicts are drawn from measurements: how much of the wording is identical
        across outlets, whether the coverage rests on unnamed officials, whether any
        document is cited, how many outlets published inside the same three hours, and
        whether state broadcasters are carrying it harder than anyone. The evidence is
        printed under every verdict. It can be wrong, so argue with it.</p>
        <table>${rows}</table>
        <p class="left-out">Wanted but unavailable:</p>
        <table>${gone}</table>
      </div>
    </details>`;
}

function render(edition, config, { standalone = false, css = '', archiveLink = null } = {}) {
  const total = edition.lead.length + edition.sections.reduce((n, s) => n + s.stories.length, 0);

  const empty = total ? '' : `
    <div class="empty">
      <p>There is no edition today. Nothing could be read, or nothing has been published in
      the last three days. That is the whole update.</p>
    </div>`;

  const index = edition.sections.length ? `
    <nav class="index" aria-label="sections in this edition">
      ${edition.lead.length ? '<a href="#lead">The widest spread</a>' : ''}
      ${edition.sections.map((s) => `<a href="#${esc(s.beat)}">${esc(s.title)}</a>`).join('')}
    </nav>
    <p class="legend">Under each story, the bar reads left, center, right, state, independent. A filled mark means that side carried it.</p>` : '';

  const lead = edition.lead.length ? `
    <section class="section section-lead" id="lead">
      <h2><span>The widest spread</span></h2>
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
      <p class="standing">This edition was assembled once. It will not change while you read it.</p>
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
      <p><strong>That is the entire edition.</strong></p>
      <p>There is nothing below this line and nothing more will load. The next edition is
      assembled tomorrow. Closing this page is the correct ending.</p>
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
