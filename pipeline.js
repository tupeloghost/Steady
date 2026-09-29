'use strict';

const { neutralizeTitle, neutralizeSummary, neutralizeLong, heatScore, stripHtml, headlineCore } = require('./neutralize');
const { analyze } = require('./analyze');

/* ------------------------------------------------------------------ feed reading */

function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + name + '>', 'i'));
  return m ? m[1] : '';
}
function cdata(s) {
  const m = String(s).match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : s;
}
function linkOf(block) {
  // Decode first: a link wrapped in CDATA starts with "<" and would otherwise look
  // like an Atom element and be thrown away.
  const rss = cdata(tag(block, 'link')).trim();
  if (rss && !/^</.test(rss)) return rss;
  const atom = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
            || block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return atom ? atom[1] : '';
}

function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  return blocks.map((b) => {
    const short = cdata(tag(b, 'description') || tag(b, 'summary'));
    const full = cdata(tag(b, 'content:encoded') || tag(b, 'content'));
    const date = cdata(tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date'));
    return {
      title: stripHtml(cdata(tag(b, 'title'))),
      summary: short,
      body: full,
      link: linkOf(b),
      date: Date.parse(date) || null,
    };
  }).filter((it) => it.title && it.link);
}

async function readSource(src) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(src.url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Steady/2.0 (a calm personal news reader)', accept: 'application/rss+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) return { src, items: [], error: 'status ' + res.status };
    return { src, items: parseFeed(await res.text()), error: null };
  } catch (e) {
    return { src, items: [], error: e.name === 'AbortError' ? 'timed out' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------------- filtering */

const NOT_NEWS = /^(news wrap|the week in|week in review|this week in|opinion|commentary|editorial|photos?|video|watch|listen|podcast|newsletter|quiz|crossword|puzzle|live updates?|live blog|in pictures|cartoon|letters?|morning edition|all things considered|weekend edition|up first)\b|\bpodcast\b|\bnewsletter\b|\bcrossword\b|\bbriefing\b/i;

const NOT_NEWS_PATH = /\/(sport|sports|culture|film|music|tv-and-radio|television|lifeandstyle|life-and-style|fashion|food|travel|games|gaming|books|artanddesign|celebrity|entertainment|obituaries|commentisfree|opinion|podcast|newsletters?)\//i;

// A headline that opens with an auxiliary and ends in a question mark is an argument,
// not a report. So is one that opens by telling you how to feel about the subject.
const ARGUMENT = /^(is|are|was|were|do|does|did|can|could|should|will|would|has|have|had|may|might|am)\b[\s\S]*\?\s*$/i;
const COMMENTARY = /^(we (have to|need to|should) talk about|here'?s why|here'?s what|why i\b|what i learned|the case (for|against)|in defen[cs]e of|it'?s time to|let'?s\b|a love letter|an ode to|confessions of|i tried|i spent)/i;

// Some feeds bolt two unrelated stories into one entry, NPR style:
// "The Fed raises interest rates. And, EU proposes Canada become an associate member".
// Only the first story is treated as what the entry is about.
const DIGEST_JOIN = /[.!?]\s+(?:And|Also|Plus|Meanwhile|Elsewhere),\s+/i;

function firstStory(text) {
  const s = String(text || '');
  const m = s.match(DIGEST_JOIN);
  return m && m.index > 20 ? s.slice(0, m.index + 1).trim() : s;
}

function isReporting(item) {
  if (NOT_NEWS_PATH.test(item.link)) return false;
  const core = headlineCore(item.title);
  if (ARGUMENT.test(core) || COMMENTARY.test(core)) return false;
  if (NOT_NEWS.test(item.title)) return false;
  if (/^(your|the) (weekly|daily|morning|evening)\b/i.test(item.title)) return false;
  if (item.title.split(/\s+/).length < 4) return false;
  return true;
}

/* ------------------------------------------------------------- beat classification */

const BEAT_WORDS = {
  health: ['measles', 'outbreak', 'vaccine', 'vaccination', 'hospital', 'medicaid', 'medicare', 'cancer', 'disease', 'patients', 'patient', 'doctors', 'physician', 'autism', 'opioid', 'overdose', 'insurance', 'insurer', 'clinic', 'mental health', 'nursing', 'maternal', 'abortion', 'fda', 'cdc', 'infection', 'virus', 'flu', 'drugmaker', 'prescription'],
  science: ['researchers', 'scientists', 'study finds', 'physicists', 'astronomers', 'nasa', 'telescope', 'quantum', 'fossil', 'species', 'evolution', 'mathematicians', 'neurons', 'genome', 'archaeolog', 'particle', 'orbit', 'spacecraft', 'experiment', 'laboratory'],
  climate: ['climate', 'wildfire', 'emissions', 'drought', 'flooding', 'hurricane', 'solar', 'coal', 'pipeline', 'glacier', 'heat wave', 'epa', 'farmers', 'farmland', 'watershed', 'forest', 'wildlife', 'pollution', 'renewable', 'grid', 'drilling', 'conservation', 'food system'],
  justice: ['court', 'judge', 'lawsuit', 'prison', 'police', 'sentenced', 'indicted', 'prosecutor', 'jail', 'sheriff', 'attorney general', 'plea', 'convicted', 'appeal', 'civil rights', 'detention', 'deportation', 'incarcerat', 'parole', 'charges'],
  technology: ['algorithm', 'artificial intelligence', 'chatbot', 'privacy', 'surveillance', 'software', 'semiconductor', 'social media', 'platform', 'cybersecurity', 'data broker', 'facial recognition', 'crypto', 'startup', 'chatgpt', 'openai', 'encryption', 'app store'],
  money: ['inflation', 'wages', 'tariff', 'unemployment', 'layoffs', 'union', 'strike', 'economy', 'recession', 'interest rate', 'federal reserve', 'tax', 'bankruptcy', 'shareholders', 'housing costs', 'rent', 'grocery prices', 'jobs report', 'pension'],
  education: ['school', 'students', 'teachers', 'university', 'college', 'campus', 'curriculum', 'classroom', 'tuition', 'district'],
};

function classify(item, src) {
  const text = (item.title + ' ' + stripHtml(item.summary).slice(0, 300)).toLowerCase();
  const scores = {};
  for (const [beat, words] of Object.entries(BEAT_WORDS)) {
    let n = 0;
    for (const w of words) if (text.includes(w)) n++;
    if (n) scores[beat] = n;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  // A world desk story stays world news unless it is plainly a science, health,
  // climate or technology story that happens to be set abroad.
  if (src.beat === 'world') {
    if (best && best[1] >= 3 && ['science', 'health', 'climate', 'technology'].includes(best[0])) return best[0];
    return 'world';
  }
  if (best && best[1] >= 2) return best[0];
  return src.beat;
}

// Signals that a local newsroom's story reaches past its own state.
const NATIONAL_SIGNAL = /\b(federal|supreme court|congress|senate|white house|nationwide|across the (country|us|u\.s\.)|pentagon|immigration and customs|ice\b|epa|fda|cdc|justice department|homeland security|national guard|first in the nation|other states|states across)\b/i;

/* -------------------------------------------------------------------- clustering */

const STOP = new Set(('a an the and or but of in on at to for from with by as is are was were be been being it its this that these those his her their our your my he she they we you i not no new says said after over under into about more most than then will would can could may might should who whom which what when where why how amid among across during while also just has have had do does did get got make made take took one two three first second last year years day days week weeks month months time times report reports reported study news says say some many could would according').split(/\s+/));

function tokenize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w));
}

