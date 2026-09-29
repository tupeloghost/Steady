'use strict';

// The fuller account shown when a story is opened. It is woven from the outlets'
// own sentences: each distinct fact once, near duplicates dropped, every sentence
// credited to the outlet that wrote it. Nothing here is invented.

const { sentences, terms, shingles, overlap } = require('./analyze');

const CAMP_ORDER = ['center', 'independent', 'left', 'right', 'state'];

// Two sentences carry the same idea when they are nearly word for word, or when the
// words they add beyond the story's own topic words are mostly the same. Topic words
// alone ("Cornell", "prosecutors") appear in every sentence and prove nothing.
function sameIdea(a, b, core) {
  if (overlap(shingles(a, 5), shingles(b, 5)) > 0.3) return true;
  const ta = new Set(terms(a).filter((t) => !core.has(t)));
  const tb = new Set(terms(b).filter((t) => !core.has(t)));
  if (ta.size < 3 || tb.size < 3) return false;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size) > 0.5;
}

// The words the story is about, from its headlines, so a stray sentence about
// something else in a long summary is left out.
function coreOf(story) {
  const count = {};
  for (const c of story.coverage) for (const t of new Set(terms(c.asPublished))) count[t] = (count[t] || 0) + 1;
  const shared = Object.keys(count).filter((t) => count[t] >= 2);
  return new Set(shared.length >= 2 ? shared : Object.keys(count));
}

// Against the summary shown above the fold and the headline, a sentence that shares
// most of its words, topic words included, is a restatement of the same fact.
function restates(a, b) {
  const ta = new Set(terms(a)), tb = new Set(terms(b));
  if (!ta.size || !tb.size) return false;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size) > 0.45;
}

function fullerAccount(story, { alreadyShown = '', maxSentences = 6, maxChars = 1100 } = {}) {
  const core = coreOf(story);
  const above = [alreadyShown, story.headline].filter(Boolean);
  // Center and independent outlets first, so the account opens on the least slanted
  // wording available, then each side in turn.
  const ordered = [...story.coverage].sort((a, b) => CAMP_ORDER.indexOf(a.camp) - CAMP_ORDER.indexOf(b.camp));

  const picked = [];
  let chars = 0;
  const seen = alreadyShown ? [alreadyShown] : [];
  // Round robin across outlets, so one outlet cannot write the whole account.
  const pools = ordered.map((c) => ({ outlet: c.source, list: sentences(c.long || c.text) }));
  for (let round = 0; round < 10 && picked.length < maxSentences; round++) {
    for (const pool of pools) {
      const s = pool.list[round];
      if (!s || picked.length >= maxSentences) continue;
      if (/^[a-z]/.test(s) || /^(and|also|meanwhile|plus|but)\b/i.test(s)) continue; // a fragment
      if (round > 1 && !terms(s).some((t) => core.has(t))) continue;              // drifted off topic
      if (above.some((x) => restates(s, x))) continue;                           // the summary or headline again
      if (seen.some((x) => sameIdea(x, s, core))) continue;                         // said already
      if (chars + s.length > maxChars && picked.length >= 2) continue;
      picked.push({ text: s, outlet: pool.outlet });
      seen.push(s);
      chars += s.length;
    }
  }

  // Two or three sentences to a paragraph reads as prose rather than a list.
  const paragraphs = [];
  for (let i = 0; i < picked.length; i += picked.length > 4 ? 3 : 2) paragraphs.push(picked.slice(i, i + (picked.length > 4 ? 3 : 2)));
  return paragraphs;
}

module.exports = { fullerAccount };
