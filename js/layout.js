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

// The visible area, which is NOT the same as window.innerWidth/Height once a
// soft keyboard is open. On Android the window itself shrinks, but on iOS it
// does not - the keyboard is painted over the page, so innerHeight still
// reports the full screen and a vertically centred phrase would sit halfway
// underneath the keyboard. visualViewport reports only the uncovered part,
// which is the rectangle the canvas should actually fill.
function viewportW() {
    const vv = window.visualViewport;
    return Math.round( ( vv && vv.width) || window.innerWidth);
}
function viewportH() {
    const vv = window.visualViewport;
    return Math.round( ( vv && vv.height) || window.innerHeight);
}

// Every path that changes the visible area funnels through here: p5's
// windowResized(), a device rotation, and the soft keyboard opening or
// closing. Order matters - the scale has to be current before the grid and
// the phrase re-derive their geometry from it.
function applyViewport() {
    resizeCanvas( viewportW(), viewportH());
    updateUiScale();
    rebuildGrid();   // emojiGrid.js - positions, per-cell arrays and sprite sizes
    layoutTyping();  // typingBuffer.js - re-centres the phrase being typed
}
