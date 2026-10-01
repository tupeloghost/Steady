// Steady feedback relay.
//
// A reader types a note on the page. The page posts it here, and this files it as a
// GitHub issue labelled "feedback", so nobody leaving a note needs an account. The
// GitHub token never reaches the browser: it lives here as a secret.

const MAX_NOTE = 2000;

function cors(env, origin) {
  const allowed = origin === env.ALLOWED_ORIGIN || /^http:\/\/localhost(:\d+)?$/.test(origin || '');
  return {
    'access-control-allow-origin': allowed ? origin : env.ALLOWED_ORIGIN,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function reply(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const headers = cors(env, origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'POST only' }, headers);

    // Only the Steady page may post here.
    if (origin !== env.ALLOWED_ORIGIN && !/^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return reply(403, { ok: false, error: 'not allowed from this page' }, headers);
    }

    if (env.LIMITER) {
      const who = request.headers.get('cf-connecting-ip') || 'unknown';
      const { success } = await env.LIMITER.limit({ key: who });
      if (!success) return reply(429, { ok: false, error: 'too many notes, try again in a minute' }, headers);
    }

    let data;
    try { data = await request.json(); } catch (e) { return reply(400, { ok: false, error: 'bad request' }, headers); }

    // A hidden field people never see. Anything that fills it in is a bot, so it is
    // told it worked and nothing is filed.
    if (clean(data.website, 200)) return reply(200, { ok: true }, headers);

    const note = clean(data.note, MAX_NOTE);
    if (note.length < 3) return reply(400, { ok: false, error: 'the note is empty' }, headers);

    const story = clean(data.story, 300);
    const section = clean(data.section, 80);
    const edition = clean(data.edition, 20);

    const title = 'Feedback: ' + (story ? story.slice(0, 80) : note.slice(0, 80));
    const body = [
      note,
      '',
      '---',
      story ? 'Story: ' + story : 'About: the page in general',
      section ? 'Section: ' + section : null,
      edition ? 'Edition: ' + edition : null,
      'Sent from the Feedback button, no account needed.',
    ].filter((line) => line !== null).join('\n');

    if (!env.GITHUB_TOKEN) return reply(500, { ok: false, error: 'the relay is not set up yet' }, headers);

    const res = await fetch('https://api.github.com/repos/' + env.REPO + '/issues', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + env.GITHUB_TOKEN,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'steady-feedback-relay',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels: ['feedback'] }),
    });

    if (!res.ok) {
      console.log('GitHub refused the note: ' + res.status);
      return reply(502, { ok: false, error: 'could not save the note' }, headers);
    }
    return reply(200, { ok: true }, headers);
  },
};
