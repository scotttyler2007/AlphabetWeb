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

    // loadFonts() and pfonts are gone: there's no PFont/createFont() step
    // any more, palette.js's `fonts` table names CSS font stacks that
    // useFont() (typingBuffer.js) applies directly by name.
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

function keyPressed() {
    if (keyCode === ENTER || keyCode === DELETE) {
        // First Enter on a freshly-typed (or arrow-scrolled) match just
        // triggers its animation - background tint, emoji burst, fanfare -
        // without dispersing anything yet. Only once that match has
        // already been confirmed (or there's no match at all) does Enter
        // perform the normal dispersal.
        if (keyCode === ENTER && hasNewMatch()) {
            confirmMatch();
            return false;
        }
        // Enter or Delete will flushTyping() but only ENTER will change to the next font
        if (typing.length > 0) {
            playDisperseSound(typing.length);
            flushTyping();
            currentText = "";
            if (keyCode === ENTER) nextFont();
            updateMatches();
            revertMatchVisuals()
        }
        return false
    }

    // The original tested `key == CODED` first and then branched on
    // keyCode for the arrow keys; p5 has no CODED equivalent, so this
    // tests keyCode against UP_ARROW/DOWN_ARROW/LEFT_ARROW/RIGHT_ARROW
    // directly.
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

    if (keyCode === BACKSPACE) {
        if (typing.length > 0) {
            popTypingChar();
            playBackspaceSound(typing.length);
            layoutTyping();
            updateMatches();
        }
        return false;
    }

    // Any normal printable character - letters, digits, punctuation, space.
    // p5's `key` is already a string, so this tests key.length === 1 (a
    // multi-char string like "ArrowUp" or "Backspace" means a non-printable
    // key that keyCode already handled above) and its char code in 32..126,
    // and passes `key` straight to appendChar() instead of str(key).
    if (key.length === 1 && key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126) {
        // The buffer can't start with a space (or other whitespace) - deny
        // it and use the backspace sound as a "nope" cue. Spaces are still
        // fine once there's at least one visible character in the buffer.
        // Character.isWhitespace(key) had no single-char JS equivalent, so
        // this uses a regex test; within the 32..126 range already checked
        // above, the space character (32) is the only match it can ever
        // produce.
        if (typing.length === 0 && /\s/.test(key)) {
            playBackspaceSound(typing.length);
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
