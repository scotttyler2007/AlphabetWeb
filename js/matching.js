// Crayon-color and emoji-keyword match state: which (if any) is
// currently matched, confirming a pending match on Enter, and reverting
// its visuals when the buffer edits invalidate it.

let colorIndex = 0; // stays synced to whichever crayon color is matched/selected
let emojiIndex = 0; // stays synced to whichever emoji keyword is matched/selected

// Looks for a crayon color name and an emoji keyword inside the phrase
// typed so far and tracks which one (if any) of each is currently
// matched. This only detects the match - it does NOT apply its
// background/emoji/sound. That only happens once Enter confirms it (see
// confirmMatch()), so typing (or arrow-scrolling) into a match no longer
// triggers its animation by itself. Editing the buffer after a match has
// already been confirmed un-confirms it, reverting the visuals until
// Enter confirms again.
let activeColorName = null;   // crayon color word currently matched, if any
let activeKeyword = null;     // emoji keyword currently matched, if any

// What the visuals are actually showing right now, as opposed to what the
// buffer merely matches. confirmMatch() sets these; revertMatchVisuals()
// clears them. The difference between the two pairs is what tells Enter
// whether it has anything new to show.
let shownColorName = null;
let shownKeyword = null;

// True when the buffer matches something that ISN'T already on screen -
// i.e. Enter has a new match to stage. Comparing against what's shown
// rather than against "has Enter been pressed since the last edit" is what
// keeps a phrase from re-confirming a match it already staged: after
// confirming "cat", typing " butt" still matches cat, so there is nothing
// new and Enter falls through to dispersing.
//
// It still allows deliberate repetition, because dispersing and Delete both
// revert the visuals: once the scene is cleared, retyping "cat" is new
// again and Enter re-stages it.
function hasNewMatch() {
    if ( typing.length === 0) return false;
    if ( activeColorName === null && activeKeyword === null) return false;
    return activeColorName !== shownColorName || activeKeyword !== shownKeyword;
}

// ---- word matching ----
// A phrase matches on whole words rather than on the buffer as a whole, so
// "the orange cat" finds the crayon "orange" AND the keyword "cat".
// Splitting on runs of non-letters is what enforces the word boundary -
// "catch" tokenizes to ["catch"] and can never match "cat" - and it drops
// punctuation on the way in, so "cat!" still matches.
function tokenize( text) {
    return text.toLowerCase().split( /[^a-z]+/).filter( t => t.length > 0);
}

// Shortest stem worth accepting from adding or stripping a plural ending.
// Every table entry is at least three letters, so this rules nothing out -
// but without it, "bu" would sprout an "s" and match "bus" a keystroke
// before you finished typing the word.
const MIN_STEM = 3;

// The plurals English won't derive by rule. Written singular -> plural;
// the reverse index is built from it just below, so typing either form
// finds a table entry stored as the other. This is what lets "foot" reach
// the entry stored as "feet", and "mice" reach the one stored as "mouse".
// Nouns whose plural equals their singular (fish, sheep, deer) need no
// entry - they already match directly.
const irregularPlurals = {
    foot: "feet",   tooth: "teeth",  mouse: "mice",     goose: "geese",
    child: "children", person: "people", man: "men",    woman: "women",
    leaf: "leaves", wolf: "wolves",  knife: "knives",   life: "lives",
    loaf: "loaves", die: "dice",     cactus: "cacti",   octopus: "octopuses",
    fungus: "fungi",
};
const irregularSingulars = {};
for ( const [ one, many] of Object.entries( irregularPlurals)) irregularSingulars[ many] = one;

// Every spelling of `word` worth looking up, the literal one first so an
// exact table entry always wins over a derived guess. Both directions are
// needed because the tables are a mix: "cat" is stored singular while
// "feet" and "eyes" are stored plural, and the typist can't know which.
function wordVariants( word) {
    const forms = [ word];
    const add = ( w) => { if ( w.length >= MIN_STEM && !forms.includes( w)) forms.push( w); };

    if ( word.endsWith( "ies")) add( word.slice( 0, -3) + "y"); // butterflies -> butterfly
    if ( word.endsWith( "es"))  add( word.slice( 0, -2));       // peaches -> peach
    if ( word.endsWith( "s"))   add( word.slice( 0, -1));       // cats -> cat

    if ( word.length >= MIN_STEM) {
        add( word + "s");                                          // eye -> eyes
        add( word + "es");                                         // peach -> peaches
        if ( word.endsWith( "y")) add( word.slice( 0, -1) + "ies"); // butterfly -> butterflies
    }

    // -ing verb forms, derived rather than listed, exactly like the plurals
    // above: every keyword that can take -ing works without anyone adding it
    // to a table. English drops a silent -e and doubles a final consonant
    // before -ing, so undoing both is what reaches the stem.
    if ( word.endsWith( "ing")) {
        const stem = word.slice( 0, -3);
        add( stem);                                                // golfing -> golf, skiing -> ski
        add( stem + "e");                                          // skating -> skate, smiling -> smile
        if ( stem.length > 1 && stem[ stem.length - 1] === stem[ stem.length - 2])
            add( stem.slice( 0, -1));                              // swimming -> swim, shopping -> shop
    }
    if ( word.length >= MIN_STEM) {
        add( word + "ing");                                        // build -> building, bowl -> bowling
        if ( word.endsWith( "e")) add( word.slice( 0, -1) + "ing"); // skate -> skating
    }

    if ( irregularPlurals[ word])   add( irregularPlurals[ word]);
    if ( irregularSingulars[ word]) add( irregularSingulars[ word]);
    return forms;
}

