# Alphabet — web port

A p5.js port of the Processing sketch in `../sketch/`. Type a word and watch it fly
apart; type a crayon color name or an emoji keyword and press Enter to tint the
background, recolor the letters, fade in a hex grid of matching emoji, and play a
fanfare. Arrow keys scroll the crayons (up/down) and the emoji keywords (left/right).

## Running it

Any static file server, from this folder:

```bash
python3 -m http.server 8099 --directory .
```

Then open `http://loacalhost:8099`. Opening `index.html` directly off the filesystem
will not work — the browser blocks the `js/*.js` loads under `file://`.

## Deploying

It's plain static files with no build step, so any static host works — GitHub Pages,
Cloudflare Pages, Netlify. Upload `index.html`, `js/`, `fonts/` and the two
`favicon.*` files — the whole `fonts/` folder, including `OFL.txt`, which the font
license requires travel with the files. `favicon.ico` belongs at the site root,
where browsers look for it whether or not they read the `<link>` tags. p5.js loads
from a pinned CDN (`p5@1.11.3`); vendor it locally if you'd rather not depend on
jsdelivr.

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

`fonts/` has no Processing counterpart — the original used `createFont()` against
whatever was installed on the machine. See [fonts/README.md](fonts/README.md).

## Known differences from the Processing original

**Desktop only.** The sketch is entirely keyboard-driven and there is no touch or
soft-keyboard support yet, so it does nothing useful on a phone.

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