// Similarity is weighted by how rare a word is across the whole day. Two headlines
// that share only "trump" are not the same story; two that share "withdraws" and
// "nominee" almost certainly are.
function buildIdf(docs) {
  const df = new Map();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const n = docs.length;
  const idf = new Map();
  for (const [w, c] of df) idf.set(w, Math.log((n + 1) / (c + 0.5)));
  return idf;
}

function vectorize(tokens, idf) {
  const v = new Map();
  for (const w of tokens) v.set(w, (v.get(w) || 0) + (idf.get(w) || 0));
  let norm = 0;
  for (const x of v.values()) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (const [k, x] of v) v.set(k, x / norm);
  return v;
}

function cosine(a, b) {
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [k, x] of small) { const y = big.get(k); if (y) dot += x * y; }
  return dot;
}

function clusterItems(items) {
  const firstSentence = (t) => (String(t).match(/[^.!?]+[.!?]/) || [String(t).slice(0, 160)])[0];
  const docs = items.map((it) => tokenize(it.title + ' ' + firstSentence(stripHtml(it.summaryText || ''))));
  const idf = buildIdf(docs);
  const vectors = items.map((_, i) => vectorize(docs[i], idf));
  const titleTerms = items.map((it) => new Set(tokenize(it.title)));
  const titleNames = items.map((it) => new Set(
    (it.title.match(/\b[A-Z][a-zA-Z]{2,}\b/g) || []).map((w) => w.toLowerCase()).filter((w) => !STOP.has(w))));

  const groups = [];
  items.forEach((it, i) => {
    let best = null, bestScore = 0;
    for (const g of groups) {
      // Compare against the group as a whole, not its closest member. Single linkage
      // chains unrelated stories together through a shared middle item.
      const score = cosine(vectors[i], g.centroid);
      if (score <= bestScore) continue;
      let shared = 0;
      for (const t of titleTerms[i]) if (g.titleTerms.has(t)) shared++;
      // Two headlines full of names that share none of them are two stories. The
      // Federal Reserve and the Bank of Japan both raise rates; that is not one event.
      let sharedNames = 0;
      for (const n of titleNames[i]) if (g.titleNames.has(n)) sharedNames++;
      const bothNamed = titleNames[i].size >= 2 && g.titleNames.size >= 2;
      if (bothNamed && sharedNames === 0) continue;
      // Headlines have to be about the same thing, not merely share a stray word.
      const ok = (shared >= 2 && score >= 0.28) || score >= 0.45;
      if (ok) { bestScore = score; best = g; }
    }
    if (best) {
      best.items.push(it);
      best.sum = addVectors(best.sum, vectors[i]);
      best.centroid = normalize(best.sum);
      for (const t of titleTerms[i]) best.titleTerms.add(t);
      for (const n of titleNames[i]) best.titleNames.add(n);
    } else {
      groups.push({
        items: [it],
        sum: new Map(vectors[i]),
        centroid: new Map(vectors[i]),
        titleTerms: new Set(titleTerms[i]),
        titleNames: new Set(titleNames[i]),
      });
    }
  });
  return { groups, idf, vectors };
}