// name -> index, with aliases folded in so both resolve identically and a
// synonym costs nothing extra at match time. Real names are inserted first
// and an alias never overwrites one, so a keyword always beats a synonym
// that collides with it. Aliases pointing at something that isn't a real
// name are skipped here and reported by validateTables().
//
// Built once at load: matching.js runs after palette.js and keywords.js
// (see the script order in index.html), so both tables exist by now, and
// neither ever changes.
function buildLookup( entries, aliases) {
    const m = new Map();
    for ( let i = 0; i < entries.length; i++) m.set( entries[i].name, i);
    for ( const alias in aliases) {
        if ( m.has( alias)) continue;              // never shadow a real name
        const i = m.get( aliases[ alias]);
        if ( i !== undefined) m.set( alias, i);
    }
    return m;
}
const crayonLookup = buildLookup( crayons, crayonAliases);
const keywordLookup = buildLookup( keywords, keywordAliases);

// Index of the LAST word in the phrase that resolves to a table entry, or
// -1. Last rather than first so the display keeps up with the typist: in
// "cat dog" the word you just finished is the one you see.
function findWordMatch( tokens, lookup) {
    for ( let i = tokens.length - 1; i >= 0; i--) {
        for ( const form of wordVariants( tokens[i])) {
            const hit = lookup.get( form);
            if ( hit !== undefined) return hit;
        }
    }
    return -1;
}

function updateMatches() {
    const tokens = tokenize( currentText);

    const ci = findWordMatch( tokens, crayonLookup);
    if ( ci >= 0) colorIndex = ci;
    activeColorName = ( ci >= 0) ? crayons[ci].name : null;

    const ki = findWordMatch( tokens, keywordLookup);
    if ( ki >= 0) emojiIndex = ki;
    activeKeyword = ( ki >= 0) ? keywords[ki].name : null;

    // Deliberately does NOT revert the visuals: once a match is showing it
    // stays until something new is staged or the scene is cleared. Typing
    // past "cat" shouldn't yank the cats away mid-sentence, and keeping
    // them is what lets a phrase like "cats and dogs" be walked through one
    // keyword at a time. Nothing else needs resetting here either - whether
    // Enter has work to do is derived by hasNewMatch(), not tracked by a
    // flag that an edit could leave stale.
}

// Stages the current match - background tint, contrast letters, emoji
// burst, fanfare. Called when Enter finds a match that isn't already on
// screen. An exact crayon-color match takes priority for the background
// (this also covers words like "peach" or "flamingo" that happen to be
// both a crayon and an emoji keyword); the emoji burst still spawns for a
// matched keyword regardless of which one wins the background.
function confirmMatch() {
    let target = bgCol;
    if ( activeColorName !== null) {
        target = crayons[ colorIndex].color;
    } else if ( activeKeyword !== null) {
        target = keywords[ emojiIndex].bg;
    }
    applyThemeFor( target);

    // Only restage the emoji when the keyword itself changed. "blue cat"
    // after "cat" should retint the background and leave the cats where
    // they are, not flicker the same set out and back in.
    if ( activeKeyword !== shownKeyword) {
        fadeOutEmojiGrids();
        if ( activeKeyword !== null) {
            spawnEmojiGrid( keywords[ emojiIndex].emoji);
        }
    }

    playFanfare();
    shownColorName = activeColorName;
    shownKeyword = activeKeyword;
}

// Clears the scene: background back to default, letters back to rainbow,
// any active emoji grid fades out. Forgetting what was shown is the point -
// it's what makes a word that's still sitting in the buffer count as new
// again, so retyping or re-confirming it re-stages the match.
function revertMatchVisuals() {
    applyThemeFor( bgCol);
    fadeOutEmojiGrids();
    shownColorName = null;
    shownKeyword = null;
}

// Startup sanity check on the tables. There is deliberately no length
// comparison here any more: name, bg and emoji live in one record, so they
// cannot fall out of step with each other and there is nothing to compare.
// What's left are the things a single record can still get wrong.
function validateTables() {
    for ( let i = 0; i < keywords.length; i++) {
        const k = keywords[i];
        // EmojiGrid cycles its cells with i % emojiSet.length, so an empty
        // emoji set would divide by zero the moment that keyword is confirmed.
        if ( !k.emoji || k.emoji.length === 0) fail( `keyword "${k.name}" (index ${i}) has no emoji`);
        if ( !/^#[0-9a-fA-F]{6}$/.test( k.bg))  fail( `keyword "${k.name}" has a bad bg color: ${k.bg}`);
    }
    for ( const c of crayons) {
        if ( !/^#[0-9a-fA-F]{6}$/.test( c.color)) fail( `crayon "${c.name}" has a bad color: ${c.color}`);
    }
    checkAliases( "keywordAliases", keywordAliases, keywords);
    checkAliases( "crayonAliases", crayonAliases, crayons);
}

function fail( msg) {
    console.error( msg);
    throw new Error( msg);
}

// An alias is only useful if it names something that isn't already a real
// entry and points at one that is. buildLookup() silently drops anything
// that fails those rules, so without this check a typo'd synonym would just
// quietly never match.
function checkAliases( label, aliases, entries) {
    const real = new Set( entries.map( e => e.name));
    for ( const alias in aliases) {
        const target = aliases[ alias];
        let problem = null;
        if ( real.has( alias))        problem = "is already a real entry, so it can never take effect";
        else if ( !real.has( target)) problem = `points at "${target}", which is not a real entry`;
        else if ( alias.indexOf( " ") >= 0) problem = "contains a space, which tokenizing will split";
        if ( problem) fail( `${label}: "${alias}" ${problem}`);
    }
}
