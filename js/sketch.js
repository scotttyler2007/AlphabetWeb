// Alphabet - type a word and watch it fly apart.
//
// Type a crayon color name or an emoji keyword and press Enter: the
// background fades to that color, the letters shift to a readable
// contrast color, a hex grid of matching emoji drifts in behind, and a
// short fanfare plays. Arrow keys scroll through the crayons (up/down)
// and the emoji keywords (left/right).
//
// This is the main file - sketch lifecycle and keyboard input only. The
// rest lives in its own file, all loaded before this one (see the
// <script> order in index.html, which matters because every file's
// top-level let/const share one global scope - the same "all tabs share
// one scope" model Processing used):
//   config.js       tuning constants
//   palette.js      fonts, letter colors, crayon tables
//   keywords.js     emoji keyword tables
//   theme.js        background + letter color state
//   matching.js     which crayon/keyword is matched, and confirming it
//   char.js         one typed letter
//   typingBuffer.js the typed phrase, word wrap, font cache
//   emojiGrid.js    the hex grid of background emoji
//   sound.js        synthesized audio
//
// Ported from sketch.pde. The `import processing.sound.*;` and
// `import processing.awt.PGraphicsJava2D;` lines at the top of the
// original have no JS equivalent and are simply dropped.

function setup() {
    // createCanvas(windowWidth, windowHeight), not fullScreen() - the
    // original was fullscreen-only; the web port is a resizable window
    // instead (see windowResized() below, which the Processing sketch
    // didn't need). No renderer argument, same as the original's bare
    // fullScreen() call: the original stayed off P2D because P2D can't
    // rasterize emoji glyphs into its text atlas. The web port sidesteps
    // that whole question differently - emojiGrid.js draws emoji through
    // the canvas's raw 2D context directly, bypassing p5's text()
    // pipeline entirely - but still wants the plain default (Canvas2D)
    // renderer, not WEBGL, since that raw-context trick needs a 2D
    // context to exist.
    createCanvas(windowWidth, windowHeight);
    frameRate(60);
    colorMode(RGB, 1.0);
    textAlign(CENTER, CENTER);
    noStroke();

    // The original's `background( bgCol);` here is dropped: it's not in
    // the theme.js / palette.js tables until initTheme() runs (color()
    // can't be called before p5 boots - see initTheme()'s own comment),
    // and draw() paints background( bgCurrent) on the very first frame
    // anyway, which starts out equal to bgCol. index.html's page
    // background is also #020701 (== bgCol) so there's no flash either
    // way.
    validateTables();
    initTheme();  // must run before anything draws - see theme.js
    setupEmoji(); // needs width/height, so it has to follow createCanvas()

    // The original's loadFonts() built PFont handles with createFont() and
    // parked them in a pfonts array; there's no such handle here, since
    // palette.js's `fonts` table names CSS font stacks that useFont()
    // (typingBuffer.js) applies by name. What survives the port is only
    // the "start the fonts loading" half of the job: the stacks lead with
    // webfonts bundled in fonts/, and canvas won't fetch those on its own.
    // Unlike loadFonts() this doesn't block - nothing is on screen to
    // mis-measure at startup, and preloadFonts() re-lays-out on arrival.
    preloadFonts();
    //
    // setupSound() is gone too: it only ever built the fixed SinOsc/Env
    // voice pool that config.js's SOUND_VOICES used to size, and that
    // pool has no Web Audio equivalent (see config.js and sound.js).
    // Audio instead starts from index.html's click-to-start overlay
    // calling startAudio(), since AudioContext requires a user gesture
    // that a sketch's own setup() can never provide.
    //
    // The original's closing `println("done");` was a console debug
    // statement with no visual effect; not ported.
}

function draw() {
    updateNoteQueue();
    updateTheme();
    background(bgCurrent);

    // Draw order (back to front): background emoji grid(s), then
    // dispersing letters, then the word currently being typed - so the
    // word is never occluded by the emoji behind it.
    drawEmojiGrids();
    invalidateFontCache(); // the grids blit through the raw 2D context, bypassing our font cache
    drawTypedChars();

    // Prune fully-faded grids and finished-dispersing letters so dead
    // entities stop being updated/drawn and get garbage collected.
    pruneEmojiGrids();
    pruneChars();
}

// New: the Processing original was fullScreen()-only and never resized.
// The web port is a resizable window, so the canvas, the shared emoji
// grid positions, and the typed phrase's centered layout all need to
// re-derive themselves against the new width/height.
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    rebuildGrid();  // emojiGrid.js - clears and rebuilds gridPositions for the new size
    layoutTyping(); // re-centers the phrase currently being typed
}

