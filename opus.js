'use strict';

// Claude Opus 5.5 reads every outlet's version of each story, writes the neutral
// account, and judges the coverage pattern. It only runs when ANTHROPIC_API_KEY is
// set. Without a key, or if a call fails, the story keeps the measured frame and
// the page still publishes.

const { z } = require('zod');
const AnthropicModule = require('@anthropic-ai/sdk');
const { zodOutputFormat } = require('@anthropic-ai/sdk/helpers/zod');

const Anthropic = AnthropicModule.default || AnthropicModule;

const MODEL = 'claude-opus-5-5';
const EFFORT = process.env.STEADY_EFFORT || 'medium';
const CONCURRENCY = 4;

const VERDICTS = ['none', 'manufactured', 'single-source', 'state-line', 'anonymous', 'one-sided', 'under-covered', 'coordinated-framing'];

const Frame = z.object({
  summary: z.string(),
  differences: z.string(),
  verdict: z.object({
    label: z.enum(VERDICTS),
    title: z.string(),
    reasoning: z.string(),
  }),
});

// Kept identical for every story, so the shared prefix can be cached.
const SYSTEM = `You write the neutral account for a daily news reader called Steady. For each story you receive every outlet's own headline and summary, each labelled with its political camp, owner and funder, plus measurements of the coverage pattern.

Write three things.

summary: two to four plain sentences saying what happened. Use only what the outlets reported. Never add outside knowledge, background or context they did not give. Where outlets disagree on a fact, do not pick one; say that accounts differ. Keep it flat: no adjectives that carry feeling, no fighting verbs, no speculation about motives, no predictions. Name who said something when it is a claim rather than an established fact.

differences: one or two sentences on where the camps' accounts genuinely differ, in what they include, leave out, or how they frame it, naming the camps. Write an empty string if they do not meaningfully differ or only one camp covered it.

verdict: judge whether the coverage pattern itself looks like a coordinated or manufactured push, a single source repeated by many outlets, one state broadcaster's line, a story resting on anonymous officials, a story only one political side is running, one only independent newsrooms have, or the same talking point appearing across outlets in different words (coordinated-framing). Use the measurements as evidence, and also look for things they miss. Choose "none" when the pattern looks like ordinary reporting. Most stories are ordinary; do not reach for a label. title is a short plain sentence naming what you see, empty when the label is none. reasoning is one or two plain sentences citing the specific evidence, empty when the label is none.

Write for a general reader in plain words. Never use em dashes. Never tell the reader how to feel.`;

function storyPrompt(story) {
  const outlets = story.coverage.map((c) => ({
    outlet: c.source,
    camp: c.camp,
    lean: c.lean,
    funding: c.owner,
    state: c.state || undefined,
    headline: c.asPublished,
    summary: c.text,
  }));
  const s = story.frame.signals;
  const measured = {
    outlets: s.outlets,
    camps: s.camps,
    outlets_with_near_identical_wording: s.clonedOutlets,
    share_citing_unnamed_officials: s.anonymous,
    any_document_cited: s.documented,
    share_tracing_to_a_statement: s.statementLed,
    most_outlets_publishing_within_three_hours: s.burst,
    state_broadcaster_share: s.stateShare,
    threshold_verdict: story.frame.verdict ? story.frame.verdict.title : 'none',
  };
  return 'Coverage of one story:\n' + JSON.stringify(outlets, null, 1)
    + '\n\nMeasurements of the coverage pattern:\n' + JSON.stringify(measured, null, 1);
}

// House style applies to the model's words too.
function tidy(text) {
  return String(text || '').replace(/\s*[—–]\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
}

async function frameStory(client, story) {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    // Thinking is always on for Opus 5.5; effort is the only dial, set explicitly.
    output_config: { effort: EFFORT, format: zodOutputFormat(Frame) },
    cache_control: { type: 'ephemeral' },
    system: SYSTEM,
    messages: [{ role: 'user', content: storyPrompt(story) }],
  });

  if (response.stop_reason === 'refusal') {
    const why = response.stop_details ? response.stop_details.category : 'unspecified';
    throw new Error('declined (' + why + ')');
  }
  if (response.stop_reason === 'max_tokens') throw new Error('ran out of room');
  const out = response.parsed_output;
  if (!out) throw new Error('answer did not match the expected shape');

  return {
    usage: response.usage,
    frame: {
      model: 'Opus 5.5',
      summary: tidy(out.summary),
      differences: tidy(out.differences),
      verdict: out.verdict.label === 'none' ? null : {
        key: out.verdict.label,
        title: tidy(out.verdict.title),
        reasoning: tidy(out.verdict.reasoning),
      },
    },
  };
}

async function enrich(edition, { client } = {}) {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      process.stdout.write('No ANTHROPIC_API_KEY, so Opus is skipped and the measured frame is used.\n');
      return { framed: 0, failed: 0, skipped: true };
    }
    client = new Anthropic();
  }

  const stories = [...edition.lead, ...edition.sections.flatMap((s) => s.stories)];
  let framed = 0, failed = 0;
  const totals = { input: 0, output: 0, cacheRead: 0 };

  let next = 0;
  async function worker() {
    while (next < stories.length) {
      const story = stories[next++];
      try {
        const { frame, usage } = await frameStory(client, story);
        story.ai = frame;
        framed++;
        if (usage) {
          totals.input += (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
          totals.cacheRead += usage.cache_read_input_tokens || 0;
          totals.output += usage.output_tokens || 0;
        }
      } catch (e) {
        failed++;
        let why = e && e.message || String(e);
        if (e instanceof Anthropic.AuthenticationError) why = 'the API key was rejected';
        else if (e instanceof Anthropic.RateLimitError) why = 'rate limited';
        else if (e instanceof Anthropic.APIError) why = 'API error ' + e.status;
        process.stdout.write('  Opus skipped "' + story.headline.slice(0, 60) + '": ' + why + '\n');
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stories.length) }, worker));

  // $4 per million in, $20 out, $0.20 per million for cached reads.
  const cost = (totals.input * 4 + totals.output * 20 + totals.cacheRead * 0.2) / 1e6;
  process.stdout.write('Opus framed ' + framed + ' of ' + stories.length + ' stories'
    + (failed ? ', ' + failed + ' fell back to the measured frame' : '')
    + '. About $' + cost.toFixed(2) + ' today.\n');
  edition.model = framed ? 'Opus 5.5' : null;
  return { framed, failed, cost };
}

module.exports = { enrich, frameStory, storyPrompt, MODEL };
