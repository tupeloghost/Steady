'use strict';

// Rule based tone flattener. No model, no network. The original wording is always
// kept alongside the flattened one, so nothing is hidden from the reader.

// Each inflected form is listed on its own so that subject and verb still agree
// after the swap. "Housing costs plummet" must become "Housing costs fall",
// never "Housing costs falls".
const WORD_SWAPS = {
  slam: 'criticize', slams: 'criticizes', slammed: 'criticized', slamming: 'criticizing',
  blast: 'criticize', blasts: 'criticizes', blasted: 'criticized', blasting: 'criticizing',
  rip: 'criticize', rips: 'criticizes', ripped: 'criticized', ripping: 'criticizing',
  torch: 'criticize', torches: 'criticizes', torched: 'criticized', torching: 'criticizing',
  skewer: 'criticize', skewers: 'criticizes', skewered: 'criticized', skewering: 'criticizing',
  eviscerate: 'rebut', eviscerates: 'rebuts', eviscerated: 'rebutted', eviscerating: 'rebutting',
  demolish: 'rebut', demolishes: 'rebuts', demolished: 'rebutted', demolishing: 'rebutting',
  erupt: 'begin', erupts: 'begins', erupted: 'began', erupting: 'beginning',
  explode: 'increase', explodes: 'increases', exploded: 'increased', exploding: 'increasing',
  soar: 'rise', soars: 'rises', soared: 'rose', soaring: 'rising',
  skyrocket: 'rise', skyrockets: 'rises', skyrocketed: 'rose', skyrocketing: 'rising',
  plummet: 'fall', plummets: 'falls', plummeted: 'fell', plummeting: 'falling',
  plunge: 'fall', plunges: 'falls', plunged: 'fell', plunging: 'falling',
  crater: 'fall', craters: 'falls', cratered: 'fell', cratering: 'falling',
  spark: 'prompt', sparks: 'prompts', sparked: 'prompted', sparking: 'prompting',
  ignite: 'prompt', ignites: 'prompts', ignited: 'prompted', igniting: 'prompting',
  slash: 'reduce', slashes: 'reduces', slashed: 'reduced', slashing: 'reducing',
  gut: 'reduce', guts: 'reduces', gutted: 'reduced', gutting: 'reducing',
  scramble: 'work', scrambles: 'works', scrambled: 'worked', scrambling: 'working',
  'vow to': 'plan to', 'vows to': 'plans to', 'vowed to': 'planned to', 'vowing to': 'planning to',
  'fight back against': 'oppose', 'hit out at': 'object to', 'hits out at': 'objects to',
  // phrases
  'hit back': 'respond', 'hits back': 'responds', 'hit back at': 'responded to',
  'fire back': 'respond', 'fires back': 'responds', 'fired back': 'responded',
  'clap back': 'respond', 'claps back': 'responds', 'clapped back': 'responded',
  'lash out': 'object', 'lashes out': 'objects', 'lashed out': 'objected', 'lashing out': 'objecting',
  'brace for': 'prepare for', 'braces for': 'prepares for', 'braced for': 'prepared for', 'bracing for': 'preparing for',
  'warn of': 'point to', 'warns of': 'points to', 'warned of': 'pointed to', 'warning of': 'pointing to',
  'sound the alarm': 'raise concerns', 'sounds the alarm': 'raises concerns', 'sounded the alarm': 'raised concerns',
  'raise the alarm': 'raise concerns', 'raises the alarm': 'raises concerns', 'raised the alarm': 'raised concerns',
  'raise alarm': 'raise concerns', 'raises alarm': 'raises concerns', 'raised alarm': 'raised concerns',
  'race to': 'work to', 'races to': 'works to', 'raced to': 'worked to', 'racing to': 'working to',
  'war on': 'dispute over', 'war over': 'dispute over', 'war against': 'dispute over',
  'battle over': 'dispute over', 'battle for': 'dispute over',
  // nouns that do the arguing for you
  crackdown: 'enforcement action', crackdowns: 'enforcement actions',
  bombshell: 'disclosure', firestorm: 'reaction', backlash: 'criticism',
  'backlash to': 'criticism of', 'backlash against': 'criticism of', 'backlash over': 'criticism of',
  meltdown: 'disruption', chaos: 'disruption', turmoil: 'disruption',
  mayhem: 'disruption', showdown: 'dispute', standoff: 'dispute',
  nightmare: 'problem',
  bloodbath: 'sharp decline', frenzy: 'activity', outrage: 'objections',
  uproar: 'objections',
};

