// Player preferences kept in the browser: which graphics to use.

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
