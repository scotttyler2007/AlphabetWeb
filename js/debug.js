// Build watermark and an optional on-screen state readout.
//
// The watermark exists because a phone gives you no easy way to check which
// files you are actually running. GitHub Pages serves its own cache headers,
// the browser layers heuristic caching on top, and the failure mode is a page
// that looks current while running last week's JavaScript - indistinguishable
// from "the fix did not work" unless something on screen says otherwise.
//
// It is NOT a hand-maintained version number. It reads the ?v= token off the
// script tags, which is the same token the deploy step bumps, so it cannot
// drift from what was actually shipped: if the stamp shows an old number, the
// page is old, full stop.

// Add ?debug to the URL for the live state readout underneath the stamp.
const DEBUG_HUD = /[?&]debug\b/.test( window.location.search);

function buildTag() {
    // Any of the versioned tags will do - they all carry the same token.
    const tagged = document.querySelector( 'script[src*="?v="]');
    if ( !tagged) return "dev";
    const m = tagged.src.match( /[?&]v=([0-9]+)/);
    if ( !m) return "dev";

    // 202608241951 -> 08-24 19:51, which is the part worth reading at a
    // glance: whether this is the build you just pushed or an older one.
    const t = m[1];
    if ( t.length !== 12) return t;
    return `${t.slice(4,6)}-${t.slice(6,8)} ${t.slice(8,10)}:${t.slice(10,12)}`;
}

function setupDebug() {
    const stamp = document.getElementById( "buildStamp");
    if ( stamp) stamp.textContent = "v" + buildTag();

    if ( !DEBUG_HUD) return;
    const hud = document.getElementById( "debugHud");
    if ( !hud) return;
    hud.style.display = "block";

    // Polled rather than driven from draw(), so nothing in the sketch's hot
    // path has to know this exists. 10Hz is plenty to watch a gesture land.
    setInterval( function () {
        const focused = ( typeof softInput !== "undefined" && softInput !== null)
            ? ( document.activeElement === softInput) : false;
        const vv = window.visualViewport;
        hud.textContent = [
            "buffer   " + JSON.stringify( currentText) + "  chars=" + typing.length,
            "match    " + activeKeyword + "   shown=" + shownKeyword,
            "hasNew   " + hasNewMatch(),
            "gesture  " + ( typeof lastGesture === "undefined" ? "n/a" : lastGesture),
            "keyboard " + ( focused ? "focused" : "not focused"),
            "canvas   " + width + "x" + height + "  scale=" + uiScale.toFixed(2),
            "window   " + window.innerWidth + "x" + window.innerHeight,
            "visual   " + ( vv ? Math.round( vv.width) + "x" + Math.round( vv.height) +
                                 " top=" + Math.round( vv.offsetTop) : "n/a"),
            "grids    " + emojiGrids.length,
            "touch    " + isTouch
        ].join( "\n");
    }, 100);
}
