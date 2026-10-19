// The guided opening, one step at a time (see sim/story.js), and the
// questions it asks about the clearing and its fence.

import { totalFood } from '../../sim/economy.js';
import { BUILDINGS } from '../../data/buildings.js';
import { has, pop, many, founderOf, guests, his, building, home, workersOf, names, mudCost, near } from './common.js';

const homeAt = (st) => {
  const h = building(st, 'compound');
  return h ? { x: h.x + 1.5, y: h.y + 1.5 } : { x: st.start.x + 0.5, y: st.start.y + 0.5 };
};

// The standing tree nearest the house that someone can get to.
function treeNearHome(st) {
  const p = homeAt(st);
  let best = -1;
  let bestD = Infinity;
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      const x = Math.floor(p.x) + dx;
      const y = Math.floor(p.y) + dy;
      if (x < 0 || y < 0 || x >= st.W || y >= st.H) continue;
      const i = y * st.W + x;
      if (!(st.trees[i] > 0) || st.felled[i] || st.occ[i]) continue;
      const d = Math.hypot(dx, dy);
      if (d < bestD && st.explored[i]) {
        bestD = d;
        best = i;
      }
    }
  }
  return best < 0 ? null : { x: (best % st.W) + 0.5, y: Math.floor(best / st.W) + 0.5, tree: true };
}

// Is the home closed in? A walk outward from the compound must not get far:
// fences, gates, standing trees and water stop it. It must take in the
// storage floor, have room inside, and a gate to get out by.
export function fenceState(st) {
  const home = building(st, 'compound');
  if (!home) return { closed: false };
  const cx = home.x + 1;
  const cy = home.y + 1;
  const W = st.W;
  const seen = new Uint8Array(W * st.H);
  const queue = [cy * W + cx];
  seen[queue[0]] = 1;
  let gate = false;
  let sections = 0;
  const walls = new Set();
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    const x = i % W;
    const y = (i / W) | 0;
    if (x <= 0 || y <= 0 || x >= W - 1 || y >= st.H - 1 || Math.max(Math.abs(x - cx), Math.abs(y - cy)) > 24 || queue.length > 2500) return { closed: false };
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (seen[j]) continue;
      const b = st.byId.get(st.occ[j]);
      if (b && !b.dead && b.owner === 'player' && (b.wall || b.gate) && b.built >= 1) {
        if (b.gate) gate = true;
        else if (!walls.has(b.id)) {
          walls.add(b.id);
          sections++;
        }
        continue;
      }
      seen[j] = 1;
      const t = st.terrain[j];
      if (t === 0 || t === 1 || t === 2) continue; // ocean, lagoon, river
      if (st.trees[j] > 0 && !st.felled[j]) continue; // standing trees
      queue.push(j);
    }
  }
  const floor = building(st, 'stockpile');
  const floorIn = !floor || seen[floor.y * W + floor.x];
  return { closed: true, area: queue.length, gate, sections, floorIn };
}

export function fenced(st) {
  const f = fenceState(st);
  return f.closed && f.gate && f.area >= 40 && f.floorIn;
}

// A building of this type marked out and still going up.
const site = (st, type) => st.buildings.find((b) => b.type === type && b.owner === 'player' && !b.dead && b.built < 1);

const text = (st, v) => (typeof v === 'function' ? v(st) : v);

// A step that asks for one building. As soon as its site is marked out the
// guide stops asking: it points at the site and says how it is getting on
// until it stands, so nobody places a second one thinking the first did not
// take.
function buildStep(type, step) {
  const ask = { task: step.task, hint: step.hint, point: step.point || (() => ({ build: type })) };
  const name = BUILDINGS[type].name;
  return {
    ...step,
    task: (st) => (site(st, type) ? `Wait while the ${name} goes up` : text(st, ask.task)),
    hint: (st) => {
      const b = site(st, type);
      if (!b) return text(st, ask.hint);
      const progress = b.got < b.need ? `Carrying the materials over: ${Math.floor(b.got)} of ${b.need}.` : `${Math.floor(b.built * 100)}% built.`;
      const hands = b.builders?.length || 0;
      const who = hands ? `${hands === 1 ? 'One person is' : `${hands} people are`} building it.` : 'Whoever sits by the fire comes to build it.';
      return `${progress} ${who} One is all you need. To send more hands, tap a worker, then the site.`;
    },
    point: (st) => {
      const b = site(st, type);
      return b ? { id: b.id } : ask.point(st);
    },
    done: (st) => st.buildings.some((b) => b.type === type && b.owner === 'player' && !b.dead && b.built >= 1),
  };
}

