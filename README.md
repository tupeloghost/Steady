# Steady

Top stories read across the whole spectrum at once, condensed to what every side
agrees on, with the disagreements listed rather than blended away.

The outlets here are inputs to compare, not sources to trust. Left, center, right,
state broadcasters and independent newsrooms all feed in, precisely so a story can be
read against itself. Agreement between outlets that dislike each other is the only
thing treated as evidence.

## Read it every day, from any phone

The published copy rebuilds itself every morning on GitHub and lives at a single web
address. Nothing on this Mac needs to be on. Save the address to your phone's home
screen and it behaves like an app. Each morning's edition is also kept, reachable from
"Earlier editions" at the bottom of the page.

To rebuild by hand: the repository's Actions tab, "Publish today's edition", then
"Run workflow".

## Run it on this Mac

Double click **Steady.command**, or:

    export PATH="$HOME/.local/node/bin:$PATH"
    cd steady
    node server.js        # then open http://localhost:5182

No dependencies, no API keys, no build step, no client side JavaScript, nothing
written by a model. Node 18 or newer. Every build also writes **latest-edition.html**,
which opens with no server running.

## What each story shows

- **What every side agrees on.** Sentences carried by outlets in opposing camps,
  quoted exactly and attributed to the outlet that published them. Nothing is
  paraphrased or invented.
- **What only one side reports.** Names, places and figures that appear on one side
  and nowhere on the other, with a representative quote. Bare words are not enough to
  qualify, so this section stays empty unless there is real substance.
- **Same thing, different words.** Where camps use different vocabulary for one
  subject: reform against gutting, protest against riot, militant against terrorist.
- **Every headline, side by side.** All coverage grouped by camp so you can see who
  wrote what.

## The verdict

When the coverage pattern is off, the app says so and prints the evidence it used.
Verdicts are graded:

| Verdict | Fires when |
| --- | --- |
| This looks manufactured | three or more heavy signals at once |
| This is one source wearing many hats | three outlets running near identical wording, or coverage tracing to a press release |
| Only the X state broadcaster has this | no commercial or independent outlet has picked it up |
| Anonymous all the way down | most coverage rests on unnamed officials |
| Only the left, or the right, is running this | one side of the aisle, two or more of its outlets, nothing from the other |
| Only independent newsrooms have this | nobody on either side has it |

The signals measured are: identical wording across outlets, unnamed sourcing, whether
any document is cited, statement-led coverage, how many outlets published inside the
same three hours, and which states fund the broadcasters carrying it. Broadcasters of
rival states agreeing is treated as corroboration, not as a push.

**This will be wrong sometimes.** A verdict is a judgment drawn from thresholds, and
thresholds can be fooled. The evidence sits under every verdict for exactly that
reason. Argue with it.

## The design

Set in Hoefler Text, falling back through Iowan Old Style and Charter to Georgia. All
labels are real small caps in the text face rather than letterspaced sans, and figures
are old style, so numbers sit in the line instead of shouting over it. Headlines wrap
balanced and punctuation hangs into the margin.

The masthead and section heads are centered, each section title flanked by rules, with
a double rule under the masthead and above the ending. Body copy stays left aligned.
One column, one serif, one accent. Amber is reserved for verdicts and appears nowhere
else. There is no red anywhere, and no images, scripts or web fonts.

Under every story is a five mark bar reading left, center, right, state, independent.
A filled mark means that side carried the story, a heavier mark means three or more of
its outlets did. A story only the right ran fills the third mark and nothing else,
legible before you have read a word. A legend states the order once, and the words
beside each bar name the camps for anyone not reading marks.

Agreement and disagreement are set apart rather than blended. The agreed account sits
against a solid accent rule with a faint wash and a quotation mark in its corner, since
it is the load bearing part of the page. What one side alone reports sits against a
plain grey rule at the same indent, so it can never be mistaken for the shared account.
On a story where the agreed account carries two or more sentences, the lead outlet's own
summary is dropped: keeping it would repeat the story and put one outlet's framing above
the shared one.

There is a print stylesheet, a dark mode with its own palette, and a phone layout with
no horizontal scroll.

## Files

    sources.json        every outlet with its lean, owner, funder and, for state
                        broadcasters, which state
    neutralize.js       language layer: flattens headlines, repairs summaries
    analyze.js          the frame: shared account, divergence, framing, signals, verdict
    pipeline.js         fetch, parse, filter, classify, cluster, select
    render.js           the page, rendered on the server
    server.js           routing and the once a day cache
    latest-edition.html standalone copy of the newest edition
    Steady.command      double click to run

## How stories are grouped

Items are clustered by meaning, weighted by how rare each word is across the day.
Grouping compares an item against the whole cluster rather than its nearest member,
which stops unrelated stories chaining together through a shared middle item. Two
headlines full of names that share none of them are kept apart, so the Federal Reserve
and the Bank of Japan raising rates stay two stories. Feeds that bolt two stories into
one entry are trimmed to the first.