function addVectors(a, b) {
  const out = new Map(a);
  for (const [k, v] of b) out.set(k, (out.get(k) || 0) + v);
  return out;
}

function normalize(v) {
  let norm = 0;
  for (const x of v.values()) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  const out = new Map();
  for (const [k, x] of v) out.set(k, x / norm);
  return out;
}

/* --------------------------------------------------------------------- selection */

const DAY = 24 * 60 * 60 * 1000;

const BEAT_ORDER = ['world', 'nation', 'justice', 'health', 'science', 'climate', 'technology', 'money', 'education'];
const BEAT_ROOM = { world: 5, nation: 6, justice: 3, health: 3, science: 4, climate: 4, technology: 3, money: 3, education: 2 };

const MAX_PER_OUTLET = 3;
const MAX_PER_OUTLET_PER_BEAT = 2;
const MAX_STATE_STORIES = 2;

function buildStories(groups) {
  return groups.map((g) => {
    const outlets = [...new Set(g.items.map((i) => i.outlet))];
    const camps = [...new Set(g.items.map((i) => i.camp))];
    const independents = [...new Set(g.items.filter((i) => i.camp === 'independent').map((i) => i.outlet))];

    // The calmest wording leads, and a partner that reran someone else's work never does.
    const lead = [...g.items].sort((a, b) =>
      ((a.republished ? 1 : 0) - (b.republished ? 1 : 0))
      || (a.heat - b.heat)
      || ((b.camp === 'independent' ? 1 : 0) - (a.camp === 'independent' ? 1 : 0))
      || ((b.summaryText || '').length - (a.summaryText || '').length))[0];

    const beats = {};
    for (const i of g.items) beats[i.beat] = (beats[i.beat] || 0) + 1;
    const beat = Object.entries(beats).sort((a, b) => b[1] - a[1])[0][0];

    const isLocal = lead.scope === 'state' && !NATIONAL_SIGNAL.test(lead.title + ' ' + lead.summaryText);

    // A story carried by outlets that disagree with each other outranks a story
    // carried by more outlets that all agree.
    const weight = outlets.length * 3 + camps.length * 7
      + (independents.length ? 2 : 0)
      + (isLocal ? -9 : 0);

    return {
      id: lead.link.split('?')[0].replace(/[^a-z0-9]+/gi, '').slice(-24),
      headline: lead.titleNeutral,
      asPublished: lead.title,
      summary: lead.summaryText,
      link: lead.link,
      source: lead.outlet,
      sourceLean: lead.lean,
      beat,
      scope: lead.scope,
      isLocal,
      outlets,
      camps,
      frame: analyze(g.items),
      coverage: g.items
        .map((i) => ({
          source: i.outlet, lean: i.lean, camp: i.camp, owner: i.owner, state: i.state,
          link: i.link, asPublished: i.title, text: i.summaryText || '', long: i.longText || '',
        }))
        .filter((a, idx, arr) => arr.findIndex((x) => x.source === a.source) === idx),
      weight,
      date: lead.date,
      names: new Set((lead.title.match(/\b[A-Z][a-zA-Z]{3,}\b/g) || []).map((w) => w.toLowerCase())),
    };
  });
}

// Two separate clusters can still be about the same person and week. Keep the
// stronger one so the edition never says the same thing twice in different words.
function dropEchoes(stories) {
  const kept = [];
  for (const s of stories) {
    const echo = kept.find((k) => {
      if (k.beat !== s.beat) return false;
      let shared = 0;
      for (const n of s.names) if (k.names.has(n)) shared++;
      return shared >= 2;
    });
    if (!echo) kept.push(s);
  }
  return kept;
}

