// Player preferences kept in the browser: which graphics to use.

const GFX_KEY = 'eko-rising:graphics';
const STYLE_KEY = 'eko-rising:style';

// The 3D look: 'real' (life-like, the default) or 'cartoon'.
export function graphicsStyle() {
  try {
    return localStorage.getItem(STYLE_KEY) === 'cartoon' ? 'cartoon' : 'real';
  } catch (err) {
    return 'real';
  }
}

export function setGraphicsStyle(style) {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch (err) {
    // Without storage the choice simply doesn't stick.
  }
}

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
