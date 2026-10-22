// Player preferences kept in the browser: which graphics to use, and whether
// the adviser gives his optional tips.

const GFX_KEY = 'eko-rising:graphics';
const STYLE_KEY = 'eko-rising:style';
const TIPS_KEY = 'eko-rising:tips';

// The adviser's tips beside each goal (on unless turned off). Goals and
// warnings show either way.
export function adviserTips() {
  try {
    return localStorage.getItem(TIPS_KEY) !== 'off';
  } catch (err) {
    return true;
  }
}

export function setAdviserTips(on) {
  try {
    localStorage.setItem(TIPS_KEY, on ? 'on' : 'off');
  } catch (err) {
    // Without storage the choice simply doesn't stick.
  }
}

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