// --- The opening: a household of two becomes a community -----------------------
// A guided story, one step at a time (see sim/story.js): the couple mend the
// wrecked house they find; the founder fells the first tree; strangers come and a
// wood shed goes up; antelope and a hunter; a plank house and a farm; wolves;
// a fence between the trees; bandits and a guard house; the red-mud pit and
// the kingdom rebuilt in mud.

// The guided opening, one step at a time (see sim/story.js). `who` is
// whose face shows: 'founder', 'spouse' or 'guide'.
export const STORY = [
  {
    id: 'arrive',
    enter: (st, api) => api.queue('intro'),
    who: 'founder',
    say: (st) => `“Look at it, ${st.spouse}: the roof has fallen in and a wall is down. But the walls still stand, and the old roof timbers are good. We can mend it.”`,
    task: 'Watch them walk up to the house',
    hint: 'Drag the map to look around. Scroll or pinch to zoom.',
    point: (st) => founderOf(st) && { id: founderOf(st).id },
    min: 3,
    done: (st) => founderOf(st)?.state !== 'movein',
  },
  {
    id: 'mender',
    who: 'guide',
    say: (st) => `Before anything else, the house must be mended. ${st.founder} will do it himself.`,
    task: (st) => `Click ${st.founder} to select him`,
    hint: 'He wears the blue wrapper. The arrow shows where he is.',
    point: (st) => founderOf(st) && { id: founderOf(st).id },
    done: (st) => st.tut.sig.select === founderOf(st)?.id || !!home(st)?.repairing || !home(st)?.wrecked,
  },
  {
    id: 'pickhouse',
    who: 'founder',
    say: '“Let me see what needs doing.”',
    task: (st) => `With ${st.founder} selected, click the broken house`,
    hint: 'The arrow points at it. A 🔨 beside a building means it is damaged and can be mended.',
    point: (st) => home(st) && { id: home(st).id, select: founderOf(st)?.id },
    done: (st) => st.tut.sig.pickrepair === home(st)?.id || !!home(st)?.repairing || !home(st)?.wrecked,
  },
  {
    id: 'repair',
    who: 'guide',
    say: (st) => `The house panel shows what is broken and what mending it takes: 8 planks, the old roof timbers stacked on the storage floor in front of it. ${st.founder} will carry them over and put the roof back on.`,
    task: 'Click 🔨 Repair',
    hint: 'The button is in the panel that opened. If you closed it, click the house again.',
    point: (st) => home(st) && { ui: '#panel [data-act="repair"]', id: home(st).id },
    done: (st) => !!home(st)?.repairing || !home(st)?.wrecked,
  },
  {
    id: 'mending',
    who: 'founder',
    say: (st) => `“Hand me those timbers, ${st.spouse}. We will sleep under a roof tonight.”`,
    task: (st) => `Watch ${st.founder} mend the house`,
    hint: 'He carries the planks over from the storage floor and puts the roof back on. Click the house to see how far along he is.',
    point: (st) => founderOf(st) && { id: founderOf(st).id },
    done: (st) => !home(st)?.wrecked,
  },
  {
    id: 'select',
    who: 'guide',
    say: (st) => `The house stands again. Now: everything here starts with wood, and wood starts with a tree. ${st.founder} will cut the first one himself.`,
    task: (st) => `Click ${st.founder} to select him`,
    hint: 'He wears the blue wrapper. The arrow shows where he is.',
    point: (st) => founderOf(st) && { id: founderOf(st).id },
    done: (st) => st.tut.sig.select === founderOf(st)?.id || founderOf(st)?.task?.kind === 'chop',
  },
  {
    id: 'chop',
    who: 'founder',
    say: '“That tree will give us our first planks.”',
    task: (st) => `With ${st.founder} selected, click a tree near the house`,
    hint: 'A rainforest tree gives 12 planks, a savanna or shade tree 8, a mangrove 6. He fells it, then cuts it into planks where it lies.',
    point: (st) => treeNearHome(st),
    done: (st) => founderOf(st)?.task?.kind === 'chop',
  },
  {
    id: 'planks',
    who: 'guide',
    say: (st) => `${st.founder} is felling the tree. When it is down he cuts it into planks where it lies, and carries them home, four at a time.`,
    task: 'Watch him bring the first planks to the storage floor',
    hint: 'The storage floor is the swept ground in front of the house. Everything your people bring home is stacked there.',
    point: (st) => founderOf(st) && { id: founderOf(st).id },
    done: (st) => st.stats.made.wood >= 4,
  },
  {
    id: 'stack',
    who: 'guide',
    say: 'There: planks stacked on the storage floor. He goes back to the same tree until it is used up, then on to the next nearest.',
    task: 'Gather 12 planks',
    hint: (st) => `Planks so far: ${Math.floor(st.res.wood)}. Tap a tree any time to see how many planks are left in it.`,
    point: (st) => building(st, 'stockpile') && { id: building(st, 'stockpile').id },
    done: (st) => st.res.wood >= 12,
  },
  {
    id: 'strangers',
    focus: true,
    enter: (st, api) => {
      const a = api.wanderer({ female: false, calling: 'woodcutter', guest: true, near: true, quiet: true });
      const b = api.wanderer({ female: true, calling: 'woodcutter', guest: true, near: true, quiet: true });
      st.flags.wanderers = [a, b].filter(Boolean).map((c) => c.id);
      if (a || b) api.notify('🚶 Two travellers are coming up the path.', 'good', a || b);
    },
    who: 'spouse',
    say: (st) => `“${st.founder}, look: two people are coming up the path.”`,
    task: 'Wait for the travellers to reach the house',
    point: (st) => guests(st)[0] && { id: guests(st)[0].id },
    done: (st, api) => {
      if (!guests(st).length || guests(st).every((c) => c.state === 'wait') || st.time.t - st.tut.t > 45) {
        if (!st.flags.welcomeAsked) {
          st.flags.welcomeAsked = true;
          api.queue('welcome');
        }
        return st.flags.welcomed;
      }
      return false;
    },
  },
  buildStep('woodcutter', {
    id: 'woodshed',
    who: 'founder',
    say: '“The house sleeps five: the two of us and three more. We need no new house yet. What we need is wood.”',
    task: 'Build a Wood Shed by the forest',
    hint: 'Open 🔨 Build → Industry and pick the Wood Shed (6 planks). Place it near the trees. Nothing builds itself: the two from the fire carry the planks over from the storage floor and put it up, post by post. Tap the building site to see how far along it is.',
  }),
  {
    id: 'cutters',
    enter: (st) => (st.tut.wood0 = st.stats.made.wood),
    who: 'guide',
    say: (st) => {
      const w = workersOf(st, 'woodcutter')[0];
      const idle = guests(st).concat(st.citizens.filter((c) => (st.flags.wanderers || []).includes(c.id))).find((c) => c && !c.dead && !c.job);
      return `${w ? w.name : 'One of them'} has taken up the axe at the shed${idle ? `; ${idle.name} sits by the fire, because a wood shed takes one pair of hands` : ''}. Every tree cleared opens more ground to build on — and, one day, the way through the forest to other peoples.`;
    },
    task: 'Let the woodcutter bring in 8 planks',
    hint: (st) => `Brought in so far: ${Math.max(0, Math.floor(st.stats.made.wood - (st.tut.wood0 || 0)))} of 8. Tap the woodcutter to follow what he is doing.`,
    point: (st) => building(st, 'woodcutter') && { id: building(st, 'woodcutter').id },
    min: 15,
    done: (st) => st.stats.made.wood - (st.tut.wood0 || 0) >= 8,
  },
  buildStep('hunter', {
    id: 'antelope',
    focus: true,
    enter: (st, api) => {
      const herd = api.herd(3);
      st.flags.herd = herd.map((a) => a.id);
    },
    who: 'spouse',
    say: (st) => `“${st.founder}, the yams we carried are nearly gone. But look — antelope are grazing just past the house. A hunter could feed us.”`,
    task: 'Build a Hunter’s Shed near the antelope',
    hint: '🔨 Build → Food → Hunter’s Shed (8 planks). Whoever sits by the fire builds it, then takes it on: watch them change into hunting clothes and take up the bow.',
    point: (st) => {
      const a = (st.flags.herd || []).map((id) => st.byId.get(id)).find((x) => x && !x.dead);
      return a ? { id: a.id } : { build: 'hunter' };
    },
    exit: (st, api) => {
      // Nobody free? Then the woodcutter goes: food comes first.
      const shed = building(st, 'hunter');
      if (shed && !shed.workers.length && !st.citizens.some((c) => !c.dead && !c.special && !c.job && !c.stranger)) {
        const c = api.reassign('woodcutter', shed);
        if (c) api.notify(`🏹 ${c.name} puts down the axe, changes into hunting clothes and takes up the bow.`, 'good', c);
      }
    },
  }),
  {
    id: 'hunt',
    who: 'guide',
    say: (st) => {
      const h = workersOf(st, 'hunter')[0];
      return `${h ? h.name : 'The hunter'} stalks the herd and shoots. The kill is carried home on the shoulders, butchered at the shed, and the meat goes to the storage floor. An antelope gives 10 meat, a bush pig 8.`;
    },
    task: 'Bring home the first meat',
    point: (st) => workersOf(st, 'hunter')[0] && { id: workersOf(st, 'hunter')[0].id },
    done: (st) => st.stats.made.meat >= 5,
  },
  buildStep('hut', {
    id: 'fire',
    enter: (st, api) => {
      const a = api.wanderer({ near: true, quiet: true });
      const b = api.wanderer({ near: true, quiet: true, female: !a?.female });
      st.flags.firePair = [a, b].filter(Boolean).map((c) => c.id);
      if (a || b) api.notify(`👋 ${names([a, b].filter(Boolean))} have come to join you. They sit by the fire: there is no work for them yet.`, 'good', a || b);
    },
    who: 'spouse',
    say: '“Two more have come. They are sitting by the fire with nothing to do — and the house is full.”',
    task: 'Build a Plank House',
    hint: '🔨 Build → Homes → Plank House (10 planks). It sleeps two. The two at the fire build it. Mud bricks come later: for now we build in wood.',
  }),
  buildStep('farm', {
    id: 'farm',
    who: 'founder',
    say: '“Meat alone will not keep us. Let us clear ground and plant yams.”',
    task: 'Plant a Yam Farm',
    hint: '🔨 Build → Food → Yam Farm (5 planks), on open ground. The two by the fire will go and work it. Each workplace takes its own hands: when nobody at the fire is free, tap a worker and then the place you want them.',
  }),
  {
    id: 'farming',
    who: 'guide',
    say: (st) => {
      const f = workersOf(st, 'farm');
      return `${f.length ? names(f) : 'The farmers'} heap the earth into mounds and plant the seed yams. Yams grow fastest in the rains, slowest in the Harmattan.`;
    },
    task: 'Let the farmers get to work',
    point: (st) => building(st, 'farm') && { id: building(st, 'farm').id },
    min: 25,
    done: (st) => workersOf(st, 'farm').some((c) => c.state === 'farm'),
  },
  {
    id: 'wolves',
    focus: true,
    enter: (st, api) => {
      st.flags.packSent = !!api.pack(4);
    },
    who: 'spouse',
    say: (st) => `“Wolves! ${st.founder}, get inside!”`,
    task: 'Wolves are attacking!',
    hint: 'There is nothing to do but watch. The woodcutter has his axe, and the hunter his bow.',
    point: (st) => {
      const w = st.animals.find((a) => a.type === 'wolf' && !a.dead && !a.carcass);
      return w && { id: w.id };
    },
    done: (st, api) => {
      if (!st.flags.packSent) st.flags.packSent = !!api.pack(4);
      return !!st.flags.wolvesSlain && st.flags.needFence;
    },
  },
  {
    id: 'fence',
    who: 'founder',
    say: '“The forest is a wall no wolf gets through. We close the gaps between the trees with a fence, and leave a gate.”',
    task: 'Fence in your home, with a gate',
    hint: (st) => {
      const f = fenceState(st);
      const state = !f.closed ? 'Not closed yet: there is still a way out between the trees.' : !f.gate ? 'Closed in! Now put a Gate in the fence so your people can get out.' : !f.floorIn ? 'The storage floor is outside the fence.' : f.area < 40 ? 'Too small: fence in more ground.' : '';
      return `🔨 Build → Defence → Wooden Fence (2 planks a section): drag it from tree to tree, or down to the water. ${state} Every section is put up by hand: ${st.founder} builds when nobody else is free. To help him, tap a worker and then a fence section. Short of wood? Tap the hunter, then the Wood Shed, to make him a woodcutter — or build a second shed.`;
    },
    point: (st) => (fenceState(st).closed && !fenceState(st).gate ? { build: 'gate' } : { build: 'palisade' }),
    done: (st) => fenced(st),
  },
  {
    id: 'settle',
    enter: (st, api) => {
      api.queue('settled');
      // Newcomers to take the places of the dead.
      const lost = (st.story?.victims || []).length || 2;
      const come = [];
      for (let k = 0; k < lost; k++) {
        const c = api.wanderer({ near: true, quiet: true, calling: 'farm' });
        if (c) come.push(c);
      }
      if (come.length) api.notify(`👋 ${names(come)} heard there is a safe place by the lagoon, and have come to take the places of those we lost.`, 'good', come[0]);
    },
    who: 'spouse',
    say: '“New people are arriving at the fire. Let us put them to work: the more hands, the faster we grow.”',
    task: 'Grow to 9 people',
    hint: 'Newcomers come while everyone is fed and happy and there are beds. Each new Plank House brings two. Put people to work: a new workplace takes whoever is at the fire.',
    point: (st) => building(st, 'campfire') && { id: building(st, 'campfire').id },
    done: (st) => pop(st) >= 9 || (st.time.t - st.tut.t > 24 * 8 && pop(st) >= 6),
  },
  {
    id: 'bandits',
    focus: true,
    enter: (st, api) => {
      st.story = { ...(st.story || {}), raidDead: [], stolen: {} };
      const ids = api.raid('bandits1', ['bandit', 'bandit', 'bandit', 'bandit'], { steal: true, patience: 110, label: 'bandit raid', onDefeat: 'bandits_gone' });
      st.flags.raidSent = ids.length > 0;
      if (ids.length) api.notify('🏴 Bandits are coming out of the forest along the path!', 'war', st.byId.get(ids[0]));
    },
    who: 'founder',
    say: '“Bandits! Everyone inside!”',
    task: 'Bandits are raiding the settlement',
    hint: 'Your people run indoors. Watch what the bandits do.',
    point: (st) => {
      const u = st.units.find((x) => x.owner === 'bandits1' && !x.dead && x.order?.t !== 'guard');
      return u && { id: u.id };
    },
    done: (st) => !!st.flags.raided || !st.flags.raidSent,
  },
  {
    id: 'recover',
    who: 'founder',
    say: '“First we fill the stores again. Then we build a guard house.”',
    task: 'Refill the stores: 30 food and 40 planks',
    hint: (st) => `Food ${Math.floor(totalFood(st))} of 30, planks ${Math.floor(st.res.wood)} of 40. A second farm or wood shed helps. If the storage floor is full, build another beside it (Industry).`,
    done: (st) => totalFood(st) >= 30 && st.res.wood >= 40,
  },
  buildStep('warcamp', {
    id: 'guardhouse',
    who: 'founder',
    say: '“A guard house, where our own men train and live.”',
    task: 'Build a Guard House',
    hint: '🔨 Build → Defence → Guard House (40 planks). A big building: three can work on it at once. Short of builders? Tap a worker, then the building site, to send them to help.',
  }),
  {
    id: 'soldiers',
    who: 'guide',
    say: 'Spearmen are trained from people sitting by the fire. If nobody is free, a volunteer walks in from the villages around.',
    task: 'Train 5 spearmen',
    hint: (st) => `Select the Guard House and press Train. Each spearman costs 6 planks and 8 food. Spearmen: ${st.units.filter((u) => u.owner === 'player' && u.type === 'spearman' && !u.dead).length} of 5.`,
    point: (st) => building(st, 'warcamp') && { id: building(st, 'warcamp').id, ui: '#panel [data-act="train"][data-type="spearman"]' },
    done: (st) => st.units.filter((u) => u.owner === 'player' && u.type === 'spearman' && !u.dead).length >= 5,
  },
  {
    id: 'camp',
    focus: true,
    enter: (st, api) => {
      const f = st.factionMap.bandits1;
      if (f) api.reveal(f.x, f.y, 4);
    },
    who: 'founder',
    say: '“Their camp is in the far corner of the forest: four of them, and their tents. Go and burn it.”',
    task: 'Clear the bandit camp',
    hint: 'Press 🛡️ Army at the top (or ⬚ Select, then drag a box round them) and tap the bandit camp. Near the camp they go for the bandits and set the tents alight by themselves. Burn every tent and the camp is gone.',
    point: (st) => st.factionMap.bandits1 && { x: st.factionMap.bandits1.x + 0.5, y: st.factionMap.bandits1.y + 0.5, select: 'army' },
    done: (st) => !st.factionMap.bandits1 || st.factionMap.bandits1.status === 'conquered',
  },
  {
    id: 'mudpit',
    focus: true,
    who: 'founder',
    say: (st) => `“On our way here we passed a pit of red mud. With mud we can make bricks, and build houses no bandit can burn so easily. Let me go and find it again.”`,
    task: (st) => `Click ${st.founder}, then click the marked place to send him there`,
    hint: 'It is off along the path you came in by. With him selected, tap anywhere on the ground to send him there.',
    point: (st) => st.mudPit && { x: st.mudPit.x + 0.5, y: st.mudPit.y + 0.5, select: founderOf(st)?.id },
    done: (st, api) => {
      const f = founderOf(st);
      if (!st.mudPit || near(f, st.mudPit.x + 0.5, st.mudPit.y + 0.5, 3.5)) {
        if (st.mudPit) api.reveal(st.mudPit.x, st.mudPit.y, 4);
        return true;
      }
      return false;
    },
  },
  buildStep('brickyard', {
    id: 'brickshed',
    focus: true,
    who: 'founder',
    say: '“Here it is: red mud, as much as we will ever need.”',
    task: 'Build a Mud Brick Shed beside the red mud',
    hint: '🔨 Build → Industry → Mud Brick Shed (8 planks). The shed itself is wood; its workers dig the mud, press it into moulds and dry the bricks in the sun.',
  }),
  {
    id: 'bricks',
    who: 'guide',
    say: 'With enough mud bricks, every house and shed can be rebuilt in mud at once: the kingdom upgrade.',
    task: (st) => `Make ${mudCost(st)} mud bricks`,
    hint: (st) => `Bricks: ${Math.floor(st.res.bricks)} of ${mudCost(st)}. Two people can work the brick shed. If the storage floor fills up, build another beside it.`,
    point: (st) => building(st, 'brickyard') && { id: building(st, 'brickyard').id },
    done: (st) => st.res.bricks >= mudCost(st),
  },
  {
    id: 'upgrade',
    who: 'founder',
    say: '“Enough bricks. Let us rebuild everything in mud.”',
    task: 'Press 🧱 Kingdom upgrade at the top',
    hint: 'Every house and shed is rebuilt in red mud at once: tougher, and each house sleeps four instead of two.',
    point: () => ({ ui: '#mud-btn' }),
    done: (st) => !!st.flags.mud,
  },
  {
    id: 'end',
    enter: (st, api) => api.queue('chapter_one'),
    who: 'spouse',
    say: '“When we came, there was nothing here but trees.”',
    task: 'The opening is complete',
    done: () => true,
  },
];