function selectEdition(allStories) {
  const ranked = dropEchoes([...allStories].sort((a, b) => b.weight - a.weight || (b.date || 0) - (a.date || 0)));

  const perOutlet = {};
  const perOutletBeat = {};
  let stateUsed = 0;
  const taken = new Set();

  function canTake(s) {
    if (taken.has(s.id)) return false;
    if ((perOutlet[s.source] || 0) >= MAX_PER_OUTLET) return false;
    if ((perOutletBeat[s.source + '|' + s.beat] || 0) >= MAX_PER_OUTLET_PER_BEAT) return false;
    if (s.isLocal && stateUsed >= MAX_STATE_STORIES) return false;
    return true;
  }
  function take(s) {
    taken.add(s.id);
    perOutlet[s.source] = (perOutlet[s.source] || 0) + 1;
    const k = s.source + '|' + s.beat;
    perOutletBeat[k] = (perOutletBeat[k] || 0) + 1;
    if (s.isLocal) stateUsed++;
  }

  // The lead: the best corroborated stories of the day, each from a different beat
  // so the top of the page is never three versions of one argument.
  const lead = [];
  const leadBeats = new Set();
  for (const s of ranked) {
    if (lead.length >= 3) break;
    if (s.breadth === 'single' || leadBeats.has(s.beat) || !canTake(s)) continue;
    lead.push(s); leadBeats.add(s.beat); take(s);
  }

  const sections = [];
  for (const beat of BEAT_ORDER) {
    const room = BEAT_ROOM[beat];
    const picked = [];
    for (const pass of [false, true]) {
      for (const s of ranked) {
        if (picked.length >= room) break;
        if (s.isLocal !== pass || s.beat !== beat || !canTake(s)) continue;
        if (pass && picked.length >= 2) break;   // local fills a gap, never the page
        picked.push(s); take(s);
      }
    }
    if (picked.length) sections.push({ beat, stories: picked });
  }

  return { lead, sections };
}

/* ----------------------------------------------------------------------- edition */

async function buildEdition(CONFIG) {
  const results = await Promise.all(CONFIG.sources.map(readSource));
  const now = Date.now();

  // How the day's newsrooms spell each word. Used to tell a shouted word from an
  // acronym, so MUW stays MUW while SLAMS becomes Slams.
  const lowercaseLexicon = new Set();
  for (const { items: raw } of results) {
    for (const it of raw) {
      const words = stripHtml(it.title).split(/\s+/).slice(1)
        .concat(stripHtml(it.summary).split(/\s+/).slice(1, 120));
      for (const w of words) {
        const m = w.match(/^([a-z][a-z'’-]+)[,.:;)]?$/);
        if (m) lowercaseLexicon.add(m[1]);
      }
    }
  }

  const items = [];
  for (const { src, items: raw } of results) {
    for (const it of raw) {
      if (!isReporting(it)) continue;
      const age = it.date ? now - it.date : null;
      if (age !== null && (age > 3 * DAY || age < -2 * 60 * 60 * 1000)) continue;
      items.push({
        outlet: src.outlet,
        camp: src.camp,
        lean: src.lean,
        state: src.state || null,
        owner: src.owner,
        scope: src.scope,
        beat: classify(it, src),
        title: firstStory(it.title),
        titleNeutral: neutralizeTitle(firstStory(it.title), lowercaseLexicon),
        summaryText: firstStory(neutralizeSummary(it.summary || it.body, lowercaseLexicon, it.body)),
        longText: firstStory(neutralizeLong(it.summary || it.body, lowercaseLexicon, it.body)),
        link: it.link,
        date: it.date,
        heat: heatScore(it.title),
        // A partner republishing another newsroom's work says so in its own text.
        republished: /\b(originally (reported|published)|republished (from|with permission)|this story was produced by)\b/i
          .test(stripHtml(it.summary || '') + ' ' + stripHtml(it.body || '').slice(0, 400)),
      });
    }
  }

  const seen = new Set();
  const unique = items.filter((it) => {
    const key = it.link.split('?')[0].replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { groups } = clusterItems(unique);
  const stories = buildStories(groups);
  const { lead, sections } = selectEdition(stories);

  const clean = (s) => { const { names, weight, ...rest } = s; return rest; };

  return {
    date: new Date().toISOString().slice(0, 10),
    builtAt: now,
    lead: lead.map(clean),
    sections: sections.map((s) => ({
      beat: s.beat,
      title: CONFIG.beats[s.beat],
      stories: s.stories.map(clean),
    })),
    newsroomsRead: [...new Set(results.filter((r) => r.items.length).map((r) => r.src.outlet))],
    newsroomsQuiet: results.filter((r) => !r.items.length)
      .map((r) => ({ name: r.src.outlet, why: r.error || 'nothing in the last three days' })),
  };
}

module.exports = { buildEdition, readSource, parseFeed, classify, clusterItems };
