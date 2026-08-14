// Emoji grid: hex-packed background positions (computed once, shared by
// every instance) and the EmojiGrid class that crossfades a keyword's
// emoji set in and out over those shared positions.
//
// The Processing original drew these through raw Java2D because its
// text()/PFont pipeline can't resolve surrogate-pair / variation-selector
// sequences into a single glyph. Canvas2D shapes them natively, so the
// whole PGraphicsJava2D / FontRenderContext / getStringBounds escape hatch
// is gone. What replaces it is a different kind of care: Canvas2D
// fillText() with color emoji is markedly slower than Java2D, so drawing
// ~100-200 of them per frame will not hold 60fps. Each unique glyph is
// therefore rasterized once into an offscreen canvas at construction and
// blitted per cell per frame - the same "shape once, reuse everywhere"
// discipline that justified this class in the original.

// Whatever the visitor's OS provides. Coverage differs by device and that
// is an accepted outcome of this port - a machine without a glyph for a
// newer codepoint shows a tofu box rather than falling back to anything.
const EMOJI_FONT_STACK = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const SPRITE_PAD = 2; // css px of slack so glyph antialiasing isn't clipped

let emojiGrids = []; // each match gets its own instance

// The hex grid layout (positions only) is the same for every EmojiGrid
// instance, so it's computed once here and shared, rather than each
// instance rebuilding it.
let gridPositions = [];
let gridPositionsBuilt = false;

// Builds the shared grid positions. Called from setup() after
// createCanvas(), so width/height are already real. The original also
// created a java.awt.Font here; the browser needs no such handle, so
// emojiAwtFont has no counterpart.
function setupEmoji() {
    buildGridPositions();
}

function buildGridPositions() {
    if ( gridPositionsBuilt) return;
    gridPositionsBuilt = true;

    const rowHeight = emojiGridSpacing * 0.87; // ~sqrt(3)/2 for hex packing
    const left   = -emojiOverscan;
    const right  = width + emojiOverscan;
    const top    = -emojiOverscan;
    const bottom = height + emojiOverscan;

    const maxRow = ceil( (bottom - height/2.0) / rowHeight) + 1;
    const maxCol = ceil( (right - width/2.0) / emojiGridSpacing) + 1;

    for ( let r = -maxRow; r <= maxRow; r++) {
        const y = height/2 + r * rowHeight;
        if ( y < top || y > bottom) continue;
        const oddRow = ( ( (r % 2) + 2) % 2) === 1;
        const xOffset = oddRow ? emojiGridSpacing/2 : 0;
        for ( let c = -maxCol; c <= maxCol; c++) {
            const x = width/2 + c * emojiGridSpacing + xOffset;
            if ( x < left || x > right) continue;
            gridPositions.push( createVector( x, y));
        }
    }
}

// New in the web port. buildGridPositions() latches gridPositionsBuilt
// forever, which is correct for a fullscreen Processing sketch that can
// never change size and wrong for a browser window that can. Clearing the
// latch and rebuilding isn't enough on its own: every live instance's
// per-cell arrays are sized to the OLD cell count, so each one has to
// re-derive them against the new positions or it would index off the end.
function rebuildGrid() {
    gridPositions.length = 0;
    gridPositionsBuilt = false;
    buildGridPositions();
    for ( const grid of emojiGrids) grid.rebuildCells();
}

function spawnEmojiGrid( emojiSet) {
    emojiGrids.push( new EmojiGrid( emojiSet));
}

function fadeOutEmojiGrids() {
    for ( const grid of emojiGrids) grid.fadeOut();
}

function drawEmojiGrids() {
    for ( const grid of emojiGrids) grid.show();
}

function pruneEmojiGrids() {
    for ( let i = emojiGrids.length - 1; i >= 0; i--) {
        if ( emojiGrids[i].isDead()) emojiGrids.splice( i, 1);
    }
}

// One instance per active keyword match. Deliberately NOT built from Char:
// complex multi-codepoint emoji (ZWJ sequences, variation selectors) are
// expensive to shape, and doing that shaping work per cell per frame is
// what caused the slowdown the original was written to avoid. Glyphs are
// rasterized once at construction (not per frame), grid positions are
// shared globally (not per instance), and the only thing animated is this
// instance's own alpha fade.
//
// Instances are self-managing: fadeOut() starts the fade, and once alpha
// reaches 0 the instance marks itself dead - pruneEmojiGrids() then removes
// it from emojiGrids. Multiple instances can be alive at once (an old one
// fading out while a new one fades in), which is what makes switching
// keywords - including rapid arrow-key scrolling - a crossfade instead of
// an abrupt content swap.
class EmojiGrid {
    constructor( emojiSet) {
        this.sprites = buildEmojiSprites( emojiSet);
        this.alpha = 0;
        this.alphaTarget = 1; // instances are always created already fading in
        this.lastUpdateMillis = millis();
        this.dead = false;
        this.rebuildCells();
    }

