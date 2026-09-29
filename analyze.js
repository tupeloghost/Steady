'use strict';

const { stripHtml } = require('./neutralize');

/* --------------------------------------------------------------------- basics */

const STOP = new Set(('a an the and or but of in on at to for from with by as is are was were be been being it its this that these those his her their our your my he she they we you i not no new says said after over under into about more most than then will would can could may might should who whom which what when where why how amid among across during while also just has have had do does did get got make made take took one two three first second last year years day days week weeks month months time times report reports reported study news say some many according told call called back out up down off per via near next still yet own way even much long').split(/\s+/));

const KEEP = '\u0001';

// A decimal point or an abbreviation is not the end of a sentence: "Astra 6.1" and
// "U.S." were both being cut in half.
function sentences(text) {
  const masked = String(text || '')
    .replace(/(\d)\.(\d)/g, '$1' + KEEP + '$2')
    .replace(/\b([A-Z])\.([A-Z])\./g, '$1' + KEEP + '$2' + KEEP)
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sen|Rep|Gov|Gen|Lt|Sgt|St|Jr|Sr|vs|etc|Inc|Corp|No)\./gi, (m) => m.slice(0, -1) + KEEP);
  return (masked.match(/[^.!?]+(?:[.!?]+["\u2019')\]]*|$)/g) || [])
    .map((s) => s.split(KEEP).join('.').trim())
    .filter((s) => s.split(/\s+/).length >= 6);
}

function terms(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9$%.\s-]/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^[.\-]+|[.\-]+$/g, ''))
    .filter((w) => w.length > 3 && !STOP.has(w));
}

// Numbers, money, dates and proper names are the parts of a claim you can check.
function hardFacts(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\$[\d,.]+\s?(?:billion|million|trillion|bn|m)?|\b\d[\d,.]*\s?(?:percent|%|people|votes?|years?|months?|days?|cases?|deaths?|jobs?)\b|\b\d{2,}\b/gi)) {
    out.add(m[0].toLowerCase().replace(/\s+/g, ' ').trim());
  }
  return out;
}

function properNames(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}\b/g)) {
    const v = m[0];
    if (!/^(The|This|That|These|Those|After|Before|While|When|Where|What|Which|But|And|For|From|With|His|Her|Their|Los|New)\b/.test(v)) out.add(v);
  }
  return out;
}

function shingles(text, n = 7) {
  const w = String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const x of a) if (b.has(x)) hit++;
  return hit / Math.min(a.size, b.size);
}

/* ------------------------------------------------------- contested vocabulary */