const SWAP_RE = new RegExp(
  '\\b(' + Object.keys(WORD_SWAPS).sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'gi'
);

function isTitleCase(text) {
  const words = text.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length < 4) return false;
  return words.filter((w) => /^[A-Z]/.test(w)).length / words.length >= 0.6;
}

function applySwaps(text) {
  // A swapped word in a sentence stays lower case even if the original was shouted.
  // In a headline set in Title Case, it keeps the capital so the line stays even.
  const titleCase = isTitleCase(text);
  return text.replace(SWAP_RE, (m, _g, offset) => {
    const to = WORD_SWAPS[m.toLowerCase()];
    if (!to) return m;
    const capital = offset === 0 || (titleCase && /^[A-Z]/.test(m));
    return capital ? to.charAt(0).toUpperCase() + to.slice(1) : to;
  });
}

// Adjectives and intensifiers that carry heat and no information.
const HEAT_WORDS = [
  'shocking', 'stunning', 'staggering', 'devastating', 'terrifying', 'horrifying',
  'alarming', 'disturbing', 'outrageous', 'unbelievable', 'incredible', 'insane',
  'brutal', 'savage', 'explosive', 'scathing', 'damning', 'grim', 'dire',
  'desperate', 'frantic', 'furious', 'fiery', 'heartbreaking', 'gut-wrenching',
  'chilling', 'stark', 'dramatic', 'dramatically', 'massive', 'massively', 'huge',
  'whopping', 'unprecedented', 'historic', 'landmark', 'sweeping', 'rampant',
  'crushing', 'record-breaking', 'jaw-dropping', 'eye-popping', 'must-see',
  'must-read', 'viral', 'urgent', 'breaking', 'exclusive', 'shock', 'bitter',
  'stunningly', 'shockingly', 'wildly', 'utterly', 'literally', 'perfect storm',
];

const COLUMN_PREFIX = /^[^|]{3,42}\s\|\s+/;
const PAYWALL_PREFIX = /^(stat\+|wsj|subscriber only|members only)\s*:\s*/i;
const PREFIXES = /^(breaking|exclusive|just in|developing|watch|video|opinion|analysis|live updates?|update|alert|urgent|new)\s*[:\-–—]\s*/i;
const SUFFIX_TAGS = /\s*[|\-–—]\s*(breaking|exclusive|opinion|analysis|watch|video|live)\s*$/i;

// Tails that exist to promise a payoff rather than to say anything.
const BAIT_TAIL = /[,.]?\s*(and\s+)?(here'?s\s+|here\s+is\s+|this\s+is\s+)?(what|why|how)\s+[\w'\u2019 ]{0,24}\b(know|means?|matters?|happens? next)\b\.?\s*$/i;

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;|&lsquo;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;|&ndash;/g, ', ')
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
}

