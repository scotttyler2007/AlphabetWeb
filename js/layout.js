// Screen-size adaptation and the one viewport question the desktop port
// never had to ask: how big is the part of the page the reader can actually
// see right now?
//
// Every size in config.js was chosen for a fullscreen desktop window - 180px
// letters, 120px emoji, 260px between grid cells. On a phone held upright
// those are enormous: 180px letters fit two to a line on a 390px screen. So
// each of them is multiplied by uiScale where it is used, rather than being
// rewritten - config.js keeps the desktop baseline and stays the one place
// those numbers are stated.
//
// This lives outside config.js on purpose. That file is documented as
// constants that are never reassigned at runtime, and uiScale is precisely
// the opposite: it changes on every resize and rotation.

let uiScale = 1;

// The short edge the config sizes were picked against. Scaling is clamped to
// 1 so a large monitor keeps exactly the proportions it always had - this
// only ever shrinks things for smaller screens, it never inflates them.
const UI_SCALE_BASIS = 900;
const UI_SCALE_MIN = 0.34;   // below this the letters stop being readable at all

function updateUiScale() {
    const shortEdge = Math.min( viewportW(), viewportH());
    uiScale = Math.max( UI_SCALE_MIN, Math.min( 1, shortEdge / UI_SCALE_BASIS));
}

// Two different rectangles, and conflating them is what put a black band
// under the sketch on Android.
//
// The LAYOUT viewport is the whole page, and it is what the canvas must
// cover. Sizing the canvas to the visible area instead leaves the strip
// beneath it showing the body's static #020701 while the canvas paints
// bgCurrent - two different blacks the moment a crayon is matched, which
// reads as a large dead band under the artwork.
//
// Chrome for Android defaults to interactive-widget=resizes-visual, so
// opening the keyboard does NOT change innerHeight - it only shrinks the
// visual viewport. Keeping the canvas on innerHeight therefore also means no
// canvas resize and no grid rebuild every time the keyboard comes and goes.
function viewportW() { return Math.round( window.innerWidth); }
function viewportH() { return Math.round( window.innerHeight); }

// The VISUAL viewport is the part of that page the reader can still see with
// a keyboard up. Only the typed phrase cares: it centres here rather than on
// the canvas, so the word never hides behind the keyboard. offsetTop matters
// because iOS can scroll the visual viewport within the layout one.
function visibleCenterY() {
    const vv = window.visualViewport;
    if ( !vv) return height / 2;
    return vv.offsetTop + vv.height / 2;
}

// Every path that changes the visible area funnels through here: p5's
// windowResized(), a device rotation, and the soft keyboard opening or
// closing. Order matters - the scale has to be current before the grid and
// the phrase re-derive their geometry from it.
function applyViewport() {
    const w = viewportW();
    const h = viewportH();

    // Guarded, because this also fires every time the soft keyboard opens or
    // closes, and that does not change the page size. Rebuilding the grid and
    // re-rasterizing every sprite on each keyboard toggle would be pure waste.
    if ( w !== width || h !== height) {
        resizeCanvas( w, h);
        updateUiScale();
        rebuildGrid();   // emojiGrid.js - positions, per-cell arrays and sprite sizes
    }

    // Always: the canvas may be the same size while the visible centre has
    // moved, which is exactly the keyboard case.
    layoutTyping();      // typingBuffer.js - re-centres the phrase being typed
}
