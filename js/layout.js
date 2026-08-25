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

// Where the typed phrase centres itself: the middle of the part of the page
// still visible, which is half the screen once a soft keyboard is up.
//
// ONLY the phrase uses this. The canvas keeps its full size and the emoji
// grid keeps its own positions, so the artwork stays exactly where it was and
// the keyboard covers the lower part of it - the way a hand would. That
// separation is the whole point: the earlier attempt shrank the canvas to the
// visible area, which left the strip beneath it painting the body's flat
// #020701 against the canvas's bgCurrent - a dead black band the moment a
// crayon was matched. Moving text costs nothing; moving the canvas cost that.
//
// Clamped into the canvas because a browser can report an offsetTop or height
// that puts the centre off the page, and a phrase drawn off-screen looks
// exactly like a phrase that never got typed.
function visibleCenterY() {
    const vv = window.visualViewport;
    if ( !vv || !vv.height) return height / 2;
    return Math.max( 0, Math.min( height, vv.offsetTop + vv.height / 2));
}

// Every path that changes the visible area funnels through here: p5's
// windowResized(), a device rotation, and the soft keyboard opening or
// closing. Order matters - the scale has to be current before the grid and
// the phrase re-derive their geometry from it.
function applyViewport() {
    const w = viewportW();
    const h = viewportH();

    if ( w === width && h === height) return;   // nothing actually moved

    // A soft keyboard, on the browsers that report it as a window resize at
    // all, shows up as the height shrinking and nothing else. A rotation or a
    // desktop window drag changes the width too. So a height-only shrink is
    // taken as the keyboard and ignored outright: the page has not changed
    // shape, part of it is simply covered, and shrinking the canvas to match
    // is what left a strip of flat page background under the artwork.
    //
    // Deliberately not keyed off document.activeElement. Focus looks like the
    // obvious signal and is not one - it is only accurate while the document
    // itself has focus, and the blur event that would pair with it does not
    // fire at all in an unfocused document. Comparing the two sizes needs no
    // events and cannot get out of step.
    if ( isTouch && w === width && h < height) return;

    resizeCanvas( w, h);
    updateUiScale();
    rebuildGrid();   // emojiGrid.js - positions, per-cell arrays and sprite sizes
    layoutTyping();  // typingBuffer.js - re-centres the phrase being typed
}

// Latched once at startup rather than asked each time: the answer cannot
// change for the life of the page, and applyViewport() must not depend on
// touch.js having run.
const isTouch = window.matchMedia( "(pointer: coarse)").matches ||
                ( "ontouchstart" in window && navigator.maxTouchPoints > 0);
