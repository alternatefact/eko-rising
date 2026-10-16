// Player preferences kept in the browser: which graphics to use, and which
// painted art files ship with the game (so pop-ups only ask for files that exist).

const GFX_KEY = 'eko-rising:graphics';

export function graphicsMode() {
  try {
    return localStorage.getItem(GFX_KEY) || '3d';
  } catch (err) {
    return '3d';
  }
}

export function setGraphicsMode(mode) {
  try {
    localStorage.setItem(GFX_KEY, mode);
  } catch (err) {
    // Without storage the choice simply doesn't stick.
  }
}

// Painted illustrations in art/, by name. Story pop-ups fall back to emoji
// art for anything not listed here.
export const ART = new Set([]);

export function artUrl(name) {
  return ART.has(name) ? `art/${name}.webp` : null;
}
