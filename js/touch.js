// Touch and soft-keyboard support. None of this exists on desktop, where a
// physical keyboard delivers keydown straight to p5's keyPressed().
//
// Two separate problems have to be solved to type on a phone:
//
// 1. There is no keyboard on screen until something focusable is focused by
//    a real user gesture. So the page carries a hidden <input>, and tapping
//    the canvas focuses it. It cannot be display:none or visibility:hidden -
//    neither can hold focus - so it is a real, on-screen, invisible element.
//
// 2. Soft keyboards do not report keys the way a physical one does. iOS is
//    mostly well behaved, but Android on-screen keyboards overwhelmingly fire
//    keydown with keyCode 229 and key "Unidentified" - the "still composing"
//    sentinel - because the text is being predicted rather than typed. Any
//    approach that reads keydown loses most Android input. What IS reliable
//    everywhere is the `input` event on the field, so this reads the field's
//    value and reconciles the sketch's buffer against it.
//
// Autocorrect, prediction and paste all arrive as arbitrary value changes
// rather than keystrokes, which the reconcile below handles by construction:
// it never assumes a change was a single character.

let softInput = null;        // the hidden field; stays null on desktop
let touchStart = null;       // {x, y, t} of the touch currently down
let lastGesture = "none";    // what the last touch resolved to, for the debug readout

// Coarse pointer, not screen width: a narrow desktop window is still a
// desktop, and a large tablet still needs the soft keyboard. matchMedia asks
// the question that actually matters - is the primary input imprecise.
function isTouchDevice() {
    return window.matchMedia( "(pointer: coarse)").matches ||
           ( "ontouchstart" in window && navigator.maxTouchPoints > 0);
}

function setupTouch() {
    if ( !isTouchDevice()) return;   // desktop keeps the keydown path untouched

    softInput = document.getElementById( "softInput");
    if ( softInput) {
        softInput.addEventListener( "input", onSoftInput);
        // Enter arrives as a keydown even on keyboards that report nothing
        // useful for letters, because the return key is an action rather than
        // composed text.
        softInput.addEventListener( "keydown", function ( e) {
            if ( e.key === "Enter") { e.preventDefault(); softEnter(); }
        });
        // Second route to the same place. A single-line <input> silently
        // strips newlines from its value, so a keyboard that "inserts a line
        // break" leaves no trace there at all - the only thing that reports
        // it is beforeinput, whose inputType names the intent outright.
        softInput.addEventListener( "beforeinput", function ( e) {
            if ( e.inputType === "insertLineBreak" || e.inputType === "insertParagraph") {
                e.preventDefault();
                softEnter();
            }
        });
        softInput.addEventListener( "blur", function () {
            setSoftValue( currentText);
            // Best-effort catch-up for the one case the size comparison in
            // applyViewport() cannot see: a rotation *while* the keyboard is
            // up, which arrives as a width change measured against an already
            // shrunken height. A no-op whenever nothing moved.
            applyViewport();
        });
    }

    const cv = document.querySelector( "canvas");
    if ( cv) {
        // passive:false because these call preventDefault(): without it a
        // swipe scrolls the page and a double tap zooms it, both of which
        // fight the sketch instead of driving it.
        cv.addEventListener( "touchstart", onTouchStart, { passive: false });
        cv.addEventListener( "touchend", onTouchEnd, { passive: false });
        // A gesture the browser takes away from us - the keyboard animating,
        // a system edge swipe - arrives as touchcancel and never as touchend.
        // Without this the stale start point survives, and the NEXT touch is
        // measured from it: a tap gets scored as a swipe, or vice versa.
        cv.addEventListener( "touchcancel", function () {
            touchStart = null;
            lastGesture = "cancelled";
        }, { passive: false });
        cv.addEventListener( "touchmove", function ( e) { e.preventDefault(); }, { passive: false });
    }

    // The visual viewport is watched for ONE thing: re-centring the phrase.
    // Emphatically not applyViewport() - that would resize the canvas, which
    // is the mistake that put a black band under the artwork. layoutTyping()
    // only re-measures the text against visibleCenterY(); the canvas, the
    // grid and every sprite are left exactly as they are.
    //
    // Needed because the keyboard can close while a phrase is on screen - the
    // back button, or a swipe blurring the field - and the phrase should drop
    // back to centre without waiting for the next keystroke to re-lay it out.
    if ( window.visualViewport) {
        window.visualViewport.addEventListener( "resize", layoutTyping);
        window.visualViewport.addEventListener( "scroll", layoutTyping);
    }

}