    // Maps every grid cell onto one of this instance's sprites, cycling by
    // index exactly as the original cycled cellChars. Re-runnable, because
    // a window resize changes how many cells there are.
    rebuildCells() {
        const n = gridPositions.length;
        const uniqueN = this.sprites.length;
        this.cellSprites = new Array( n);
        for ( let i = 0; i < n; i++) this.cellSprites[i] = this.sprites[ i % uniqueN];
    }

    fadeOut() {
        this.alphaTarget = 0;
    }

    update() {
        const now = millis();
        const dt = now - this.lastUpdateMillis;
        this.lastUpdateMillis = now;
        const step = dt / ( emojiFadeSeconds * 1000.0);
        if ( this.alpha < this.alphaTarget) this.alpha = min( this.alpha + step, this.alphaTarget);
        else if ( this.alpha > this.alphaTarget) this.alpha = max( this.alpha - step, this.alphaTarget);
        if ( this.alphaTarget === 0 && this.alpha <= 0.001) this.dead = true;
    }

    show() {
        this.update();
        if ( this.alpha <= 0.001) return;

        // The original set an RGBA paint before drawString and mixed a gray
        // mute tint (emojiMuteTint) into it. Its own comment conceded that
        // only fonts "that respect fill" honour the RGB part - color emoji
        // ignore it and paint their own colors - so in practice only the
        // alpha was doing anything. The port keeps the alpha and drops the
        // tint, which is the one intentional visual difference in the whole
        // translation. emojiMuteTint is consequently unused here.
        const ctx = drawingContext;
        const prevAlpha = ctx.globalAlpha;

        // Two opacities, no gradient: a cell is either sitting on the typed
        // phrase or it isn't. typedTextBoxes (typingBuffer.js) holds one box
        // per laid-out line, so the test follows the text exactly - it dims
        // wrapped lines above and below too, and dims nothing at all when
        // there's nothing typed to read.
        for ( let i = 0; i < gridPositions.length; i++) {
            const p = gridPositions[i];
            const s = this.cellSprites[i];
            // Sprite holds the glyph's own bounding box, so centering the
            // sprite centers the glyph - the equivalent of the original's
            // getStringBounds-derived per-cell offsets.
            const x = p.x - s.w / 2;
            const y = p.y - s.h / 2;

            const onText = overlapsTypedText( x, y, s.w, s.h);
            const finalAlpha = this.alpha * ( onText ? emojiMinAlpha : emojiAlphaScale);
            if ( finalAlpha <= 0) continue;

            ctx.globalAlpha = finalAlpha;
            ctx.drawImage( s.canvas, x, y, s.w, s.h);
        }

        ctx.globalAlpha = prevAlpha; // don't leak alpha into the letters drawn next
    }

    isDead() {
        return this.dead;
    }
}

// Rasterizes each unique glyph in the set exactly once. Only emojiSet.length
// distinct glyphs ever appear (the grid cycles them by index), so measuring
// and painting each one once and reusing the result across every cell that
// draws it is the whole performance story of this file.
//
// measureText's actualBoundingBox* fields are the direct analogue of the
// original's getStringBounds() - they give the true painted box, which is
// what the original needed and what FontMetrics.stringWidth() failed to
// provide for variation-selector sequences.
function buildEmojiSprites( emojiSet) {
    const dpr = window.devicePixelRatio || 1;
    const font = `${emojiSize}px ${EMOJI_FONT_STACK}`;

    const probe = document.createElement( 'canvas').getContext( '2d');
    probe.font = font;

    const sprites = [];
    for ( const glyph of emojiSet) {
        const m = probe.measureText( glyph);

        // Fall back to the advance width / em box if a browser doesn't
        // report the actual bounding box, so a missing metric degrades to a
        // slightly loose sprite rather than a zero-sized one.
        const bl = m.actualBoundingBoxLeft    ?? 0;
        const br = m.actualBoundingBoxRight   ?? m.width;
        const ba = m.actualBoundingBoxAscent  ?? emojiSize * 0.8;
        const bd = m.actualBoundingBoxDescent ?? emojiSize * 0.2;

        const w = Math.max( 1, Math.ceil( bl + br) + SPRITE_PAD * 2);
        const h = Math.max( 1, Math.ceil( ba + bd) + SPRITE_PAD * 2);

        const canvas = document.createElement( 'canvas');
        canvas.width  = Math.ceil( w * dpr);
        canvas.height = Math.ceil( h * dpr);

        const c = canvas.getContext( '2d');
        c.scale( dpr, dpr);          // draw in css px, store at device px, so HiDPI stays crisp
        c.font = font;
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillText( glyph, bl + SPRITE_PAD, ba + SPRITE_PAD);

        sprites.push( { canvas: canvas, w: w, h: h });
    }
    return sprites;
}
