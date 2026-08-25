# Alphabet — web port

A p5.js port of the Processing sketch in `../sketch/`. Type a word and watch it fly
apart; type a crayon color name or an emoji keyword and press Enter to tint the
background, recolor the letters, fade in a hex grid of matching emoji, and play a
fanfare. Arrow keys scroll the crayons (up/down) and the emoji keywords (left/right).

## Running it

Any static file server, from this folder — but **not** a bare
`python3 -m http.server`. It sends `Last-Modified` with no `Cache-Control` and no
`ETag`, so browsers fall back to heuristic freshness (roughly 10% of the file's age)
and serve `js/*.js` from cache *without asking the server whether it changed*. Edits
then appear not to take effect, for minutes at a time, with nothing to indicate
you're looking at a stale file. Use this instead:

```bash
python -c "import http.server as h; C=type('C',(h.SimpleHTTPRequestHandler,),{'end_headers':lambda s:(s.send_header('Cache-Control','no-store'), h.SimpleHTTPRequestHandler.end_headers(s))}); h.test(HandlerClass=C, port=8099)"
```

Then open `http://localhost:8099`. Opening `index.html` directly off the filesystem
will not work — the browser blocks the `js/*.js` loads under `file://`.

If you do get a stale page, a normal reload won't clear it: use Ctrl+Shift+R, or
tick **Disable cache** in the DevTools Network tab (which applies only while
DevTools is open).

## Deploying

It's plain static files with no build step, so any static host works — GitHub Pages,
Cloudflare Pages, Netlify. Upload `index.html`, `js/`, `fonts/` and the two
`favicon.*` files — the whole `fonts/` folder, including `OFL.txt`, which the font
license requires travel with the files. `favicon.ico` belongs at the site root,
where browsers look for it whether or not they read the `<link>` tags. p5.js loads
from a pinned CDN (`p5@1.11.3`); vendor it locally if you'd rather not depend on
jsdelivr.

### Caching

Every `js/*.js` file shares one global scope and they load as an interdependent set,
so a visitor holding a stale copy of one file against fresh copies of the others is
the failure worth designing against — not just "the update looks old".

`_headers` sets `max-age=0, must-revalidate` on everything, which **Netlify and
Cloudflare Pages** read at deploy time. That keeps files cached but forces the
browser to check before using one, so an unchanged file costs a 304 with no body and
a changed one is picked up on the next load. No per-deploy step, nothing to remember.

**GitHub Pages — which is where this deploys — ignores `_headers`.** It allows no
header configuration at all and serves its own `Cache-Control` (a short max-age), so
`index.html` itself can be a few minutes stale after a deploy. That window self-heals
and can't be shortened; zero staleness isn't reachable there.

What *is* reachable is removing the dangerous half. Without versioning, `index.html`
and each `js/*.js` expire independently, so a visitor can end up holding a new
`index.html` and an old `sketch.js` — a mismatched set sharing one global scope,
which fails far more confusingly than being cleanly a version behind. So every local
asset URL in `index.html` carries a `?v=` token:

```html
<script src="js/sketch.js?v=202608140530"></script>
```

A changed URL is a different cache entry, so whenever the new HTML lands, every file
it names is fetched fresh together. **Bump the token as part of deploying** — run this
from the project root before you push:

```bash
sed -i "s/?v=[0-9][0-9]*/?v=$(date +%Y%m%d%H%M)/g" index.html
```

(`[0-9][0-9]*` requires at least one digit on purpose — a plain `[0-9]*` also matches
the bare `?v=` written in `index.html`'s own comments and rewrites those too.)

In PowerShell:
`(Get-Content index.html -Raw) -replace '\?v=\d+', "?v=$(Get-Date -Format yyyyMMddHHmm)" | Set-Content index.html -NoNewline -Encoding utf8`

A timestamp rather than a counter, so there's no previous value to look up and it
always moves forward. Forgetting to bump doesn't break anything — it just leaves
returning visitors on the old files until GitHub's own window lapses, which is the
behaviour you'd have had anyway.

The p5 `<script>` is deliberately left un-versioned: its CDN URL already pins an
exact release, so it is immutable by construction. The `.woff2` URLs inside
`fonts.css` are left alone too — a face is only ever swapped by adding a
differently-named file, so there's no stale version for them to serve.

The p5 `<script>` is exempt from all of this: its CDN URL pins an exact version, so
it is immutable by construction and safe to cache forever.

To check what your host actually sends:

```bash
curl -sI https://your-site.example/js/sketch.js
```

## How it's organized

One JS file per Processing tab, loaded as classic `<script>` tags in dependency order
(see the comment above the tags in `index.html`). Every file's top-level `let`/`const`
lands in one shared global scope, which is the same "all tabs share one scope" model
Processing's preprocessor gave the original — that's what keeps this port a readable
line-by-line translation rather than a rewrite.

| File | Ported from |
|---|---|
| `js/config.js` | `Config.pde` |
| `js/palette.js` | `Palette.pde` |
| `js/keywords.js` | `Keywords.pde` |
| `js/theme.js` | `Theme.pde` |
| `js/matching.js` | `Matching.pde` |
| `js/char.js` | `Char.pde` |
| `js/typingBuffer.js` | `TypingBuffer.pde` |
| `js/emojiGrid.js` | `EmojiGrid.pde` |
| `js/sound.js` | `Sound.pde` |
| `js/sketch.js` | `sketch.pde` |

`js/layout.js` and `js/touch.js` have no Processing counterpart — screen scaling and
touch input are problems a fullscreen desktop sketch never had. See the notes below.

`fonts/` has no Processing counterpart — the original used `createFont()` against
whatever was installed on the machine. See [fonts/README.md](fonts/README.md).

## Known differences from the Processing original

**Touch is supported, by a separate input path.** Desktop still runs entirely on
`keyPressed()`. A phone cannot: there is no keyboard on screen until something
focusable is focused by a real user gesture, and Android soft keyboards mostly
report `keyCode 229` / `key: "Unidentified"` on keydown because the text is being
predicted rather than typed — so anything reading keydown loses most Android input.
`js/touch.js` therefore keeps a hidden `<input>`, focuses it on tap, and reconciles
the buffer against the field's value on every `input` event. That reconcile assumes
nothing about how much changed, which is what makes autocorrect, prediction and
paste behave like ordinary typing.

**The touch control surface is deliberately smaller than the desktop one.** A phone
has no arrow keys, no Enter, no Delete and no End, and hiding four more actions
behind long-presses and multi-finger taps would make them undiscoverable rather than
available. Touch gets two gestures:

- **Swipe** — the arrow keys. Up/down walks the crayons, left/right the keywords. It
  never raises the keyboard, and drops it if it is up: swiping is a browsing gesture,
  and summoning a keyboard over the artwork you went looking for is backwards.
- **Tap** — one control whose meaning follows the buffer, which is what lets a single
  gesture cover Enter, clear *and* reopening the keyboard with no on-screen buttons:
  nothing typed → open the keyboard; something to stage → Enter; already staged →
  clear it all, back to nothing typed. The cycle returns to "nothing typed", so the
  next tap raises the keyboard again.

Enter also arrives from the keyboard itself, either as a keydown or as a
`beforeinput` with `insertLineBreak`; both are handled, because a single-line input
silently discards the newline.

DELETE (disperse + next font) and HOME (toggle combined emoji sets) have no touch
equivalent. Both are refinements rather than core actions, and the concession buys an
interface with two gestures instead of six.

**The canvas covers the layout viewport, not the visible one.** These differ once a
soft keyboard is up, and conflating them put a black band under the sketch on
Android: sizing the canvas to the visible area leaves the strip beneath it showing
the body's static `#020701` while the canvas paints `bgCurrent` — two different
blacks the moment a crayon is matched. Only the typed phrase uses the visible
rectangle, centring on `visibleCenterY()` so the word never hides behind the
keyboard. Chrome for Android defaults to `interactive-widget=resizes-visual`, so
`innerHeight` does not change when the keyboard opens, which also means no canvas
resize and no grid rebuild on every keyboard toggle.

**Sizes scale to the screen.** Every size in `config.js` was picked for a fullscreen
desktop window — 180px letters fit two to a line on a 390px phone. `js/layout.js`
derives a `uiScale` from the short edge and each size is multiplied by it where it
is used, so `config.js` keeps stating the desktop baseline. Scaling is clamped at 1,
so a large monitor looks exactly as it always did.

**Emoji coverage varies by device** and that's accepted. Glyphs come from whatever
emoji font the visitor's OS provides (Segoe UI Emoji / Apple Color Emoji / Noto Color
Emoji). Older systems will show tofu boxes for newer codepoints like 🪼 and 🫧. No
emoji webfont is bundled — that would cost ~10MB.

**Fonts are bundled open-licensed stand-ins.** Segoe Script / Constantia / Cambria /
Palatino Linotype are Windows-only, and Georgia / Tahoma / Comic Sans MS aren't
redistributable as webfonts either, so `fonts/` ships an OFL-licensed lookalike for
each slot (Gelasio, Open Sans, Caveat, Source Serif 4, EB Garamond, Caladea, Comic
Neue) and the sketch renders identically on every OS. `palette.js` names one family
per slot plus an explicit bold flag; the OS originals survive as `local()` fallbacks
in `fonts/fonts.css`. See [fonts/README.md](fonts/README.md).

**The rotation is 8 fonts, not 7.** The original had no Comic Sans slot.

**Several keywords can share one emoji grid.** The original matched only the last
keyword in the phrase, and a later word replaced whatever the previous one had
staged. By default this port matches every keyword in the phrase and interleaves
their emoji sets into a single grid, so "the tree and the lobster" drifts trees and
lobsters together, alternating between the sets. Set `combineEmojiSets = false` in
`js/matching.js` for the original last-word-wins behaviour; it's a plain `let`, so it
can also be flipped from the console without a reload. The background tint still
comes from one keyword either way — a background can only be one color.

**The emoji mute tint is gone.** The original set an RGBA paint before `drawString`,
but color-emoji glyphs ignore the RGB part — only the alpha ever applied. The port
keeps the alpha and drops the tint. This is the one intentional visual difference.

**Audio needs a click.** Browsers block `AudioContext` until a user gesture, hence the
click-to-start overlay. The 8-voice pool is also gone: Web Audio oscillators are
single-use, so each blip allocates its own and lets it be collected.

**Window resizing works**, which the fullscreen-only original never had to handle.
`rebuildGrid()` recomputes the shared hex positions and re-derives every live grid's
per-cell arrays.

## Performance note

Canvas2D `fillText` with color emoji is much slower than the original's Java2D path, so
each unique glyph is rasterized once into an offscreen canvas at construction and
blitted per cell per frame. This preserves the "shape once, reuse everywhere" discipline
that the original class was written around. A 1280×800 window is 33 grid cells.
E