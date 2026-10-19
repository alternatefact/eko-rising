// The life-like 3D people (made with Higgsfield) and their animations. The
// sprite baker (tools/bake) photographs them in every movement for the 2D
// isometric view; js/render/iso.js picks which picture each person shows.

// Character models in art/people/characters. `height` scales a model relative
// to a grown man. `prop` is the tool in their hand (js/render3d/props.js),
// held in the right hand unless `hand` says otherwise.
export const CHARACTERS = {
  founder: { name: 'The founder', height: 1.04, prop: 'whisk' },
  wife: { name: 'The founder’s wife', height: 0.95 },
  woman: { name: 'Village woman', height: 0.94 },
  farmer: { name: 'Yam farmer', height: 1, prop: 'hoe' },
  woodcutter: { name: 'Woodcutter', height: 1.02, prop: 'axe' },
  hunter: { name: 'Hunter', height: 1, prop: 'bow', hand: 'Left' },
  fisher: { name: 'Fisherman', height: 0.98, prop: 'paddle' },
  labourer: { name: 'Labourer', height: 1, prop: 'hammer' },
  spearman: { name: 'Spearman', height: 1.02, prop: 'spear' },
  bandit: { name: 'Bandit', height: 1.02, prop: 'machete' },
  // A woman soldier of Dahomey: striped tunic, white cap, a blade.
  agojie: { name: 'Agojie', height: 0.98, prop: 'machete' },
};

// Animation clips in art/people/clips, by the name the game uses. `from` and
// `derive` build a clip out of another one.
export const CLIPS = {
  idle: { file: 'idle' },
  walk: { file: 'walk' },
  womanwalk: { file: 'womanwalk' },
  strut: { file: 'strut' },
  spearwalk: { file: 'spearwalk' },
  swing: { file: 'swing' },
  pull: { file: 'pull' },
  slash: { file: 'slash' },
  bow: { file: 'bow' },
  carry: { from: 'walk', derive: (clip) => headLoad(clip) },
  womancarry: { from: 'womanwalk', derive: (clip) => headLoad(clip) },
};

// Carrying a load on the head: both arms raised to steady it, the legs
// still walking. Replaces the arm tracks of a walk with a held pose. These
// rotations (x, y, z, w, in each bone's own space) were solved for the shared
// skeleton so both hands rest on top of the head with the elbows out.
export const HEAD_LOAD_POSE = {
  LeftArm: [-0.1286, -0.8004, -0.5832, -0.0519],
  LeftForeArm: [-0.4598, 0.1118, 0.0413, 0.88],
  RightArm: [0.0027, 0.7972, 0.6032, 0.0247],
  RightForeArm: [-0.5152, -0.0826, -0.0178, 0.8529],
};

function headLoad(clip) {
  const held = new Set(Object.keys(HEAD_LOAD_POSE).map((bone) => `${bone}.quaternion`));
  const out = clip.clone();
  const Track = clip.tracks.find((t) => t.name.endsWith('.quaternion')).constructor;
  out.tracks = out.tracks.filter((t) => !held.has(t.name));
  for (const [bone, q] of Object.entries(HEAD_LOAD_POSE)) out.tracks.push(new Track(`${bone}.quaternion`, [0], q));
  return out;
}
