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
// A cell that overlaps a line of the typed phrase targets emojiMinAlpha;
// every other cell targets emojiAlphaScale. The overlap test itself stays a
// straight either/or - a cell is on the text or it isn't - but the cell
// eases between the two levels over emojiDimFadeSeconds instead of snapping
// to them. Without that easing every keystroke re-lays out the phrase and
// flips whole rows of cells in a single frame, which reads as a strobe.
// typingBuffer.js measures the per-line boxes; emojiGrid.js does the
// overlap test and the easing.
const emojiAlphaScale = 1.0;   // emoji clear of the text
const emojiMinAlpha = 0.3;     // emoji underneath the text - lower it to push them further back
// Seconds per full 0..1 of alpha travel, same convention as emojiFadeSeconds
// above - so the 1.0 -> 0.3 dip actually takes 0.7 of whatever this says.
const emojiDimFadeSeconds = 0.5;

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

// Nothing bounds the blip pitch any more. Two constants used to: backspace
// FreqCap (700) clamped it with a min(), and noteCycleLength (13) wrapped it
// back to base after an octave. Both stopped the sound tracking the buffer -
// the cap by flattening every long buffer onto one note, the wrap by
// dropping an octave mid-phrase. The pitch now just keeps stepping, up while
// typing and down while deleting. See sound.js for where that runs out of
// audible room.
