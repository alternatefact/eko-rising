// What a home kingdom's story is built from, so a new one needs only its own
// words and history: the guided opening's story pop-ups in its culture's
// words, and its first great host (DESIGN.md: each start has a first big
// enemy). Èkó and Kano were written before this and keep their own.

import { PREDATORS } from '../cultures/index.js';
import { RESOURCES } from '../data/resources.js';
import { guests, his, many } from './common.js';

export const historyNote = (text) => `\n\nIn the history you know, ${text}`;
export const claimed = (st, kind) => st.pois.some((p) => p.kind === kind && p.claimed);
// A people of the land that still stands on its own and is not at war with you.
export const atPeace = (st, id) => {
  const f = st.factionMap[id];
  return !!f && f.status !== 'conquered' && f.status !== 'hostile';
};
// A people of the land who are your friends: allied, or nearly.
export const friends = (st, id) => {
  const f = st.factionMap[id];
  return !!f && (f.status === 'allied' || (f.status !== 'hostile' && f.relation >= 40));
};
export const warmer = (st, id, n) => {
  const f = st.factionMap[id];
  if (f) f.relation = Math.max(-100, Math.min(100, f.relation + n));
};

// The guided opening's story pop-ups (the steps queue them by id: intro,
// welcome, wolves_slain, settled, bandits_gone, chapter_one).
//   intro   { title, text(st) }: the founders arrive
//   here    where they are building, as the founder says it to strangers
//   ahead   (st) => what comes after the opening, in a sentence or two
export function openingEvents(culture, { intro, here, ahead }) {
  const w = culture.opening;
  const P = PREDATORS[culture.predator];
  return [
    {
      id: 'intro',
      story: true,
      title: intro.title,
      art: '🌅',
      text: intro.text,
      choices: [{ label: 'Settle here', hint: 'Take it one step at a time: the guide at the top left shows what to do next.' }],
    },
    {
      id: 'welcome',
      story: true,
      title: 'Strangers at the door',
      art: '👋',
      text: (st) => {
        const who = guests(st);
        const intro = who.map((c) => `${c.name}, a ${c.female ? 'woman' : 'man'} of the ${c.people} from ${c.from}`).join(', and ');
        return `${who.length === 1 ? 'A traveller has' : 'Two travellers have'} come up the path: ${intro}. They are looking for a place to live.\n\n${st.founder} puts down his ${w.tool || 'axe'} and goes out to meet them. “${culture.greeting}, strangers. My wife and I are building a community ${here}. Will you join us?”\n\n“Yes,” ${who.length === 1 ? 'comes the answer' : 'they answer together'}. “We will.”`;
      },
      choices: [
        {
          label: 'Welcome them home',
          hint: 'The house sleeps five: the two of you and three more. They sit by the fire until there is work for them.',
          apply: (st, api) => {
            api.welcome(guests(st).map((c) => c.id));
            st.flags.welcomed = true;
          },
        },
      ],
    },
    {
      id: 'wolves_slain',
      story: true,
      title: 'A fence around us',
      art: P.icon,
      text: (st) => {
        const s = st.story || {};
        const dead = (s.victims || []).map((v) => v.name);
        const heroes = (s.heroes || []).map((h) => `${h.name} killed ${h.kills === 1 ? 'one' : h.kills === 2 ? 'two' : h.kills} with ${his(h.female)} ${h.tool || 'bare hands'}`);
        return `${dead.length ? `${dead.join(' and ')} ${dead.length > 1 ? 'are' : 'is'} dead, taken by the ${P.plural} in the field.` : `The ${P.plural} are dead.`} ${heroes.length ? `${heroes.join('; ')}.` : ''}\n\nThat night ${st.founder} and ${st.spouse} come out of the house and sit by the fire. “We have lost our own,” he says. ${w.wall}`;
      },
      choices: [{ label: 'Build a fence', hint: 'Trees are a natural wall. Fence the open ground between them, and leave a gate.', apply: (st) => (st.flags.needFence = true) }],
    },
    {
      id: 'settled',
      story: true,
      title: 'Safe behind the fence',
      art: '🛡️',
      text: (st) =>
        `The last stake is lashed in place and the gate swings shut. For the first time since they came, ${st.founder} and ${st.spouse} sleep through the night.\n\nWord travels along the paths: there is ${w.safePlace}. Newcomers will come and sit by the fire, up to five at a time. Each new Plank House brings two more. Put them to work.\n\nBut keep them fed and give them beds: hungry or sleeping in the open, people grumble, and then they leave.`,
      choices: [
        {
          label: 'Let them come',
          apply: (st, api) => {
            if (st.flags.openingDone) return;
            st.flags.openingDone = true;
            st.flags.feedFirst = false;
            st.migrateT = 10;
            api.notify(`🔥 Word spreads of ${w.safePlace}. Newcomers will come and sit by the fire: give them work and beds.`, 'good');
          },
        },
      ],
    },
    {
      id: 'bandits_gone',
      story: true,
      title: 'Bandits!',
      art: '🏴',
      text: (st) => {
        const s = st.story || {};
        const dead = s.raidDead || [];
        const stolen = Object.entries(s.stolen || {}).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k === 'wood' ? 'planks' : k === 'yam' ? RESOURCES.yam.name.toLowerCase() : k}`);
        return `The bandits broke through the fence${dead.length ? `, killed ${dead.join(' and ')}` : ''}${stolen.length ? ` and carried off ${stolen.slice(0, 5).join(', ')}` : ''}. Then they were gone, back to their camp in the far corner of ${w.bush}.\n\n${st.founder} walks the broken fence with ${st.spouse}. “They are four, and they will come again,” he says. “We need a guard house and men to match them. And stronger houses. But first, we must fill the stores again.”`;
      },
      choices: [{ label: 'We will be ready', apply: (st) => (st.flags.raided = true) }],
    },
    {
      id: 'chapter_one',
      story: true,
      title: 'A town of red mud',
      art: '🧱',
      text: (st) =>
        `Where a single empty house once stood, there is now a settlement of red-mud houses behind a fence, with a guard house, sheds, a farm and a fire where newcomers sit.\n\n${st.spouse} looks around her. ${w.end}\n\nThe guided opening is over. ${ahead(st)}`,
      choices: [{ label: 'Onward', hint: 'Goals now appear at the top left.' }],
    },
  ];
}

// A land's first great host: it gathers at the far `side` of the land, its
// size answering the town it has heard of, and marches when it is ready
// (later if it was sent gifts). Breaking it wins the land. Returns its events
// and `coming(st, api, gifts)`, which the event that provokes it calls.
//   id       the host's faction id, and the stem of its events' ids
//   def      the faction (name, people, leader, colour, side, loot, desc...)
//   army     (n) => its garrison for n warriors, at least `min` and at most `max`
//   days     { defiant, gifts }: from gathering to marching
//   raid     { power, types, label, text }: riders who come first when defied
//   ally     { id, types, text }: friends who come when it marches, if asked
//   seen, march, beaten  { title, text(st, n) }: the pop-ups
//   onMarch  (st, api) => anything else that happens when it marches
//   won      the flag set when it is broken
export function greatHost(o) {
  const { id } = o;
  const left = (st) => st.units.filter((u) => u.owner === id && !u.dead).length;
  const askFlag = `${id}Ally`;
  const coming = (st, api, gifts) => {
    if (st.factionMap[id] || st.flags[`${id}Planned`]) return;
    st.flags[`${id}Planned`] = true;
    st.flags[`${id}Gifts`] = !!gifts;
    if (!gifts && o.raid) api.schedule(`${id}_raid`, 2);
    api.schedule(id, gifts ? 4 : 6);
  };
  const events = [
    {
      id,
      silent: true,
      apply: (st, api) => {
        if (st.factionMap[id]) return;
        // About as strong as your own army and towers.
        const n = Math.max(o.min || 30, Math.min(o.max || 50, Math.round((api.power() * 1.2) / 85)));
        const f = api.host({ ...o.def, id, garrison: o.army(n) });
        if (!f) return;
        f.onBeaten = `${id}_beaten`;
        api.schedule(`${id}_march`, st.flags[`${id}Gifts`] ? o.days.gifts : o.days.defiant);
        api.queue(`${id}_seen`, { at: { x: f.x + 0.5, y: f.y + 4 } });
      },
    },
    {
      id: `${id}_seen`,
      title: o.seen.title,
      art: '🥁',
      text: (st) => `${o.seen.text(st, left(st))}\n\n${st.flags[`${id}Gifts`] ? 'Your gifts bought time, but not peace: they are gathering all the same.' : `They have come to punish ${st.name} for its defiance.`} They will march when they are ready. Build houses, grow, train soldiers and call your friends: then carry the war to their camp, or wait for them behind your walls.`,
      choices: [{ label: 'We will be ready', hint: '⌂ beside the map brings you back to the town.' }],
    },
    {
      id: `${id}_march`,
      silent: true,
      apply: (st, api) => {
        const f = st.factionMap[id];
        if (!f || f.beaten) return;
        if (!api.march(id)) return;
        if (o.ally && st.flags[askFlag] && atPeace(st, o.ally.id)) api.lend(o.ally.id, o.ally.types, 10);
        o.onMarch?.(st, api);
        const u = st.units.find((x) => x.owner === id && !x.dead);
        api.vista(u.x, u.y, 8, 40);
        api.queue(`${id}_march_seen`, { at: { x: u.x, y: u.y } });
      },
    },
    {
      id: `${id}_march_seen`,
      title: o.march.title,
      art: '⚔️',
      text: (st) => `${o.march.text(st, left(st))}${o.ally && st.flags[askFlag] && atPeace(st, o.ally.id) ? `\n\n${o.ally.text}` : ''}\n\nMan the fence, gather your soldiers, and hold.`,
      choices: [{ label: 'To arms!' }],
    },
    {
      id: `${id}_beaten`,
      title: o.beaten.title,
      art: '🏆',
      text: (st) => o.beaten.text(st),
      choices: [{ label: 'Keep building', hint: 'More of Nigeria opens in a future update.', apply: (st) => (st.flags[o.won] = true) }],
    },
  ];
  if (o.raid) {
    events.push({
      id: `${id}_raid`,
      silent: true,
      apply: (st, api) => {
        const ids = api.border(o.raid.power, o.raid.types, { side: o.def.side, steal: true, patience: 90, label: o.raid.label });
        const u = ids.length && st.byId.get(ids[0]);
        if (u) api.notify(o.raid.text, 'war', u);
      },
    });
  }
  // Choices for the event that provokes it: gifts that buy time, asking a
  // friend to stand with you, or defiance.
  const choices = ({ gifts = 60, defy = 'We bow to no one!', defyHint = 'War. They will come.' } = {}) => [
    {
      label: `Send rich gifts, but bow to no one (🐚 ${gifts})`,
      hint: 'Buys time, not peace.',
      can: (st) => st.res.cowries >= gifts,
      apply: (st, api) => {
        st.res.cowries -= gifts;
        api.notify('🎁 The messengers take your gifts and go.', 'info');
        coming(st, api, true);
      },
    },
    ...(o.ally
      ? [{
        label: o.ally.ask,
        hint: 'If they are your friends, their warriors will come when the host marches.',
        can: (st) => friends(st, o.ally.id),
        apply: (st, api) => {
          st.flags[askFlag] = true;
          coming(st, api, false);
        },
      }]
      : []),
    {
      label: defy,
      hint: defyHint,
      apply: (st, api) => {
        api.mood('Defiance', 4, 4);
        coming(st, api, false);
      },
    },
  ];
  return { events, coming, choices };
}

export { many };