// What may enter the typing buffer. Letters and digits are the point of the
// sketch; the space and hyphen are here because they are the two word
// separators the matcher understands - tokenize() (matching.js) splits on
// both, so "polar bear" and "polar-bear" reach the same keyword, and blocking
// them would make every multi-word entry untypeable.
//
// Everything else printable - punctuation, brackets, quotes, symbols - is
// refused. None of it can contribute to a match (tokenizing discards it), so
// all it ever did was fill the screen with characters that dissolve into
// nothing, and on a keyboard being mashed by a child that is most of them.
// The hyphen sits last inside the class so it reads as a literal, not a range.
const ALLOWED_CHAR = /^[A-Za-z0-9 -.!?']$/;

// The subset of the above that can't lead: both are separators, and a buffer
// opening with one has nothing to separate.
const SEPARATOR_CHAR = /^[ -]$/;

function keyPressed() {
    if (keyCode === ENTER) {
        if (hasNewMatch()) {
            confirmMatch();
        return false;
        }
        playBackspaceSound(0)
    }
    if (keyCode === DELETE) {
        if (typing.length > 0) playDisperseSound(typing.length);
        flushTyping();
        nextFont();
        updateMatches();
        revertMatchVisuals();
        return false
    }

    if (keyCode === UP_ARROW || keyCode === DOWN_ARROW || keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
        if (keyCode === UP_ARROW || keyCode === DOWN_ARROW) {
            colorIndex = wrapIndex(colorIndex, (keyCode === DOWN_ARROW) ? 1 : -1, crayons.length);
            setBufferToWord(crayons[colorIndex].name);
        } else if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
            emojiIndex = wrapIndex(emojiIndex, (keyCode === RIGHT_ARROW) ? 1 : -1, keywords.length);
            setBufferToWord(keywords[emojiIndex].name);
        }
        return false;
    }

    if (keyCode === 36) {// HOME
        combineEmojiSets = !combineEmojiSets;
        combineEmojiSets ? playTypeSound(0) : playBackspaceSound(0);
    }

    if (keyCode === 35) {// END
        // Clear whatever is staged - emoji grid, background tint, letter
        // color - if anything is, otherwise just beep. shownColorName and
        // shownKeyword are the pair confirmMatch() sets and
        // revertMatchVisuals() clears, so together they are exactly "there is
        // something on screen to clear". Either can be set alone: a crayon
        // with no keyword ("blue") sets only the first, a keyword with no
        // crayon ("cat") only the second, and revertMatchVisuals() undoes the
        // whole scene either way - which is why the test has to cover both,
        // or END would refuse to clear a background it is perfectly capable
        // of clearing.
        //
        // Not hasNewMatch(): that asks whether the buffer matches something
        // that ISN'T showing yet, so it's true for a word typed but not
        // confirmed and false once Enter has staged it - backwards on both
        // counts. Not emojiGrids.length either: a grid already told to fade
        // out stays in that array until its alpha reaches 0, so a quick
        // double tap of END would clear twice instead of beeping.
        if (shownKeyword !== null || shownColorName !== null) {
            playScrollSound();
            revertMatchVisuals();
            return false;
        }
        playBackspaceSound(0);
        return false;
    }

    if (keyCode === BACKSPACE) {
        if (typing.length > 0) {
            popTypingChar();
            playBackspaceSound(typing.length);
            layoutTyping();
            updateMatches();
            if (typing.length <= 0) revertMatchVisuals();
        }
        return false;
    }

    // A printable key at all? p5's `key` is already a string, so this tests
    // key.length === 1 (a multi-char string like "ArrowUp" or "Shift" means a
    // non-printable key, handled above or ignored) and its char code in
    // 32..126. Keys that fail this stay silent - a modifier shouldn't blip.
    if (key.length === 1 && key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126) {
        // ...and is it a character the buffer accepts? Anything printable but
        // disallowed is refused here with the backspace "nope" cue rather
        // than being typed. See ALLOWED_CHAR above for what's in and why.
        //
        // The buffer also can't OPEN with a separator: a leading space or
        // hyphen is the same kind of junk a leading space always was, and it
        // would tokenize away to nothing anyway. Separators are fine once
        // there's at least one visible character to separate from.
        if (!ALLOWED_CHAR.test(key) || (typing.length === 0 && SEPARATOR_CHAR.test(key))) {
            playBackspaceSound(0);
            return false;
        }

        appendChar(key);
        playTypeSound(typing.length); // the original blips for spaces too
        currentText += key;
        layoutTyping();
        updateMatches();
        return false;
    }
}

// Steps an index by dir and wraps it into [0, n). The plain % operator
// isn't enough on its own - it goes negative when scrolling backwards
// past zero.
function wrapIndex(i, dir, n) {
    return ((i + dir) % n + n) % n;
}