// Reading and writing the hidden field, isolated here because the field is a
// contenteditable <div> rather than an <input>, and the two differ in three
// ways that would otherwise be scattered through this file.
//
// It is a div because of the Android Autofill framework. Chrome registers
// form controls with it, and the service then offers passwords, payment cards
// and addresses on a strip above the keyboard - which on a children's typing
// toy is both useless and the last thing anyone wants one tap away.
// autocomplete="off" does not suppress it; Chrome honours that for its own
// autofill, not for the platform service. A contenteditable element is not a
// form control, so it is never registered and the strip has nothing to offer.
//
// To go back to an <input>, change the element in index.html - these two
// functions already handle both shapes and nothing else reads the field.
function softValue() {
    if ( !softInput) return "";
    // Newlines are possible in a contenteditable and not in an input; the
    // return key is handled as Enter, so any that survive are stripped.
    const raw = ( softInput.value !== undefined) ? softInput.value : softInput.textContent;
    return raw.replace( /[\r\n]/g, "");
}

function setSoftValue( text) {
    if ( !softInput) return;
    if ( softInput.value !== undefined) { softInput.value = text; return; }
    if ( softInput.textContent === text) return;

    softInput.textContent = text;

    // Setting textContent drops the caret to the start of the node, so the
    // next keystroke would insert at the FRONT of the word. An <input> puts it
    // at the end for free; a div has to be told. Only while focused, so this
    // never steals a selection from elsewhere on the page.
    if ( document.activeElement !== softInput) return;
    const range = document.createRange();
    range.selectNodeContents( softInput);
    range.collapse( false);              // false == to the end
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange( range);
}

// Asks for real fullscreen - no URL bar, no system navigation strip, and on
// desktop no window chrome either. Like raising the keyboard, this only works
// from inside a user gesture, so it is called from the start overlay tap and
// nowhere else.
//
// Android Chrome honours this. iOS Safari does not: it exposes the Fullscreen
// API for <video> only, and rejects it for anything else. There is no way to
// force it from a page, which is why the manifest and the apple-* meta tags
// exist - adding the sketch to the home screen is the iOS route to the same
// place, and it needs no gesture at all.
//
// Failure is expected and silent. A rejected promise here means the browser
// said no, which is not an error the sketch can or should do anything about.
function requestFullscreenIfPossible() {
    const el = document.documentElement;
    const go = el.requestFullscreen || el.webkitRequestFullscreen;
    if ( !go) return;
    try {
        const r = go.call( el, { navigationUI: "hide" });
        if ( r && r.catch) r.catch( function () {});
    } catch ( e) { /* refused; the page simply stays windowed */ }
}

// Raises the keyboard. Only works from inside a real user gesture, which is
// why it is called from the start overlay tap and from canvas taps, never on
// a timer and never at load.
function showSoftKeyboard() {
    if ( !softInput) return;
    setSoftValue( currentText);      // start in step with what is on screen
    softInput.focus();
}

// Reconciles the sketch buffer against the field value. Deliberately assumes
// nothing about how much changed: it finds how much of the front still
// agrees, rewinds the rest, and types forward from there. One letter, a held
// backspace, an autocorrect swapping a whole word, and a paste all reduce to
// the same two loops.
function onSoftInput() {
    // Only while the field actually has focus. An Android IME commits its
    // composition when the field is blurred, and that commit arrives here as
    // an ordinary input event carrying whatever the IME thought it was
    // holding - often nothing. Acting on it wipes the buffer at the exact
    // moment a swipe just filled it, which leaves typing.length at 0 and
    // every later tap falling into the "open the keyboard" branch instead of
    // Enter or clear. The field is re-synced rather than read.
    if ( document.activeElement !== softInput) {
        setSoftValue( currentText);
        lastGesture = "input ignored (not focused)";
        return;
    }

    // The return key never reaches here - a single-line input cannot hold a
    // newline - and is handled by the keydown and beforeinput listeners in
    // setupTouch() instead.
    syncBufferTo( softValue());
}

// The same character gate keyPressed() applies, enforced here too because a
// soft keyboard can insert anything - emoji, punctuation, a pasted URL - and
// none of it can contribute to a match. Filtering on the way in is what keeps
// the two input paths agreeing on what a buffer may hold.
function acceptableText( text) {
    let out = "";
    for ( const ch of text) {
        if ( !ALLOWED_CHAR.test( ch)) continue;
        if ( out.length === 0 && SEPARATOR_CHAR.test( ch)) continue;  // no leading separator
        out += ch;
    }
    return out;
}