// Feeds escape their markup inconsistently, and some escape it twice. Decoding and
// stripping in one pass leaves visible tags in the text, so both run until stable.
function stripHtml(s) {
  let out = String(s || '');
  for (let i = 0; i < 3; i++) {
    const before = out;
    out = stripTags(decodeEntities(out));
    if (out === before) break;
  }
  return out
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function deCaps(text, lexicon) {
  // Shouting becomes a normal sentence, but real acronyms survive. A run of capitals
  // is only lowered when the day's other headlines show it is an ordinary word.
  return text.replace(/\b[A-Z]{4,}\b/g, (w) => {
    const lower = w.toLowerCase();
    if (lexicon && lexicon.size) return lexicon.has(lower) ? w.charAt(0) + lower.slice(1) : w;
    if (/^(NASA|NATO|USDA|FEMA|NOAA|OSHA|SNAP|COVID|LGBTQ|SCOTUS|USAID|NAACP)$/.test(w)) return w;
    return w.charAt(0) + lower.slice(1);
  });
}

function removeHeat(text) {
  let out = text;
  for (const w of HEAT_WORDS) {
    out = out.replace(new RegExp('\\b' + w.replace(/-/g, '[- ]') + '\\b\\s*', 'gi'), '');
  }
  return out;
}

// A headline written as a question is engagement bait far more often than it is news.
function deQuestion(text) {
  if (!/\?/.test(text)) return text;
  const [head, ...rest] = text.split('?');
  const tail = rest.join('?').replace(/^[\s,.:;\-]+/, '').trim();
  // "Is this a scandal? New filings allege bribery" carries its news after the mark.
  if (tail.split(/\s+/).length >= 5) return tail.charAt(0).toUpperCase() + tail.slice(1);
  let t = head.trim();
  if (!t) return text.replace(/\?/g, '');
  // "Where does the quantum world end" cannot become a noun phrase without conjugating
  // the verb, so it simply loses its question mark and keeps the words it had.
  if (/^(what|why|how|who|whom|when|where)\s+(is|are|was|were|do|does|did|can|could|should|will|would|has|have|may|might)\b/i.test(t)) return t;
  t = t.replace(/^(what|why|how|who|whom|when|where|is|are|was|were|does|do|did|can|could|should|will|would|has|have)\b\s*/i, '');
  t = t.replace(/^(is|are|was|were|the|a|an)\b\s*/i, '');
  return t ? 'On ' + t.charAt(0).toLowerCase() + t.slice(1) : text.replace(/\?/g, '');
}

// "an" before a consonant sound, or "a" before a vowel one, is usually the wreckage
// of a removed adjective. The awkward cases are listed rather than guessed.
const TAKES_AN = /^(hour|honest|honou?r|heir|honorary|mri|fbi|nsa|ira)/i;
const TAKES_A = /^(uni|use|usu|user|euro|one|once|ubiq|eula)/i;

function fixArticles(t) {
  return t.replace(/\b([Aa])n?\s+([A-Za-z](?:[A-Z]\.|[\w'\u2019-])*\.?)/g, (m, a, w) => {
    // An abbreviation is said letter by letter: "a U.K. base", "an FBI agent".
    // ...unless it is said as a word: "a NATO envoy", "a NASA probe".
    const saidAsWord = /^(NATO|NASA|NASCAR|NAACP|UNESCO|UNICEF|OPEC|FEMA|HUD|ICE|SNAP|OSHA|COVID|SCOTUS|DACA|MAGA|AIDS|OPEC|NAFTA|UEFA|FIFA)$/.test(w.replace(/\./g, ''));
    const spelled = !saidAsWord && /^[A-Z](\.|[A-Z]{1,5}$)/.test(w);
    const an = spelled ? /^[AEFHILMNORSX]/.test(w)
      : (/^[aeiou]/i.test(w) && !TAKES_A.test(w)) || TAKES_AN.test(w);
    const word = an ? 'an' : 'a';
    return (a === 'A' ? word.charAt(0).toUpperCase() + word.slice(1) : word) + ' ' + w;
  });
}

function tidy(t) {
  return fixArticles(t)
    .replace(/\s*[–—]\s*/g, ', ')            // never leave an em dash in the copy
    .replace(/["“”']\s*["“”']/g, '')          // empty quotes left by a removed word
    .replace(/\(\s*\)/g, '')
    .replace(/\s*,\s*,\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;!?])/g, '$1')
    .replace(/\s+$/, '')
    .trim();
}

function neutralizeTitle(raw, lexicon) {
  let t = stripHtml(raw);
  t = t.replace(COLUMN_PREFIX, '').replace(PAYWALL_PREFIX, '').replace(PREFIXES, '').replace(SUFFIX_TAGS, '');
  t = t.replace(BAIT_TAIL, '');
  t = deCaps(t, lexicon);
  t = t.replace(/!+/g, '.');
  t = applySwaps(t);
  t = removeHeat(t);
  t = deQuestion(t);
  // Scare quotes around one word imply a sneer. Quotes that follow an attribution
  // word are doing real work, and an apostrophe inside a word is not a quote at all.
  t = t.replace(/(?<!\b(?:as|called|labell?ed|named|dubbed|termed|says?|said|calls?|called|considers?|deems?)\s)(?<![A-Za-z])["\u201c']([a-z][a-z\s-]{2,20})["\u201d'](?![A-Za-z])/gi, '$1');
  t = tidy(t).replace(/[,:;]\s*$/, '').replace(/\.$/, '');
  if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
  return t.length > 3 ? t : stripHtml(raw);
}

// Syndication boilerplate that feeds append to every description.
const BOILERPLATE = [
  /The post\b[\s\S]*?appeared first on\b[^.]*\.?/gi,
  /This (story|article|piece) (was )?(originally |first )?(published|appeared|reported|written|produced)[\s\S]*?\.(?=\s+[A-Z]|\s*$)/gi,
  /\b(originally (published|reported) (by|at|on|in)|republished (from|with permission))[\s\S]*?\.(?=\s+[A-Z]|\s*$)/gi,
  /^\s*(Meet|Follow|Read about|Learn more about|Listen to|Watch)\s+[A-Z][\w'\u2019.]*(?:\s+[A-Z][\w'\u2019.]*){0,3}(\s+and)?\s*/,
  /Continue reading\b[^.]*\.?/gi,
  // The domain aware rule runs first: the general one stops at the dot in "RT.com"
  // and would leave "com." stranded at the end of the sentence.
  /\bRead (Full Article|more|the full story) at [A-Za-z0-9][A-Za-z0-9.\-]*/gi,
  /\bRead (more|the full story|full article)\b[^.]*\.?/gi,
  /\[…\]|\[\.\.\.\]/g,
  /Sign up (for|here|to)[\s\S]*?\.(?=\s+[A-Z]|\s*$)/gi,
  /Warning:\s*This (report|article|story|piece)[\s\S]*?\.(?=\s+[A-Z]|\s*$)/gi,
  /Support (our|independent)[\s\S]*?\.(?=\s+[A-Z]|\s*$)/gi,
  // Stops at a real sentence end, so an abbreviation like U.S. does not cut it short.
  /^[A-Z][\w'\u2019 ]{2,34} is an? (?:nonprofit|non-profit|independent|reader[- ]funded)[\s\S]*?\.(?=\s+[A-Z][a-z]|\s*$)/,
  /^[A-Z][\w'\u2019 ]{2,34} is an? [\w ]{0,24}(?:newsroom|news organization)[\s\S]*?\.(?=\s+[A-Z][a-z]|\s*$)/,
  /This (story|article|piece) (is|was) (part of|produced|co-published)[^.]*\./gi,
  /Subscribe (to|here)[\s\S]*?\.(?=\s+[A-Z]|\s*$)/gi,
];

// Several feeds glue a standfirst straight onto the first paragraph with no full
// stop, which produces one runaway sentence. A break is inserted only where a long
// unpunctuated run is followed by an obvious sentence opener.
const SENTENCE_OPENERS = 'The|A|An|It|He|She|They|Officials|President|Police|Federal|Critics|Researchers|Scientists|Lawmakers|Prosecutors|Authorities|Trump|Congress';
const NEVER_ENDS_A_SENTENCE = new Set('of in at to for and or the with by from on into over under about against as than but nor a an is are was were be been has have had'.split(' '));
const SPLICE = new RegExp('([A-Za-z][A-Za-z\\)]*)\\s+((?:' + SENTENCE_OPENERS + ')\\s+[A-Za-z])', 'g');

function unsplice(text) {
  return text.replace(/[^.!?]{90,}/g, (run) =>
    run.replace(SPLICE, (m, before, after) =>
      // "the Bank of The Gambia" is one name, not two sentences.
      NEVER_ENDS_A_SENTENCE.has(before.toLowerCase()) ? m : before + '. ' + after));
}

function cleanProse(raw, lexicon) {
  let s = unsplice(stripHtml(raw));
  // Twice, because removing a credit sentence can expose the promo line behind it.
  for (let pass = 0; pass < 2; pass++) for (const re of BOILERPLATE) s = s.replace(re, ' ');
  s = s.replace(/^(BREAKING|EXCLUSIVE|UPDATE)\s*[:\-]\s*/i, '');
  s = deCaps(s, lexicon);
  s = s.replace(/!+/g, '.');
  s = applySwaps(s);
  s = removeHeat(s);
  return tidy(s);
}

function balanceQuotes(text) {
  let out = text;
  // A quotation cut in half reads as an error. Drop back a sentence instead.
  while ((out.match(/"/g) || []).length % 2 === 1) {
    const back = out.replace(/[^.!?]*[.!?]["\u2019')\]]*\s*$/, '').trim();
    if (!back || back === out) { out = out.replace(/\s*"[^"]*$/, '').trim(); break; }
    out = back;
  }
  return out;
}

const DANGLING = new Set(('and but or nor yet so which that who whom whose of in on at to for from with by as is are was were be been being have has had do does did will would can could may might should the an their his her its our your my this these those').split(/\s+/));

// A feed that stops mid sentence leaves a word hanging. Trim back to something that
// can end a line rather than putting a full stop after "and".
function trimDangling(text) {
  let out = text;
  for (let i = 0; i < 8; i++) {
    const m = out.match(/\s+([A-Za-z']+)$/);
    if (!m || !DANGLING.has(m[1].toLowerCase())) break;
    out = out.slice(0, m.index);
  }
  return out.replace(/[,;:\s]+$/, '');
}

function finish(text) {
  // A feed that truncates its own standfirst with an ellipsis should not pass that
  // unfinished feeling on to the reader.
  let out = balanceQuotes(text.trim()).replace(/\s*\.{3,}\s*$/, '').replace(/[,;:\s]+$/, '');
  if (!out) return '';
  if (/[.!?]["\u2019')\]]*$/.test(out)) return out;
  // A sentence the feed cut off is dropped rather than given a full stop it never
  // earned. A one line standfirst, which has no earlier sentence, simply gets one.
  const lastStop = Math.max(out.lastIndexOf('. '), out.lastIndexOf('? '), out.lastIndexOf('! '));
  if (lastStop > 40) return balanceQuotes(out.slice(0, lastStop + 1).trim());
  return trimDangling(out) + '.';
}

// Cut at a sentence end, never mid thought, and never with a trailing ellipsis. Text
// that already fits is left whole, so a one line standfirst keeps its last word.
function wholeSentences(text, softLimit = 300, hardLimit = 420) {
  // An abbreviation left stranded by a removed sentence, such as a lone "S." .
  text = String(text).replace(/^[A-Za-z]{1,2}\.\s+/, '').trim();
  if (!text) return '';
  if (text.length <= hardLimit) return finish(text);

  // Protect decimals and abbreviations so a sentence is not cut at 3.75% or U.S.
  const KEEP = '\u0001';
  const masked = text
    .replace(/(\d)\.(\d)/g, '$1' + KEEP + '$2')
    .replace(/\b([A-Z])\.([A-Z])\./g, '$1' + KEEP + '$2' + KEEP)
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sen|Rep|Gov|Gen|Lt|Sgt|St|Jr|Sr|vs|etc|Inc|Corp|No)\./gi, (m) => m.slice(0, -1) + KEEP);
  const parts = (masked.match(/[^.!?]+(?:[.!?]+["\u2019')\]]*|$)/g) || []).map((x) => x.split(KEEP).join('.'));
  let out = '';
  for (const part of parts) {
    const next = (out + part).trim();
    if (out && next.length > hardLimit) break;
    out = next;
    if (out.length >= softLimit) break;
  }
  out = balanceQuotes(out.trim());
  if (!/[.!?]["\u2019')\]]*$/.test(out)) {
    const lastStop = Math.max(out.lastIndexOf('. '), out.lastIndexOf('? '), out.lastIndexOf('! '));
    out = lastStop > 60 ? out.slice(0, lastStop + 1) : finish(out.replace(/[,;:\s]+\S*$/, ''));
  }
  return out;
}

// The description feeds ship is often a one line teaser. When it says nothing, the
// full text of the item is used instead, so every story actually tells you something.
function neutralizeSummary(raw, lexicon, body) {
  let s = wholeSentences(cleanProse(raw, lexicon));
  const thin = s.length < 90 || /\.{3,}\s*$/.test(cleanProse(raw, lexicon))
    || /\b(here is what|find out|learn more|the latest on)\b/i.test(s);
  if (thin && body) {
    const fuller = wholeSentences(cleanProse(body, lexicon));
    if (fuller.length > s.length) s = fuller;
  }
  return s;
}

// A longer cut of the same text, for the fuller account shown when a story is opened.
// Prefers the article body when the feed carries one.
function neutralizeLong(raw, lexicon, body) {
  const a = wholeSentences(cleanProse(raw, lexicon), 1400, 1800);
  const b = body ? wholeSentences(cleanProse(body, lexicon), 1400, 1800) : '';
  return b.length > a.length ? b : a;
}

// How much heat the original carried. Used only to pick the calmest wording of a
// shared story. It is never shown to the reader as a score.
function heatScore(raw) {
  const t = stripHtml(raw);
  let n = 0;
  if (PREFIXES.test(t)) n += 2;
  if (BAIT_TAIL.test(t)) n += 3;
  n += (t.match(/!/g) || []).length * 2;
  if (/\?/.test(t)) n += 2;
  n += (t.match(/\b[A-Z][A-Z]{3,}\b/g) || []).length;
  for (const w of HEAT_WORDS) if (new RegExp('\\b' + w.replace(/-/g, '[- ]') + '\\b', 'i').test(t)) n += 2;
  const hits = t.match(SWAP_RE);
  if (hits) n += hits.length;
  return n;
}

// The headline with its column name and paywall marker taken off, so a filter can
// judge the sentence the newsroom actually wrote.
function headlineCore(raw) {
  return stripHtml(raw).replace(COLUMN_PREFIX, '').replace(PAYWALL_PREFIX, '').replace(PREFIXES, '').trim();
}

module.exports = { neutralizeLong, headlineCore, neutralizeTitle, neutralizeSummary, heatScore, stripHtml };
