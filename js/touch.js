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
        softInput.addEventListener( "blur", function () { softInput.value = currentText; });
    }

    const cv = document.querySelector( "canvas");
    if ( cv) {
        // passive:false because these call preventDefault(): without it a
        // swipe scrolls the page and a double tap zooms it, both of which
        // fight the sketch instead of driving it.
        cv.addEventListener( "touchstart", onTouchStart, { passive: false });
        cv.addEventListener( "touchend", onTouchEnd, { passive: false });
        cv.addEventListener( "touchmove", function ( e) { e.preventDefault(); }, { passive: false });
    }

    // The soft keyboard opening does not always resize the window (see
    // layout.js), so the visual viewport is watched directly.
    if ( window.visualViewport) {
        window.visualViewport.addEventListener( "resize", applyViewport);
        window.visualViewport.addEventListener( "scroll", applyViewport);
    }
}

// Raises the keyboard. Only works from inside a real user gesture, which is
// why it is called from the start overlay tap and from canvas taps, never on
// a timer and never at load.
function showSoftKeyboard() {
    if ( !softInput) return;
    softInput.value = currentText;   // start in step with what is on screen
    softInput.focus();
}

// Reconciles the sketch buffer against the field value. Deliberately assumes
// nothing about how much changed: it finds how much of the front still
// agrees, rewinds the rest, and types forward from there. One letter, a held
// backspace, an autocorrect swapping a whole word, and a paste all reduce to
// the same two loops.
function onSoftInput() {
    // Just the value. The return key never reaches here - a single-line
    // input cannot hold a newline, so the browser drops it before this
    // runs - and is handled by the keydown and beforeinput listeners in
    // setupTouch() instead.
    syncBufferTo( softInput.value);
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
    if ( softInput && softInput.value !== text) softInput.value = text;
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

// A swipe stands in for the arrow keys, one axis each, exactly as on desktop:
// up/down walks the crayons, left/right walks the keywords. A tap - short,
// and barely moved - just asks for the keyboard back, since once it closes
// there is no visible field left to aim at.
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
        showSoftKeyboard();
        return;
    }

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
    if ( softInput) softInput.value = currentText;
}
