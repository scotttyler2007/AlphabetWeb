// ---- Sound design ----
// Raw Web Audio API - NOT p5.sound. p5.sound is heavy and unreliable, and
// this sketch only ever needs five short blip shapes, so there is no reason
// to pull in the whole library.
//
// Structural difference from the Processing original: the .pde version pre-
// allocated an 8-voice pool of SinOsc/Env pairs (voices[], envs[],
// voiceIndex, SOUND_VOICES) and round-robinned through them, because
// Minim/Processing-Sound oscillators are reusable, long-lived objects. Web
// Audio's OscillatorNode is single-use - once you call stop() on one it can
// never be started again - so there is nothing to keep in a pool. Instead,
// blip() allocates a fresh OscillatorNode + GainNode every call, wires them
// together, runs the envelope, and lets them fall out of scope (and get
// garbage collected by the browser) once stop() fires. voices, envs,
// voiceIndex, setupSound(), and SOUND_VOICES all disappear entirely.

let audioCtx = null; // created on first user gesture by startAudio(); stays null until then

// Creates the AudioContext on first call (must happen from a user gesture -
// browsers block audio until then) and resumes it if a previous suspend
// (e.g. tab backgrounding) left it paused. index.html's click-to-start
// overlay calls this.
function startAudio() {
    if ( audioCtx === null) {
        audioCtx = new ( window.AudioContext || window.webkitAudioContext)();
    }
    if ( audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Plays one short envelope-shaped sine tone. Reproduces Processing Sound's
// Env.play( osc, attack, sustain, sustainLevel, release) shape exactly:
// gain ramps 0 -> amp over `attack` seconds, holds at `amp` for `sustain`
// seconds, then ramps back to 0 over `release` seconds. No-ops safely if
// audio hasn't started yet, so nothing throws if a key is somehow pressed
// before the click-to-start overlay has been dismissed.
function blip( freq, attack, sustain, release, amp) {
    if ( audioCtx === null) return;

    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime( 0, now);
    gain.gain.linearRampToValueAtTime( amp, now + attack);
    gain.gain.setValueAtTime( amp, now + attack + sustain);
    gain.gain.linearRampToValueAtTime( 0, now + attack + sustain + release);

    osc.connect( gain);
    gain.connect( audioCtx.destination);

    osc.start( now);
    osc.stop( now + attack + sustain + release + 0.02); // just past the envelope end
}

// Simple millis()-based scheduler so effects can play a short run of
// notes over time instead of everything firing on the same frame.
// A plain {freq, fireAt} object replaces Processing's ScheduledNote class.
let noteQueue = [];

function queueNote( freq, delayMs) {
    noteQueue.push( { freq: freq, fireAt: millis() + delayMs });
}

function updateNoteQueue() {
    for ( let i = noteQueue.length - 1; i >= 0; i--) {
        const n = noteQueue[i];
        if ( millis() >= n.fireAt) {
            blip( n.freq, 0.001, 0.04, 0.08, 0.22);
            noteQueue.splice( i, 1);
        }
    }
}

function playTypeSound( bufferLen) {
    const note = bufferLen % 13; // cycles through the octave and starts over, instead of capping
    const freq = typeBaseFreq * pow( SEMITONE_RATIO, note * typeSemitonesPerChar) + random( -4, 4);
    blip( freq, 0.001, 0.03, 0.05, 0.25);
}

function playBackspaceSound( bufferLen) {
    const freq = min( backspaceBaseFreq * pow( SEMITONE_RATIO, bufferLen * backspaceSemitonesPerChar), backspaceFreqCap) + random( -4, 4);
    blip( freq, 0.001, 0.02, 0.06, 0.25);
}

// Quick two-note "tick-tock" for arrow-key scrolling through crayons/
// keywords - distinct from the single-blip type/backspace sounds so an
// auto-filled word reads differently from manually typed text.
function playScrollSound() {
    queueNote( 350, 0);
    queueNote( 500, 45);
}

// Cartoony burst that gets bigger, faster, and higher-pitched with more
// characters in the buffer. Level 1: few chars, level 3: 10+ chars.
function playDisperseSound( charCount) {
    const level = ( charCount >= 10) ? 3 : ( ( charCount >= 5) ? 2 : 1);
    const notes = ( level === 1) ? 3 : ( ( level === 2) ? 5 : 8);
    const stepMs = ( level === 1) ? 70 : ( ( level === 2) ? 50 : 30);
    const baseFreq = 260 + level * 80;
    for ( let i = 0; i < notes; i++) {
        const freq = baseFreq * pow( 1.12, i);
        queueNote( freq, i * stepMs);
    }
}

// Short ascending major-triad fanfare for a crayon color or emoji match.
function playFanfare() {
    const notes = [ 523.25, 659.25, 783.99, 1046.50 ];
    for ( let i = 0; i < notes.length; i++) queueNote( notes[i], i * 60);
}