// Pairs of words that describe the same thing and pick a side by existing.
const FRAMING = [
  { about: 'immigrants', words: ['undocumented', 'illegal immigrant', 'illegal alien', 'illegals', 'migrant', 'asylum seeker', 'illegal migrant'] },
  { about: 'abortion', words: ['pro-life', 'anti-abortion', 'abortion rights', 'pro-choice', 'unborn child', 'fetus', 'baby'] },
  { about: 'guns', words: ['assault weapon', 'modern sporting rifle', 'gun safety', 'gun control', 'gun rights', 'gun violence', 'second amendment'] },
  { about: 'protests', words: ['riot', 'rioters', 'protest', 'protesters', 'unrest', 'uprising', 'demonstration', 'mob', 'agitators'] },
  { about: 'changes to a law', words: ['reform', 'overhaul', 'gutting', 'rollback', 'modernization', 'crackdown', 'dismantling', 'streamlining'] },
  { about: 'government spending', words: ['tax cut', 'tax giveaway', 'stimulus', 'bailout', 'relief', 'handout', 'investment', 'spending spree'] },
  { about: 'the climate', words: ['climate crisis', 'climate change', 'global warming', 'climate emergency', 'green agenda', 'climate alarmism', 'energy transition'] },
  { about: 'political labels', words: ['far-right', 'hard right', 'conservative', 'far-left', 'hard left', 'progressive', 'radical', 'extremist', 'moderate'] },
  { about: 'armed groups', words: ['militant', 'terrorist', 'fighter', 'insurgent', 'freedom fighter', 'gunman', 'rebel', 'soldier'] },
  { about: 'a government', words: ['regime', 'government', 'administration', 'junta', 'authorities'] },
  { about: 'military strikes', words: ['strike', 'attack', 'operation', 'bombing', 'raid', 'defensive action'] },
  { about: 'disputed information', words: ['misinformation', 'disinformation', 'censorship', 'fact-check', 'propaganda', 'narrative', 'conspiracy theory'] },
  { about: 'transgender health care', words: ['gender-affirming care', 'transition care', 'sex change', 'gender ideology', 'transgender care'] },
  { about: 'voting', words: ['election integrity', 'voter suppression', 'election denial', 'voter fraud', 'ballot harvesting', 'voting rights'] },
  { about: 'a transfer of power', words: ['coup', 'transition', 'insurrection', 'protest', 'self-coup', 'unrest'] },
  { about: 'the border', words: ['border crisis', 'border security', 'invasion', 'surge', 'arrivals', 'encounters', 'crossings'] },
  { about: 'police use of force', words: ['officer involved shooting', 'killed by police', 'use of force', 'brutality', 'line of duty', 'suspect'] },
  { about: 'budget cuts', words: ['defund', 'cuts', 'savings', 'efficiencies', 'austerity', 'right sizing', 'waste'] },
  { about: 'deportations', words: ['deportation', 'removal', 'repatriation', 'expulsion', 'self-deport'] },
  { about: 'investigations', words: ['witch hunt', 'investigation', 'probe', 'inquiry', 'fishing expedition', 'oversight'] },
  { about: 'how a source is described', words: ['whistleblower', 'leaker', 'activist', 'agitator', 'advocate', 'lobbyist', 'expert'] },
  { about: 'rising prices', words: ['inflation', 'price gouging', 'greedflation', 'cost of living', 'shrinkflation'] },
  { about: 'job cuts', words: ['layoffs', 'restructuring', 'downsizing', 'job cuts', 'workforce reduction', 'firings'] },
  { about: 'what schools teach', words: ['critical race theory', 'diversity training', 'inclusive curriculum', 'indoctrination', 'dei'] },
  { about: 'civilian harm in war', words: ['precision strike', 'airstrike', 'massacre', 'collateral damage', 'civilian casualties'] },
  { about: 'health rules', words: ['mandate', 'guidance', 'requirement', 'restriction', 'recommendation', 'lockdown'] },
];

/* ------------------------------------------------------------------- the frame */

function openingOf(item, n = 2) {
  const s = sentences(stripHtml(item.summaryText || ''));
  return (s.length ? s.slice(0, n).join(' ') : stripHtml(item.summaryText || ''));
}

// Digest items pack several unrelated stories into one summary, so only the opening
// of an item is treated as being about the item.
function textOf(item) {
  return stripHtml(item.title) + '. ' + openingOf(item);
}

// The words the cluster is actually about, taken from the headlines rather than the
// bodies, so a passing mention cannot drag in another story.
function coreTerms(items) {
  const count = {};
  for (const it of items) for (const t of new Set(terms(stripHtml(it.title)))) count[t] = (count[t] || 0) + 1;
  const shared = Object.entries(count).filter(([, n]) => n >= 2).map(([t]) => t);
  return new Set(shared.length >= 2 ? shared : Object.keys(count));
}

function byCamp(items) {
  const map = {};
  for (const it of items) (map[it.camp] = map[it.camp] || []).push(it);
  return map;
}

