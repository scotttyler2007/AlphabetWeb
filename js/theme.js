// Background and letter-color theme state: current/target background
// color, letter-contrast blending, and the contrast-color computation.

// p5's color() can't be called until p5 has booted (setup() hasn't run
// yet, so there's no drawing context) - a top-level
// `const bgCol = color('#020701')` the way the .pde original does with
// `color bgCol = #020701;` would throw at script-load time. So these are
// only declared here (left undefined) and get their real p5.Color values
// assigned in initTheme() below, which setup() calls before anything
// draws.
// The one place the default background color is written down. bgCol is the
// p5.Color built from it; applyThemeFor() compares against the hex form, so
// both must come from here or changing the background would silently break
// the "is this the default?" test.
const bgColHex = '#020701';
let bgCol;
let bgTarget;   // background fades toward this
let bgCurrent;  // background's current (lerped) color

let contrastColor;          // letter color when a crayon match is active
// letterBlend/letterBlendTarget are plain numbers, not colors, so unlike
// the four above they need no color() call and can stay initialized here
// at top level exactly as the .pde original does.
let letterBlend = 0;        // current blend amount toward contrastColor
let letterBlendTarget = 0;  // 0 = normal rainbow letters, 1 = full contrast

// Assigns the color globals declared above (deferred from top level -
// see the comment there), in the same order the original initializes
// them in (bgCol, then bgTarget/bgCurrent derived from it, so that
// intra-file ordering dependency is preserved even though it now runs
// inside a function instead of at top-level declaration time).
//
// Also converts palette.js's letter `colors` array from hex strings to
// p5.Color objects, in place, once. colors arrives from palette.js as
// plain '#rrggbb' strings (per the port's "colors become strings" rule),
// but Char.show() calls lerpColor(colors[this.col], contrastColor, ...)
// every frame for every on-screen letter - lerpColor needs real p5.Color
// objects, not strings, so converting the array once here (instead of
// re-parsing a hex string 60 times a second per letter) is both correct
// and the only sane place to do it, since this file is what first needs
// colors[] to hold real color objects.
//
// Called once from setup(), before setupEmoji() or anything else that
// might draw.
function initTheme() {
    bgCol = color(bgColHex);
    bgTarget = bgCol;
    bgCurrent = bgCol;
    contrastColor = color('#ffffff');

    for (let i = 0; i < colors.length; i++) colors[i] = color(colors[i]);
}

// Advances bgCurrent toward bgTarget by bgLerpSpeed, and letterBlend
// toward letterBlendTarget by letterBlendSpeed. Does NOT call
// background() - draw() does that.
function updateTheme() {
    bgCurrent = lerpColor(bgCurrent, bgTarget, bgLerpSpeed);
    letterBlend = lerp(letterBlend, letterBlendTarget, letterBlendSpeed);
}

// `target` arrives from matching.js as one of two different shapes:
//   - a hex string, when confirmMatch() passes a crayon's .color or a
//     keyword's .bg (both tables store plain '#rrggbb' strings), or
//   - the bgCol p5.Color object itself, when confirmMatch() has no match
//     (its `target = bgCol` default) or when revertMatchVisuals() calls
//     applyThemeFor(bgCol) directly.
// A plain `target !== bgCol` test can't tell those apart once one side may
// be a string and the other a p5.Color, so "is this the default
// background" is decided up front, before normalizing: a string counts
// as default only if it equals the default hex literal; anything else
// (a p5.Color) counts as default only if it's literally bgCol. color()
// then normalizes whichever shape target was into the p5.Color bgTarget
// needs to hold.
function applyThemeFor(target) {
    const isDefault = (typeof target === 'string')
        ? target === bgColHex
        : target === bgCol;
    bgTarget = color(target);
    letterBlendTarget = isDefault ? 0 : 1;
    contrastColor = contrastFor(bgTarget);
}

// Picks white or black, whichever reads clearly against the given color.
// Accepts either a hex string or a p5.Color - color() normalizes either
// shape before red()/green()/blue() read it, so callers on both sides of
// applyThemeFor's string/object split can use this the same way.
function contrastFor(c) {
    const col = color(c);
    const lum = 0.299 * red(col) + 0.587 * green(col) + 0.114 * blue(col);
    return lum > 0.5 ? color(0, 0, 0) : color(1, 1, 1);
}
