// ---- Config ----
// Numeric tuning constants only - no runtime state, no arrays, no functions.
// Ported from Config.pde. Every Processing global here was declared with a
// mutable type (float/int) but never reassigned at runtime, so per the port
// contract these become `const`, not `let`.

// -- background --
const bgLerpSpeed = 0.05; // how quickly the background fades
const letterBlendSpeed = 0.05;

// -- letters --
const bigSize = 180;      // letters stay large and readable while typing
const growFrames = 12;    // how fast a new letter "pops in" to full size
const startFade = 60;     // how long a dispersed letter takes to fade out
const lerpSpeed = 0.3;  // how snappily letters slide to their wrapped position

// -- emoji grid --
const emojiGridSpacing = 260;   // distance between adjacent emoji cells in the hex grid
const emojiFadeSeconds = 0.2;   // how fast the whole grid fades in/out
const emojiOverscan = emojiGridSpacing; // extra margin beyond every edge so the grid feels endless
const emojiSize = 120;          // render size for background emoji (separate from letter size)
// Emoji opacity is a straight either/or, with no gradient between them: a
// cell that overlaps a line of the typed phrase draws at emojiMinAlpha, and
// every other cell draws at emojiAlphaScale. typingBuffer.js measures the
// per-line boxes; emojiGrid.js does the overlap test.
const emojiAlphaScale = 1.0;   // emoji clear of the text
const emojiMinAlpha = 0.3;     // emoji underneath the text - lower it to push them further back
const emojiMuteTint = 0.75;    // gray fill tint mixed in (helps mute on fonts that respect fill)

// -- sound --
// SOUND_VOICES is omitted. In Processing it sized the fixed round-robin pool
// of SinOsc/Env "voices" that blip() cycled through (see Sound.pde). Web
// Audio OscillatorNodes are single-use - once stopped they can't be
// restarted - so sound.js allocates a fresh OscillatorNode + GainNode per
// blip() call instead of pooling a fixed voice count. There is nothing left
// for a voice-count constant to size.
//
// pow() is a p5 global function, and p5 hasn't attached its globals yet at
// the point this file runs: in global mode p5 creates its instance (and
// with it, all the bare global functions/constants) on the window `load`
// event, which fires only after every classic <script> - including this
// one - has already executed. So this uses Math.pow() instead of pow().
const SEMITONE_RATIO = Math.pow( 2.0, 1.0 / 12.0); // equal-temperament semitone step
const typeBaseFreq = 500;       // pitch with an empty buffer
const typeSemitonesPerChar = 1; // each char steps up by this many semitones
const backspaceBaseFreq = 260;  // lower base than typing, per request
const backspaceSemitonesPerChar = 1;
const backspaceFreqCap = 700;