// A claim counts as shared when outlets that disagree politically both carry it.
function sharedAccount(items, camps) {
  if (camps.length < 2) return [];
  const campTerms = {};
  for (const c of camps) campTerms[c] = new Set();
  for (const it of items) for (const t of terms(textOf(it))) campTerms[it.camp].add(t);

  const core = coreTerms(items);
  const scored = [];
  for (const it of items) {
    for (const s of sentences(openingOf(it, 3))) {
      const ts = terms(s);
      if (ts.length < 4) continue;
      // The sentence has to be about this story, not about whatever else the item
      // mentioned further down.
      if (ts.filter((t) => core.has(t)).length < 2) continue;
      if (/^[a-z0-9]|^[\d.]+%/.test(s)) continue;   // a dek spliced onto a body
      if (/^(and|also|meanwhile|plus|elsewhere)\b[,:]?\s/i.test(s)) continue;   // a digest moving on
      let crossed = 0;
      for (const t of new Set(ts)) {
        let seen = 0;
        for (const c of camps) if (campTerms[c].has(t)) seen++;
        if (seen >= 2) crossed++;
      }
      const facts = hardFacts(s).size;
      scored.push({ text: s, outlet: it.outlet, camp: it.camp, score: crossed / Math.sqrt(ts.length) + facts * 0.4 });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const picked = [];
  for (const cand of scored) {
    if (picked.length >= 3) break;
    if (picked.some((p) => p.outlet === cand.outlet)) continue;
    if (picked.some((p) => overlap(shingles(p.text, 5), shingles(cand.text, 5)) > 0.3)) continue;
    if (cand.score < 0.6) continue;
    picked.push(cand);
  }
  return picked;
}

// What one side carries and the other never mentions.
function onlyFrom(items, camp, others) {
  const mine = items.filter((i) => i.camp === camp);
  if (mine.length < 1 || !others.length) return null;

  // Only the headline and its first sentence count. A digest item's later sentences
  // belong to a different story and would otherwise look like an exclusive detail.
  const head = (it) => stripHtml(it.title) + '. ' + openingOf(it, 1);

  const theirTerms = new Set();
  for (const it of items) if (it.camp !== camp) for (const t of terms(textOf(it))) theirTerms.add(t);
  const theirFacts = new Set();
  for (const it of items) if (it.camp !== camp) for (const f of hardFacts(textOf(it))) theirFacts.add(f);

  const outletsFor = {};
  for (const it of mine) for (const t of new Set(terms(head(it)))) (outletsFor[t] = outletsFor[t] || new Set()).add(it.outlet);

  // Only a name, a place or an organisation counts as something one side alone
  // reported. A common word the other side simply did not use is not a fact.
  const named = new Set();
  for (const it of mine) {
    for (const n of properNames(head(it))) for (const w of n.toLowerCase().split(/\s+/)) named.add(w);
    for (const m of head(it).matchAll(/\b[A-Z]{3,}\b/g)) named.add(m[0].toLowerCase());
  }

  const distinctive = Object.entries(outletsFor)
    .filter(([t, outs]) => outs.size >= (mine.length > 2 ? 2 : 1) && !theirTerms.has(t))
    // a name, a place, or a word the headline itself used, rather than filler
    .filter(([t]) => named.has(t) && t.length > 3)
    .map(([t]) => t);

  const facts = [];
  for (const it of mine) for (const f of hardFacts(head(it))) if (!theirFacts.has(f)) facts.push(f);

  if (!distinctive.length && !facts.length) return null;

  let quote = null;
  for (const it of mine) {
    for (const s of sentences(openingOf(it, 3))) {
      const hits = terms(s).filter((t) => distinctive.includes(t)).length + [...hardFacts(s)].filter((f) => facts.includes(f)).length;
      if (hits >= 2 && (!quote || hits > quote.hits)) quote = { text: s, outlet: it.outlet, hits };
    }
  }

  return {
    camp,
    outlets: [...new Set(mine.map((i) => i.outlet))],
    terms: distinctive.slice(0, 8),
    facts: [...new Set(facts)].slice(0, 5),
    quote: quote ? { text: quote.text, outlet: quote.outlet } : null,
  };
}

function framingSplits(items, camps) {
  if (camps.length < 2) return [];
  const out = [];
  for (const family of FRAMING) {
    const used = {};
    for (const it of items) {
      const t = textOf(it).toLowerCase();
      for (const w of family.words) {
        if (t.includes(w)) {
          (used[it.camp] = used[it.camp] || new Set()).add(w);
        }
      }
    }
    const campsUsing = Object.keys(used);
    if (campsUsing.length < 2) continue;
    const all = new Set();
    for (const c of campsUsing) for (const w of used[c]) all.add(w);
    if (all.size < 2) continue;   // everyone used the same word, no split
    out.push({
      about: family.about,
      byCamp: Object.fromEntries(campsUsing.map((c) => [c, [...used[c]]])),
    });
  }
  return out.slice(0, 3);
}

/* -------------------------------------------------------- manufacture signals */

const ANON = /\b(officials? (said|told|say)|sources? (said|told|say|familiar)|people familiar|person familiar|condition of anonymity|anonymous|briefed on the matter|according to (a|two|three|several) (person|people|source|official))\b/i;
const DOCUMENT = /\b(report|filing|lawsuit|complaint|opinion|transcript|document|dataset|data|study|affidavit|indictment|memo|audit|ruling)\b/i;
const STATEMENT = /\b(said in a statement|in a statement|according to a statement|press release|announced (on|that)|statement (said|released))\b/i;

function manufactureSignals(items) {
  const outlets = [...new Set(items.map((i) => i.outlet))];
  const camps = [...new Set(items.map((i) => i.camp))];
  const texts = items.map(textOf);

  // near identical wording between different outlets
  const sh = items.map((i) => shingles(stripHtml(i.summaryText || ''), 7));
  let clonePairs = 0, cloneBest = 0;
  const clonedOutlets = new Set();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].outlet === items[j].outlet) continue;
      const o = overlap(sh[i], sh[j]);
      if (o > cloneBest) cloneBest = o;
      if (o >= 0.25) { clonePairs++; clonedOutlets.add(items[i].outlet); clonedOutlets.add(items[j].outlet); }
    }
  }

  const anonymous = texts.filter((t) => ANON.test(t)).length / texts.length;
  const documented = texts.some((t) => DOCUMENT.test(t));
  const statementLed = texts.filter((t) => STATEMENT.test(t)).length / texts.length;

  // a wall of coverage inside a few hours
  const stamps = items.map((i) => i.date).filter(Boolean).sort((a, b) => a - b);
  let burst = 0;
  for (let i = 0; i < stamps.length; i++) {
    const within = items.filter((x) => x.date && x.date >= stamps[i] && x.date - stamps[i] <= 3 * 60 * 60 * 1000);
    burst = Math.max(burst, new Set(within.map((x) => x.outlet)).size);
  }

  const stateItems = items.filter((i) => i.camp === 'state');
  const stateShare = stateItems.length / items.length;
  // Broadcasters of rival states agreeing is corroboration, not a push. Only one
  // state speaking with several mouths is worth flagging.
  const states = [...new Set(stateItems.map((i) => i.state).filter(Boolean))];
  // Only the left and the right count as sides. The center and independents are not
  // an opposing camp, so their presence means the story is not one sided.
  const sideCamps = [...new Set(items.filter((i) => i.camp !== 'state' && i.camp !== 'independent').map((i) => i.camp))];
  const nonState = items.filter((i) => i.camp !== 'state');
  const nonStateOutlets = [...new Set(nonState.map((i) => i.outlet))];
  const campOutlets = {};
  for (const i of nonState) (campOutlets[i.camp] = campOutlets[i.camp] || new Set()).add(i.outlet);

  return {
    outlets: outlets.length,
    camps,
    clonedOutlets: [...clonedOutlets],
    cloneBest: Number(cloneBest.toFixed(2)),
    anonymous: Number(anonymous.toFixed(2)),
    documented,
    statementLed: Number(statementLed.toFixed(2)),
    burst,
    stateShare: Number(stateShare.toFixed(2)),
    stateOutlets: [...new Set(stateItems.map((i) => i.outlet))],
    states,
    stateOnly: items.every((i) => i.camp === 'state'),
    // one side of the aisle, at least two of its outlets, and nobody else in the room
    oneSided: sideCamps.length === 1 && sideCamps[0] !== 'center'
      && (campOutlets[sideCamps[0]] || new Set()).size >= 2,
    soleCamp: sideCamps.length === 1 ? sideCamps[0] : null,
    sideOutlets: sideCamps.length === 1 ? [...(campOutlets[sideCamps[0]] || [])] : [],
    onlyIndependent: camps.length === 1 && camps[0] === 'independent' && outlets.length >= 2,
    nonStateOutlets: nonStateOutlets.length,
  };
}

