// The phrase currently being typed, the letters already dispersed from
// it, its word-wrap layout, and the font cache used to render both.

let currentText = "";
let typing = [];   // the phrase being typed right now
let chars = [];     // letters that have been dispersed
let font = 0;        // current decorative font, advances each new phrase
let fontColor = 0;   // cycles per letter for a rainbow effect

// One screen-space box per laid-out line of the phrase, or empty when
// nothing is being typed. Set by layoutTyping(), read by emojiGrid.js:
// emoji that land inside a line's box are the ones sitting on top of the
// text, and those are the ones that dim.
let typedTextBoxes = [];

// True when the given rect touches any line of the phrase. Overlap, not
// containment: an emoji that merely clips the edge of a word still has
// pixels sitting over it, and those are exactly the ones that cost
// legibility.
function overlapsTypedText( x, y, w, h) {
    for ( const b of typedTextBoxes) {
        if ( x < b.x2 && x + w > b.x1 && y < b.y2 && y + h > b.y1) return true;
    }
    return false;
}

// There is no PFont any more - fonts[] (palette.js) is indexed by number,
// so the cache sentinel becomes -1 (no valid font index) instead of null.
let lastFontUsed = -1;
// Only calls textFont()/textStyle() when the font actually changed since
// the last draw call - repeatedly re-setting the same font is a real
// cost when a big burst of emoji or letters disperses at once.
function useFont(i) {
    if (i !== lastFontUsed) {
        textFont(fonts[i].family);
        textStyle(fonts[i].bold ? BOLD : NORMAL);
        lastFontUsed = i;
    }
}

// The emoji grids draw through raw Canvas2D (offscreen-canvas sprites
// blitted with drawImage()) and bypass this cache, so draw() calls this
// right after they've drawn, forcing the next useFont() call to re-set
// the font.
function invalidateFontCache() {
    lastFontUsed = -1;
}

function nextFont() {
    font++;
    font %= fonts.length;
}

// Shared body of "commit one glyph to the typing buffer", factored out
// of keyPressed()'s printable-character branch and setBufferToWord() -
// what surrounds it (which sound plays, whether currentText also
// changes) stays with each caller.
function appendChar(glyph) {
    fontColor++;
    fontColor %= colors.length;
    typing.push(new Char(glyph, font, fontColor, new p5.Vector(width / 2, height / 2)));
}

// Shared body of "disperse everything currently being typed", factored
// out of keyPressed()'s ENTER and DELETE branches and setBufferToWord()
// - what surrounds it (which sound plays, whether the font advances,
// whether currentText clears) stays with each caller.
function flushTyping() {
    for (const c of typing) c.disperse();
    chars.push(...typing);
    typing.length = 0;
}

// Peels the last letter off the buffer and disperses it - the single-
// letter counterpart to flushTyping(). Keeping currentText in step is
// this tab's invariant to maintain, not the caller's.
function popTypingChar() {
    const last = typing.pop();
    last.disperse();
    chars.push(last);
    currentText = currentText.substring(0, currentText.length - 1);
}

// Draws already-dispersed letters first, then the word currently being
// typed, so the typed word is never occluded by anything behind it.
function drawTypedChars() {
    for (const c of chars) c.show();
    for (const c of typing) c.show();
}

// Removes finished-dispersing letters so dead ones stop being
// updated/drawn and get garbage collected.
function pruneChars() {
    for (let i = chars.length - 1; i >= 0; i--) {
        if (chars[i].isDead()) chars.splice(i, 1);
    }
}

// Capitalizes the first letter of a lowercase word - used to display
// crayon/keyword names as Title Case when arrow-key navigation auto-
// fills them into the buffer.
function titleCase(word) {
    if (word.length === 0) return word;
    return word.charAt(0).toUpperCase() + word.substring(1);
}

// Replaces whatever is currently being typed with a specific word, all
// at once - used by arrow-key scrolling through colors/keywords. Any
// letters currently on screen disperse first, same as a normal edit.
// The word is shown Title Case and a scroll sound marks the auto-fill,
// distinguishing it from manually typed (lowercase-as-typed) text.
function setBufferToWord(word) {
    flushTyping();
    nextFont();

    const display = titleCase(word);
    for (let i = 0; i < display.length; i++) {
        appendChar(display.charAt(i));
    }
    currentText = display;
    layoutTyping();
    updateMatches();
    playScrollSound();
}

// Word-wraps the currently typed phrase and assigns each Char a target
// position, laid out as centered lines using the active decorative font.
function layoutTyping() {
    if (typing.length === 0) {
        typedTextBoxes.length = 0;
        return;
    }

    useFont(font);
    textSize(bigSize);
    const maxWidth = width * 0.85;

    const lines = [];
    let currentLine = [];
    let lineW = 0;

    let i = 0;
    while (i < typing.length) {
        const wStart = i;
        while (i < typing.length && typing[i].character !== " ") i++;
        while (i < typing.length && typing[i].character === " ") i++;
        const wEnd = i; // exclusive, includes any trailing spaces after the word

        let wordWidth = 0;
        for (let k = wStart; k < wEnd; k++) wordWidth += textWidth(typing[k].character);

        if (lineW + wordWidth > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [];
            lineW = 0;
        }

        // Hard wrap: a single word (or any run with no spaces, like a long
        // buffer typed without hitting space) can still be wider than the
        // screen even on its own fresh line - break it character by
        // character instead of letting it overflow.
        for (let k = wStart; k < wEnd; k++) {
            const cw = textWidth(typing[k].character);
            if (lineW + cw > maxWidth && currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = [];
                lineW = 0;
            }
            currentLine.push(k);
            lineW += cw;
        }
    }
    lines.push(currentLine);

    const lineHeight = bigSize * 0.95;
    const totalHeight = lines.length * lineHeight;
    const startY = height / 2 - totalHeight / 2 + lineHeight / 2;

    typedTextBoxes.length = 0;
    for (let li = 0; li < lines.length; li++) {
        const idxs = lines[li];
        const y = startY + li * lineHeight;
        if (idxs.length === 0) continue;   // a wrap can leave a trailing empty line

        let w = 0;
        for (const idx of idxs) w += textWidth(typing[idx].character);
        const left = width / 2 - w / 2;

        let x = left;
        for (const idx of idxs) {
            const c = typing[idx];
            const cw = textWidth(c.character);
            c.setTarget(x + cw / 2, y);
            x += cw;
        }

        // Letters are drawn centered on y at textSize(bigSize), so the line
        // occupies a full em vertically - a little taller than the glyphs
        // themselves, which gives the box some natural slack.
        typedTextBoxes.push({ x1: left, y1: y - bigSize / 2, x2: left + w, y2: y + bigSize / 2 });
    }
}
