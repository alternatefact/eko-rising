// Painted art in art/, made with Higgsfield: story pictures, rulers'
// portraits, one picture per age, and textures for the 3D buildings.
// Anything not listed here falls back to emoji art or textures drawn in code.

// Story events → picture. Some events share one.
const STORY = {
  intro: 'intro',
  harmattan: 'harmattan',
  benin: 'benin',
  benin_again: 'benin',
  portuguese: 'portuguese',
  portuguese_return: 'portuguese_return',
  portuguese_beaten: 'victory_beach',
  lagos_name: 'lagos_name',
  atlantic: 'atlantic',
  french_envoy: 'french_envoy',
  french_beaten: 'victory_beach',
  british: 'british',
  british_wave2: 'british_wave2',
  british_peace: 'british_peace',
  independence: 'independence',
  independence_won: 'independence_won',
  eyo: 'eyo',
  caravan: 'caravan',
};

const LEADERS = new Set(['awori', 'egun', 'egba', 'ijebu', 'edo', 'ilaje']);
const SCENES = new Set(['title', 'harbour', 'end_victory', 'end_defeat']);
const TEXTURES = new Set(['thatch', 'mud', 'zinc', 'plaster', 'planks', 'soil', 'cloth', 'stone']);
// Life-like versions for the realistic look.
const REAL_TEXTURES = {
  thatch: 'real/tex/thatch', mud: 'real/tex/mud', zinc: 'real/tex/zinc', plaster: 'real/tex/plaster',
  planks: 'real/tex/planks', stone: 'real/tex/stone', soil: 'real/ground/earth', tiles: 'real/tex/tiles', cloth: 'tex/cloth',
};
const AGES = 5;

export function storyArt(id) {
  return STORY[id] ? `art/${STORY[id]}.webp` : null;
}

export function leaderArt(f) {
  if (!f) return null;
  if (f.temperament === 'bandit' && f.people === 'Bandits') return 'art/leader_bandits.webp';
  return LEADERS.has(f.id) ? `art/leader_${f.id}.webp` : null;
}

export function ageArt(era) {
  return era >= 0 && era < AGES ? `art/era${era}.webp` : null;
}

export function sceneArt(name) {
  return SCENES.has(name) ? `art/${name}.webp` : null;
}

export function textureArt(name, real = false) {
  if (real) return REAL_TEXTURES[name] ? `art/${REAL_TEXTURES[name]}.webp` : null;
  return TEXTURES.has(name) ? `art/tex/${name}.webp` : null;
}

// Painted (cartoon) or life-like (realistic) versions of the land and plant textures.
export function natureArt(name, real = false) {
  const ground = ['grass', 'savanna', 'sand', 'earth', 'forest', 'rock', 'mud'];
  if (ground.includes(name)) return real ? `art/real/ground/${name}.webp` : `art/ground/${name}.webp`;
  return real ? `art/real/tex/${name}.webp` : `art/tex/${name}.webp`;
}