function syncBufferTo( raw) {
    const text = acceptableText( raw);

    // Push the filtered result back if anything was dropped, so the field and
    // the buffer stay identical. Otherwise the next reconcile would compare
    // against characters the sketch refused and try to re-type them forever.
    if ( softInput && softValue() !== text) setSoftValue( text);
    if ( text === currentText) return;

    let keep = 0;
    while ( keep < text.length && keep < currentText.length && text[ keep] === currentText[ keep]) keep++;

    while ( currentText.length > keep && typing.length > 0) {
        popTypingChar();                      // disperses the letter, same as backspace
        playBackspaceSound( typing.length);
    }
    for ( let i = keep; i < text.length; i++) {
        appendChar( text[i]);
        currentText += text[i];
        playTypeSound( typing.length);
    }

    layoutTyping();
    updateMatches();
    if ( typing.length <= 0) revertMatchVisuals();
}

// The return key, doing the same job as the ENTER branch of keyPressed().
function softEnter() {
    if ( hasNewMatch()) {
        confirmMatch();
        return;
    }
    playBackspaceSound( typing.length);
}

function onTouchStart( e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY, t: millis() };
}

// The whole mobile control surface, deliberately smaller than the desktop
// one. A phone has no arrow keys, no Enter, no Delete and no End, and hiding
// four more actions behind long-presses and multi-finger taps would make them
// undiscoverable rather than available. So touch gets two gestures:
//
//   swipe   - the arrow keys. Up/down walks the crayons, left/right the
//             keywords. Never touches the keyboard: it is a browsing gesture,
//             and having it summon a keyboard over the artwork you are trying
//             to look at is exactly backwards.
//
//   tap     - one control whose meaning follows the buffer, which is what
//             lets a single gesture cover Enter, clear AND reopening the
//             keyboard without any on-screen buttons:
//
//               nothing typed      -> open the keyboard (you want to type)
//               something to stage -> Enter (confirm the match)
//               already staged     -> clear it all, back to nothing typed
//
//             so the cycle returns to "nothing typed", where the next tap
//             raises the keyboard again. That is the answer to "how do I get
//             the keyboard back" - clear the screen and tap, which is what a
//             child does anyway when they want to type a new word.
//
// DELETE (disperse + next font) and HOME (toggle combined emoji sets) have no
// touch equivalent. Both are refinements rather than core actions, and the
// concession buys an interface with two gestures instead of six.
const SWIPE_MIN_PX = 45;
const TAP_MAX_PX = 12;
const TAP_MAX_MS = 400;

function onTouchEnd( e) {
    e.preventDefault();
    if ( touchStart === null) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const held = millis() - touchStart.t;
    touchStart = null;

    if ( Math.abs( dx) < TAP_MAX_PX && Math.abs( dy) < TAP_MAX_PX && held < TAP_MAX_MS) {
        onTap();
        return;
    }
    lastGesture = "swipe dx=" + Math.round( dx) + " dy=" + Math.round( dy);

    // Dominant axis wins outright, so a sloppy diagonal does one thing rather
    // than both.
    if ( Math.abs( dx) > Math.abs( dy)) {
        if ( Math.abs( dx) < SWIPE_MIN_PX) return;
        emojiIndex = wrapIndex( emojiIndex, ( dx > 0) ? 1 : -1, keywords.length);
        setBufferToWord( keywords[ emojiIndex].name);
    } else {
        if ( Math.abs( dy) < SWIPE_MIN_PX) return;
        colorIndex = wrapIndex( colorIndex, ( dy > 0) ? 1 : -1, crayons.length);
        setBufferToWord( crayons[ colorIndex].name);
    }

    // setBufferToWord() rewrote the buffer, so the field has to follow or the
    // next reconcile would read the swiped-in word as text to delete.
    //
    // Blurred as well as synced. A focused field is what Android takes as
    // permission to re-raise the keyboard, so leaving focus on it means a
    // swipe pops the keyboard back over the emoji the swipe just went looking
    // for. Dropping focus is what actually keeps a hidden keyboard hidden.
    if ( softInput) {
        setSoftValue( currentText);
        softInput.blur();
    }
}

// The one tap control. See the block above onTouchEnd() for why a single
// gesture carries three meanings and how they cycle.
function onTap() {
    if ( typing.length === 0) {
        lastGesture = "tap -> keyboard (buffer empty)";
        showSoftKeyboard();
        return;
    }

    if ( hasNewMatch()) {
        lastGesture = "tap -> enter";
        confirmMatch();
        return;
    }

    lastGesture = "tap -> clear";

    // Nothing left to stage, so this tap is the clear. Unlike desktop's END -
    // which only reverts the visuals and leaves the phrase up - this also
    // empties the buffer, because an empty buffer is what makes the NEXT tap
    // reopen the keyboard. Leaving the phrase would strand the cycle with no
    // way back to typing.
    playDisperseSound( typing.length);
    flushTyping();
    updateMatches();
    revertMatchVisuals();
    setSoftValue( "");
}
