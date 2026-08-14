# fonts/

The eight display faces `js/palette.js` rotates through, bundled locally so the
sketch looks the same on every machine instead of depending on what the visitor's
OS happens to have installed.

`fonts.css` declares the `@font-face` rules; `index.html` links it, and
`preloadFonts()` in `js/typingBuffer.js` waits on them before the phrase layout is
measured. Nothing else in the project references these files directly.

## Why substitutes

The original rotation named Georgia, Tahoma, Segoe Script, Constantia, Palatino
Linotype and Cambria — Microsoft/Linotype fonts, licensed for use *on* the systems
that ship them and not redistributable as webfonts. Each slot bundles the
open-licensed face closest to it in character instead.

The original names survive as `local()` entries in each `src:` descriptor, so a
machine that fails to fetch a `.woff2` but does have the real font installed still
gets what the Processing sketch asked for. They live here rather than in a
`font-family` stack in `palette.js` because p5's `textFont()` double-quotes whatever
string it receives — a stack passed through it resolves to nothing and silently
drops the canvas to its default font, which is precisely the bug that bundling
these fonts uncovered.

| Slot | Originally | Bundled | File | Weight |
|---|---|---|---|---|
| 1 | Georgia | Gelasio | `gelasio.woff2` | 700 |
| 2 | Tahoma | Open Sans | `open-sans-700.woff2` | 700 |
| 3 | Segoe Script | Caveat | `caveat-400.woff2` | 400 |
| 4 | Constantia | Source Serif 4 | `source-serif-400.woff2` | 400 |
| 5 | Palatino Linotype | EB Garamond | `eb-garamond-400.woff2` | 400 |
| 6 | Cambria | Caladea | `caladea-700.woff2` | 700 |
| 7 | Georgia | Gelasio | `gelasio.woff2` | 400 |
| 8 | Comic Sans MS | Comic Neue | `comic-neue-700.woff2` | 700 |

Gelasio and Caladea are metric-compatible with Georgia and Cambria respectively —
same advance widths, so those two slots wrap identically to the originals. The rest
are matched by character, not metrics.

Slot 8 is new; the Processing original had a seven-font rotation.

## The files

WOFF2, **latin subsets** from Google Fonts — the exact coverage the sketch can
produce, since `keyPressed()` only accepts ASCII 32..126. 192 KB for all seven
files. The background emoji don't come through this pipeline at all; `emojiGrid.js`
draws those through the raw 2D context using whatever emoji font the OS provides.

`gelasio.woff2` is one variable font (wght 400–700) serving two slots, which is why
`fonts.css` lists it under two `@font-face` rules.

## License

All seven are **SIL Open Font License 1.1** — see `OFL.txt`, which carries the
license body and every bundled font's copyright notice. That file must travel with
these fonts wherever the site is deployed.

Sources, all from [github.com/google/fonts](https://github.com/google/fonts):
[Gelasio](https://fonts.google.com/specimen/Gelasio) ·
[Open Sans](https://fonts.google.com/specimen/Open+Sans) ·
[Caveat](https://fonts.google.com/specimen/Caveat) ·
[Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4) ·
[EB Garamond](https://fonts.google.com/specimen/EB+Garamond) ·
[Caladea](https://fonts.google.com/specimen/Caladea) ·
[Comic Neue](https://fonts.google.com/specimen/Comic+Neue)