const CAMP_NAME = { left: 'the left', right: 'the right', center: 'the center', state: 'government-funded outlets', independent: 'independent outlets', local: 'local outlets', good: 'good news outlets' };

// She asked for a verdict, not just measurements. It is graded, and every verdict
// prints the evidence it was drawn from so it can be checked and argued with.
function verdict(sig) {
  const reasons = [];
  let level = null;

  const cloned = sig.clonedOutlets.length;
  if (cloned >= 3) reasons.push(cloned + ' outlets used nearly the same wording, so this is likely one source repeated, not ' + cloned + ' separate reports');
  else if (cloned === 2) reasons.push('two outlets used nearly the same wording');

  if (sig.anonymous >= 0.5 && sig.outlets >= 3) reasons.push('most of the coverage relies on unnamed officials');
  if (!sig.documented && sig.outlets >= 4) reasons.push('none of the coverage points to a document, court ruling, report or data');
  if (sig.statementLed >= 0.5 && sig.outlets >= 3) reasons.push('most of the coverage repeats a press release or official statement');
  if (sig.burst >= 6) reasons.push(sig.burst + ' outlets published it within the same three hours');

  // A world story carried only by a government-funded outlet is ordinary, not a warning
  // sign, so it is left to Opus to judge rather than flagged by a threshold.

  if (sig.oneSided) reasons.push('reported by ' + sig.sideOutlets.join(', ') + ', and no outlet from the other side');
  if (sig.onlyIndependent) reasons.push('no left, center or right outlet has reported it yet');

  const heavy = (cloned >= 3 ? 1 : 0) + (sig.anonymous >= 0.5 ? 1 : 0) + (sig.burst >= 6 ? 1 : 0)
    + (sig.statementLed >= 0.5 ? 1 : 0) + (!sig.documented && sig.outlets >= 4 ? 1 : 0);

  if (heavy >= 3) level = { key: 'manufactured', title: 'This looks like a coordinated push' };
  else if (cloned >= 3 || (sig.statementLed >= 0.5 && sig.outlets >= 3)) level = { key: 'single-source', title: 'Many outlets, one source' };
  else if (sig.anonymous >= 0.6 && sig.outlets >= 3) level = { key: 'anonymous', title: 'Relies on unnamed sources' };
  else if (sig.oneSided) level = { key: 'one-sided', title: 'Only ' + CAMP_NAME[sig.soleCamp] + ' is running this' };
  else if (sig.onlyIndependent) level = { key: 'under-covered', title: 'Only independent outlets have this' };

  if (!level) return null;
  return { ...level, reasons: reasons.length ? reasons : ['based on how the story was covered'] };
}

/* ------------------------------------------------------------------- assemble */

function analyze(items) {
  const camps = [...new Set(items.map((i) => i.camp))];
  const nonState = camps.filter((c) => c !== 'state');
  const sig = manufactureSignals(items);

  return {
    camps,
    outletsByCamp: Object.fromEntries(Object.entries(byCamp(items))
      .map(([c, list]) => [c, [...new Set(list.map((i) => i.outlet))]])),
    shared: sharedAccount(items, camps),
    // One stray word is not an exclusive. Say nothing unless there is real substance.
    only: nonState.map((c) => onlyFrom(items, c, camps.filter((x) => x !== c))).filter(Boolean)
      .filter((o) => o.terms.length >= 2 || o.facts.length >= 1),
    framing: framingSplits(items, camps),
    signals: sig,
    verdict: verdict(sig),
  };
}

module.exports = { analyze, CAMP_NAME, sentences, terms, shingles, overlap };
