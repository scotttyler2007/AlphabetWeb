// palette.js -- fonts, the rainbow letter colors, and the crayon table.

// Eight display fonts the phrase rotates through, one per new phrase. Each
// names a single font family bundled in ../fonts/ and declared by
// fonts/fonts.css, which index.html links. Weight stays a separate flag
// because a CSS family name can't carry it.
//
// These MUST be bare, unquoted, single family names - not CSS font stacks,
// and not pre-quoted. p5's textFont() wraps whatever string it's handed in
// double quotes before assigning it to the canvas context, so a stack
// arrives as one family literally named "A, B, serif" and a pre-quoted
// name as "'A'"; neither exists, and the canvas silently falls back to its
// default font for every slot. This table used to hold stacks, which is
// exactly the bug that hid - all seven fonts rendered identically. The
// per-family fallbacks that the stacks were reaching for now live in
// fonts.css's src: descriptors, where they actually work.
//
// The bundled faces are open-licensed stand-ins, not the fonts the
// Processing original named - Georgia, Tahoma, Segoe Script, Constantia,
// Palatino Linotype, Cambria and Comic Sans MS are all Microsoft/Linotype
// fonts that can't be redistributed as webfonts. fonts/README.md has the
// full mapping; Gelasio and Caladea are metric-compatible with Georgia and
// Cambria, so those slots wrap identically to the originals.
//
// The last entry is new: the original rotated through seven fonts and had
// no Comic Sans slot.
const fonts = [
  { family: "Gelasio",        bold: true  },  // Georgia
  { family: "Open Sans",      bold: true  },  // Tahoma
  // { family: "Caveat",         bold: false },  // Segoe Script
  { family: "Source Serif 4", bold: false },  // Constantia
  { family: "EB Garamond",    bold: false },  // Palatino Linotype
  { family: "Caladea",        bold: true  },  // Cambria
  { family: "Gelasio",        bold: false },  // Georgia
  { family: "Comic Neue",     bold: true  },  // Comic Sans MS
];

// The 10 rainbow letter colors. Kept as plain hex strings here -- p5
// parses hex color strings directly (colorMode doesn't affect string
// parsing), and theme.js's initTheme() is the one place that needs
// actual p5.Color objects, converting these at startup.
const colors = [
        '#ff0000',
        '#ff7f00',
        '#ffff00',
        '#00ff00',
        '#0000ff',
        '#4B0082',
        '#8F00FF',
        '#ff33cc',
        '#996633',
        '#ff7f89',
];

// A big box of crayons: the word a child types and the color it paints the
// background. One record per crayon, same reasoning as keywords.js.
const crayons = [
        // -- ROYGBIV --
        { name: "red",        color: '#ee204d' },
        { name: "orange",     color: '#ff7538' },
        { name: "yellow",     color: '#fceb37' },
        { name: "green",      color: '#1cac78' },
        { name: "blue",       color: '#1f75fe' },
        { name: "indigo",     color: '#4b0082' },
        { name: "violet",     color: '#8f00ff' },
        // -- rest of the color wheel --
        { name: "maroon",     color: '#800000' },
        { name: "salmon",     color: '#fa8072' },
        { name: "scarlet",    color: '#ff2400' },
        { name: "chestnut",   color: '#954535' },
        { name: "brown",      color: '#b4674d' },
        { name: "coral",      color: '#ff7f50' },
        { name: "rust",       color: '#b7410e' },
        { name: "mahogany",   color: '#c04000' },
        { name: "apricot",    color: '#fbceb1' },
        { name: "peach",      color: '#ffdab9' },
        { name: "copper",     color: '#b87333' },
        { name: "bronze",     color: '#cd7f32' },
        { name: "chocolate",  color: '#7b3f00' },
        { name: "tan",        color: '#d2b48c' },
        { name: "khaki",      color: '#c3b091' },
        { name: "pearl",      color: '#eae0c8' },
        { name: "amber",      color: '#ffbf00' },
        { name: "mustard",    color: '#ffdb58' },
        { name: "gold",       color: '#ffd700' },
        { name: "cream",      color: '#fffdd0' },
        { name: "beige",      color: '#f5f5dc' },
        { name: "olive",      color: '#808000' },
        { name: "ivory",      color: '#fffff0' },
        { name: "sage",       color: '#9dc183' },
        { name: "lime",       color: '#32cd32' },
        { name: "mint",       color: '#98ff98' },
        { name: "forest",     color: '#228b22' },
        { name: "emerald",    color: '#50c878' },
        { name: "jade",       color: '#00a86b' },
        { name: "turquoise",  color: '#40e0d0' },
        { name: "cyan",       color: '#00ffff' },
        { name: "teal",       color: '#008080' },
        { name: "cerulean",   color: '#007ba7' },
        { name: "sky",        color: '#87ceeb' },
        { name: "charcoal",   color: '#36454f' },
        { name: "azure",      color: '#007fff' },
        { name: "denim",      color: '#1560bd' },
        { name: "cobalt",     color: '#0047ab' },
        { name: "sapphire",   color: '#0f52ba' },
        { name: "navy",       color: '#000080' },
        { name: "lavender",   color: '#e6e6fa' },
        { name: "periwinkle", color: '#ccccff' },
        { name: "purple",     color: '#926eae' },
        { name: "mauve",      color: '#e0b0ff' },
        { name: "magenta",    color: '#ff00ff' },
        { name: "lilac",      color: '#c8a2c8' },
        { name: "fuchsia",    color: '#cc00cc' },
        { name: "plum",       color: '#8e4585' },
        { name: "rose",       color: '#ff007f' },
        { name: "pink",       color: '#ffaacc' },
        { name: "raspberry",  color: '#e30b5d' },
        { name: "ruby",       color: '#e0115f' },
        { name: "cherry",     color: '#de3163' },
        { name: "flamingo",   color: '#fc8eac' },
        { name: "burgundy",   color: '#800020' },
        { name: "crimson",    color: '#dc143c' },
        { name: "wine",       color: '#722f37' },
        // -- neutrals --
        { name: "black",      color: '#000000' },
        { name: "slate",      color: '#708090' },
        { name: "gray",       color: '#95918c' },
        { name: "ash",        color: '#b2beb5' },
        { name: "silver",     color: '#c0c0c0' },
        { name: "white",      color: '#ffffff' },
];

// Alternate spellings for crayon names, same rules as keywordAliases in
// keywords.js: alias -> real crayon name, no shadowing a real name, no
// pointing at another alias.
const crayonAliases = {
    grey: "gray",       // British spelling
    aqua: "cyan",
    fuscia: "fuchsia",  // the misspelling almost everyone reaches for first
};
