'use strict';

const { CAMP_NAME } = require('./analyze');
const { fullerAccount } = require('./digest');

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

const CAMP_ORDER = ['left', 'center', 'right', 'state', 'independent', 'local', 'good'];

const SPREAD_SLOTS = [
  { camp: 'left', label: 'Left' },
  { camp: 'center', label: 'Center' },
  { camp: 'right', label: 'Right' },
  { camp: 'state', label: 'Government-funded' },
  { camp: 'independent', label: 'Independent' },
];

// Which sides covered the story, written out as words: the sides that covered it are
// lit, the ones that did not are faded, so it reads at a glance with no key needed.
function spreadHtml(story) {
  // Local and good news are not about which political side covered them; just say who.
  if (story.section) {
    const names = story.outlets;
    const who = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
    return `
      <p class="spread"><span class="spread-label">Reported by ${esc(who)}</span></p>`;
  }
  const n = story.outlets.length;
  const covered = SPREAD_SLOTS.filter((x) => story.camps.includes(x.camp)).map((x) => x.label.toLowerCase());
  const chips = SPREAD_SLOTS.map((slot) => {
    const on = story.camps.includes(slot.camp);
    return `<span class="chip${on ? ' on' : ''}" aria-hidden="true">${esc(slot.label)}</span>`;
  }).join('');
  return `
      <p class="spread" aria-label="${esc('Covered by ' + (n === 1 ? '1 outlet' : n + ' outlets') + ': ' + covered.join(', '))}">
        <span class="spread-label">Covered by ${n === 1 ? '1 outlet' : n + ' outlets'}</span>
        <span class="chips">${chips}</span>
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

// Feedback opens a pre-filled note on the project's GitHub page, labelled so it can be
// found again. The story and edition are filled in so the reader only writes the note.
const FEEDBACK_REPO = 'tupeloghost/Steady';

function feedbackUrl({ title, about, date }) {
  const body = 'What I noticed:\n\n\n\n---\n' + about + '\nEdition: ' + date;
  return 'https://github.com/' + FEEDBACK_REPO + '/issues/new?labels=feedback'
    + '&title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
}

function accountHtml(story, gist) {
  const paragraphs = fullerAccount(story, { alreadyShown: gist ? gist.text : '' });
  if (!paragraphs.length) return '';
  return `
        <div class="account">${paragraphs.map((p) => `
          <p>${p.map((x) => `${esc(x.text)} <span class="gist-credit">${esc(x.outlet)}</span>`).join(' ')}</p>`).join('')}
        </div>`;
}

// How sure the reader can be. Local and good news are usually single source by
// nature, so only a big claim earns a note there.
function sureHtml(story) {
  const sure = story.frame.sure;
  if (!sure) return '';
  if (story.section && !['unconfirmed', 'thin'].includes(sure.level)) return '';
  if (sure.level === 'some') return '';
  return `<p class="sure sure-${esc(sure.level)}"><span class="sure-label">How sure is this?</span> ${esc(sure.text)}</p>`;
}

function framingHtml(story) {
  const f = story.frame.framing;
  if (!f.length) return '';
  return `
        <div class="block block-framing">
          <h4>Same thing, different words</h4>
          <dl class="framing">${f.map((x) => `
            <dt>${esc(x.about)}</dt>
            <dd>${CAMP_ORDER.filter((c) => x.byCamp[c]).map((c) =>
              `<span class="who">${esc(CAMP_NAME[c])}</span> ${x.byCamp[c].map((w) => `<b>${esc(w)}</b>`).join(' ')}`).join('<span class="sep"></span>')}</dd>`).join('')}
          </dl>
        </div>`;
}

function outletsHtml(story) {
  const groups = CAMP_ORDER.filter((c) => story.coverage.some((x) => x.camp === c)).map((c) => `
          <div class="camp-group">
            <p class="also-head">${esc(CAMP_NAME[c])}</p>
            <ul>${story.coverage.filter((x) => x.camp === c).map((x) => `
              <li><a href="${esc(x.link)}" target="_blank" rel="noopener"><span class="who">${esc(x.source)}</span>${esc(x.asPublished)}</a></li>`).join('')}
            </ul>
          </div>`).join('');
  return `
        <details class="sources">
          <summary>Sources (${story.coverage.length})</summary>
          <div class="original-body">${groups}</div>
        </details>`;
}

// What a story says before it is opened: one or two sentences, never a wall.
function gistOf(story) {
  if (story.ai && story.ai.summary) return { text: story.ai.summary, credit: 'Summary by ' + story.ai.model, fromQuote: false };
  if (story.frame.shared.length) {
    const q = story.frame.shared[0];
    return { text: q.text, credit: q.outlet, fromQuote: true };
  }
  if (story.summary) return { text: story.summary, credit: story.source, fromQuote: false };
  return null;
}

function storyHtml(story, { lead = false, date = '', sectionTitle = '' } = {}) {
  const gist = gistOf(story);
  const flag = story.ai ? story.ai.verdict : story.frame.verdict;
  return `
    <article class="story${lead ? ' story-lead' : ''}">
      <details class="story-more">
        <summary>
          <h3 class="headline">${esc(story.headline)}</h3>
          ${gist ? `<p class="gist">${esc(gist.text)} <span class="gist-credit">${esc(gist.credit)}</span></p>` : ''}
          ${spreadHtml(story)}
          ${flag ? `<p class="flag-line">${esc(flag.title)}</p>` : ''}
          ${!flag && story.frame.sure && ['unconfirmed', 'thin'].includes(story.frame.sure.level)
            ? `<p class="flag-line">Unconfirmed: one source, big claim</p>` : ''}
          <span class="more-cue" aria-hidden="true"><span class="cue-open">More</span><span class="cue-close">Less</span></span>
        </summary>
        <div class="more-body">
          ${sureHtml(story)}
          ${accountHtml(story, gist)}
          ${story.ai && story.ai.differences ? `<p class="brief-diff">${esc(story.ai.differences)}</p>` : ''}
          ${verdictHtml(story)}
          ${framingHtml(story)}
          ${outletsHtml(story)}
          <p class="feedback-link"><a href="${esc(feedbackUrl({
            title: 'Feedback: ' + story.headline.slice(0, 80),
            about: 'Story: ' + story.headline + '\nSection: ' + sectionTitle,
            date,
          }))}" target="_blank" rel="noopener">Feedback on this story</a></p>
        </div>
      </details>
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
      ${edition.sections.map((s) => `<a href="#${esc(s.beat)}">${esc(({ local: 'Local', good: 'Good news' })[s.beat] || s.title)}</a>`).join('')}
    </nav>
` : '';

  const lead = edition.lead.length ? `
    <section class="section section-lead" id="lead">
      <h2><span>Top stories</span></h2>
      ${edition.lead.map((s) => storyHtml(s, { lead: true, date: edition.date, sectionTitle: 'Top stories' })).join('')}
    </section>` : '';

  const sections = edition.sections.map((s) => `
    <section class="section" id="${esc(s.beat)}">
      <h2><span>${esc(s.title)}</span></h2>
      ${s.stories.map((st) => storyHtml(st, { date: edition.date, sectionTitle: s.title })).join('')}
    </section>`).join('');

  const body = `
  <main>
    <header class="masthead">
      <h1 class="wordmark">Steady</h1>
      <p class="mission">Each morning, Steady reads the news from the left, the right and everything in between, and tells you what happened in plain, calm words.</p>
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
  </main>
  <a class="feedback-button" href="${esc(feedbackUrl({ title: 'Feedback', about: 'About: the page in general', date: edition.date }))}" target="_blank" rel="noopener">Feedback</a>`;

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
  // A refresh starts at the top instead of where the reader last was. A link to a
  // section (the menu) still goes to that section.
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  if (!location.hash) window.scrollTo(0, 0);

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
      <h1 class="wordmark">Steady</h1>
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
