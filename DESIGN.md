# Naija Rising — Nigeria Expansion Brief

Oct 18, 2026 · Kay (alternatefact Studios)

## How to use this brief

Every coding session on Naija Rising starts by reading this brief, then builds exactly one milestone from the build order below.

1. Read this brief and the files named for the milestone before changing anything.
2. Build one milestone per session and finish it to its acceptance checks. Say what is left undone at the end.
3. Keep every existing save loading. When the save shape changes, add a save version number and a migration.
4. Extend the engine; don't rewrite it. Regions, factions, events, flags and the story runner already do most of the work.
5. Put new content in data files, not engine code. A new kingdom or culture should be mostly data.
6. Ask before any architectural change this brief does not cover.
7. Bump `GAME_VERSION` in `js/ui/feedback.js` with each release.

## The vision

Eko Rising becomes **Naija Rising — Build your Nigeria**: one long campaign in which you pick your home kingdom, build it up, unite Nigeria, and win it back from colonial rule. Each home kingdom is a chapter: Naija Rising: Èkó (today's Eko Rising), Naija Rising: Kano, and so on.

- **Choose your kingdom.** Every player starts in a kingdom of their choice: Èkó, Kano, Benin, Warri or the Northern Igbo lands in the first release, one in each part of the country but the North East and North Central, which come next (decided October 2026).
- **Same game, different skin.** Rules, buildings, economy and eras are identical everywhere. What changes is the culture: names, clothing, staple crop labels, an elite unit, festivals and stories from that region's history.
- **One long campaign.** Players come back for weeks. They city-build their home kingdom and expand across a map of Nigeria's old kingdoms, province by province.
- **Choices with consequences.** Big decisions, starting with the slave trade, come back later in ways the player is not warned about.
- **Something to brag about.** Provinces held, cities built, wealth and era go on a shareable card, and later on leaderboards by home kingdom.
- **A living game.** Weekly updates bring live events, such as a hyena season or a bandit surge, to every player at a given stage.
- **Later chapters.** Crude oil and corruption arrive in a future update to the campaign story.

## What exists today

The game is a plain JavaScript module app with no build step: about 40 code files and 50 art files, with Lagos complete as chapter one.

| Area | Files | What it does now |
| --- | --- | --- |
| Boot and loop | `index.html`, `js/main.js` | Title screen, new-game form (founder, wife, settlement, seed), game loop |
| Eras | `js/data/eras.js` | Farmstead, Compound, Town, Port City, Metropolis, each with requirements and a Yoruba name (`yo`) |
| Buildings | `js/data/buildings.js` | About 35 types, from compound and hut to port, school, assembly and bank |
| Units | `js/data/units.js` | Player units (scout to musketeer), enemy units (Edo, Portuguese, Royal Marine, slaver), hired fighters |
| Resources | `js/data/resources.js` | Food, goods, imports; money changes from cowries to pounds to naira by era |
| People | `js/data/people.js`, `js/data/names.js` | Ten 3D character models made with Higgsfield, animation clips, Yoruba names |
| Regions | `js/regions/index.js` | Region registry and the tile cartogram of all 36 states plus FCT |
| Lagos | `js/regions/lagos.js` (62 KB) | Terrain, kingdoms, places of interest, about 40 story events, guided opening, objectives |
| Ogun | `js/regions/ogun.js` | Chapter two: kingdoms, places, 5 events, no guided opening |
| Simulation | `js/sim/*` | Economy, citizens, military, factions, trade, events, story runner, animals |
| World | `js/world/*` | Procedural map from each region's terrain settings, pathfinding |
| Rendering | `js/render/*` | Isometric renderer, sprite atlas, ground, minimap |
| Interface | `js/ui/hud.js` (74 KB), `js/ui/feedback.js` | Panels, build bar, feedback form |
| Art | `art/iso/sheet-0` to `sheet-10`, `sprites.json` | Baked character and building sprites, about 7 MB |

Event choices can already set flags and schedule follow-up events (`api.schedule`). That is everything the delayed-consequence system needs.

## The long campaign

One campaign runs from a farmstead to the New Nigeria in seven phases, tied to the five existing eras. Temptation comes early; the British come late.

| # | Phase | Era | What happens | Gate to the next phase |
| --- | --- | --- | --- | --- |
| 1 | Rise | Farmstead → Compound | Build your home kingdom against neighbours, predators, floods and drought. | Compound era reached |
| 2 | First contact | Compound → Town | Ships or desert caravans bring trade and guns, and an offer to buy captives. | Palace built, one kingdom subdued: Town era |
| 3 | Expand | Town | The Nigeria map opens: win nearby provinces by treaty, tribute or war. | 4 provinces held: Port City era |
| 4 | Abolition era | Port City | Palm oil replaces the slave trade; past sales hand the British their excuse. | The British advance begins |
| 5 | The Scramble | Port City | The British take independent provinces one by one, by treaty or by force. | You refuse to hand over your provinces |
| 6 | Liberation war | Port City → Metropolis | Refuse to give up your provinces, then win back every British-held one. | Every province held or allied, Assembly built |
| 7 | The New Nigeria | Metropolis | Proclaim the New Nigeria and choose its shape: kingdoms, regions or states. | — |

The game's signature runs from phase 2 to phase 4: captives sold at first contact come back in the Abolition era and after, as the British excuse and as their riflemen.

## Same game, different skin: culture packs

A culture pack is one data file that reskins the game for one people; a home kingdom names its culture, and the rules stay identical.

**What a culture pack changes**

- Names: default founder, spouse and settlement, citizen names, leader titles.
- Clothing: one character model per role (founder, wife, woman, farmer, woodcutter, hunter, fisher, labourer, spearman). All share one skeleton, so every animation clip is reused.
- One elite unit (see Elite units).
- Words: era names in the local language, the welcome greeting, the festival.
- Staple crop label and icon. The internal resource id stays `yam` so saves and code keep working; Kano simply shows it as millet.
- Story: opening text, first big enemy, three to six historical events, places of interest, and the adviser who guides the player.
- Threats: the local predator and the local environmental event.

**What stays the same everywhere**

Buildings and costs, economy, eras and their requirements, ordinary units, combat, the guided-opening steps (only their words change), saves and the interface.

**Data shape**

```js
// js/cultures/hausa.js
export const HAUSA = {
  id: 'hausa',
  name: 'Hausa',
  defaults: { founder: 'Garba', spouse: 'Hauwa', settlement: 'Dala' },
  names: { male: [/* ... */], female: [/* ... */] },
  greeting: 'Sannu da zuwa',
  eraNames: ['Gona', 'Gida', 'Gari', 'Birni', 'Babban Birni'], // check with a native speaker
  characters: { founder: 'hausa_founder', wife: 'hausa_wife', farmer: 'hausa_farmer' /* ... every role */ },
  staple: { res: 'yam', name: 'Millet', icon: '🌾' },
  elite: 'lifidi',
  predator: 'hyena',
  festival: 'durbar',
};
```

**Wiring**

- Each region file gains `culture: 'hausa'` (Lagos and Ogun become `yoruba`).
- The `yo` field in `eras.js` moves into each pack's `eraNames`.
- `people.js` and `names.js` are keyed by culture. Elite units in `units.js` carry a `culture` field.
- The title screen's Nigeria map becomes the home-kingdom picker, drawn as the province map (see The Nigeria map). Tap a kingdom, and its region and culture load.

## The starting cultures

The first release offers five home kingdoms, one per culture: Èkó (Yoruba), Kano (Hausa), the Northern Igbo lands (Igbo), Benin (Edo) and Warri (Itsekiri). Nri was the first plan for the Igbo start; in October 2026 Kay chose the Northern Igbo lands (Enugu, Ebonyi) instead, so Nri is a campaign province that a Northern Igbo player meets as a friend who can end wars.

| | Yoruba | Hausa | Igbo | Edo |
| --- | --- | --- | --- | --- |
| Home kingdom (today) | Èkó (Lagos) | Kano | Northern Igbo lands (Enugu, Ebonyi) | Benin (Edo) |
| Founder · spouse | Àdìó · Àdùkẹ́ | Garba · Hauwa | Nwankwo · Adaeze | Osaro · Ivie |
| Settlement | Èkó | Dala, the hill Kano grew around | Umunwankwo, "children of Nwankwo" | Igodomigodo, the old name of Benin |
| Ruler's title | Ọba | Sarki | Eze (Obi in some towns) | Oba |
| Welcome line | Ẹ káàbọ̀ | Sannu da zuwa | Nnọọ | Kóyo (check) |
| Staple label | Yam, with fish and garri | Millet | Yam | Yam |
| Terrain | Lagoon, creeks, coastal forest | Dry savanna, Dala and Goron Dutse hills, no sea | Hills and light forest, the Nsukka–Udi uplands | Rainforest, the city's moats |
| Predator | Leopard (replaces wolves) | Hyena pack | Leopard | Leopard |
| Nature event | Lagoon flood, Harmattan | Drought, Harmattan, locusts | Gully erosion, heavy rains | Floods, heavy rains |
| First big enemy | The Oba's host from Benin (exists) | Kwararafa (Jukun) raiders | Aro raiding bands | The Igala army from Idah |
| Festival | Eyo (exists) | Durbar | New Yam Festival (Iri Ji) | Igue |
| Elite unit | Ẹ̀ṣọ́ Rider | Lifidi Horseman | Abam Warrior | Leopard Guard |
| Adviser | Baba Ajayi | Malam Sule | Ozo Nwafor | Pa Osagie |

### Story beats

Each start gets three to six events from its own history, run by the existing event engine. The British arc at the end is shared by all.

**Hausa (Kano)**

- Founding at Dala Hill under Bagauda, the first king in the Kano Chronicle.
- Muhammad Rumfa (1463–99) extends the walls and opens the Kurmi market: a building milestone.
- Queen Amina of Zazzau (16th century), a powerful neighbour to ally with or rival. Her walls inspire a wall upgrade.
- The long rivalry with neighbouring Katsina.
- Kwararafa invasions (17th century): the first great host to break.
- Desert caravans bring horses, salt and books: Kano's version of the ships, so horses come early.
- Usman dan Fodio's movement (1804) and the Sokoto Caliphate. Handle with care (see Sensitivity).
- British conquest of Kano and Sokoto, 1903: the northern front of the colonial arc.

**Igbo (Northern Igbo lands)**

- Nri priest-kings, whose authority settled feuds without armies. Unique option: pay Nri priests to end a war.
- The Igbo-Ukwu bronzes (9th–10th century): a place of interest and a discovery event.
- The four market days, Eke, Orie, Afọ and Nkwọ. Markets pay more on your town's day, and children are named for their market day (Okeke, Okoye, Okafor, Nwankwo).
- The Aro and their oracle at Arochukwu. Here the slave trade arrives through the oracle, not the ships.
- Akwete weaving for cloth.
- The Anglo-Aro War, 1901–02: the eastern front of the colonial arc.
- The Women's War, 1929: market women rise against colonial taxes.

**Edo (Benin)**

- From the Ogiso kings to the Obas: the founding legend.
- Oba Ewuare the Great (15th century) rebuilds the city with walls and moats: a unique moat upgrade.
- The Portuguese reach Benin in the 1480s, so first contact comes earlier than anywhere else.
- Queen Mother Idia and the Idah war against the Igala (around 1515–16): the first great host.
- The bronze casters' guild on Igun Street: a craft building that makes wealth.
- The British expedition of 1897 and the taking of the bronzes. This time the player can change the ending.

**Itsekiri (Warri)**

The fifth start, added in October 2026. Founder Tosan, wife Omawumi, settlement Ijala; the ruler is the Olu; the staple is plantain; the predator is crocodiles from the creeks; the festival is the canoe regatta. The greeting and the age names stay in English until a speaker checks them. Its elite is the War-Canoe Gunman, and its adviser Pa Omatsola (see Open decisions).

- Prince Ginuwa of Benin founds the Olu's line (around 1480) and brings followers from Benin.
- Creek trade with the Urhobo, Isoko and Ijaw: salt, fish and palm oil.
- The Portuguese reach Warri soon after Benin; an Olu's son is schooled in Portugal.
- Benin claims Warri as its own: the war fleet of Benin is the first great host, and the Urhobo can be asked to stand with you.
- Nana Olomu and the British at Ebrohimi, 1894: the delta front of the colonial arc.

### Names

| Culture | Men | Women |
| --- | --- | --- |
| Yoruba | Existing `names.js` | Existing `names.js` |
| Hausa | Garba, Musa, Bello, Sani, Usman, Yusuf, Haruna, Danjuma, Shehu, Aliyu | Hauwa, Amina, Zainab, Hadiza, Binta, Rakiya, Maimuna, Larai, Hafsat, Aisha |
| Igbo | Nwankwo, Okeke, Okafor, Okoye, Obinna, Chukwuemeka, Nnamdi, Ifeanyi, Ugochukwu, Obiora | Adaeze, Ngozi, Nneka, Chiamaka, Ifeoma, Adaku, Obiageli, Chinwe, Nkechi, Ogechi |
| Edo | Osaro, Osagie, Eghosa, Idahosa, Omoruyi, Efosa, Osayande, Ehigiator, Uyi, Ogbeide | Ivie, Osasu, Eseosa, Imade, Ewere, Ofure, Osayuki, Isoken, Itohan |

Have a native speaker check every name, title and greeting, with tone marks, before release.

## The adviser

Each culture has one old male adviser, the same man for the whole game, whose portrait appears beside every new objective, hint and warning.

- He is an elder of the founder's people who knew the land before the founder came. He replaces the unnamed guide in the guided opening (steps with `who: 'guide'`), and he speaks every prompt in Love and fear and Wooden towers.
- Story characters keep their own faces: the founder and spouse in the guided opening, and envoys, kings and foreign captains in events, using the existing leader art.

| Culture | Adviser | Look |
| --- | --- | --- |
| Yoruba | Baba Ajayi | Short grey beard, plain fila cap, faded indigo buba and wrapper, a string of beads, carved walking stick |
| Hausa | Malam Sule | White beard, indigo turban, plain white gown, leather sandals, tall walking staff |
| Igbo | Ozo Nwafor | Grey beard, red cap of a titled elder, wrapper at the waist, carved walking stick and a hand fan |
| Edo | Pa Osagie | Grey beard, white wrapper, coral bead necklace, plain cap, walking stick |
| Itsekiri | Pa Omatsola | Grey beard, white cloth cap, loose white smock, woven wrapper over the shoulder, coral bead necklace, walking stick |

**Where he appears**

- A head-and-shoulders portrait beside the objectives box at top left, with his name.
- Beside every new objective and hint, with one or two lines of plain advice.
- Beside warnings: raiders sighted, food running low, stores full, fear too high, a tower standing empty.
- Tapping his portrait repeats his current advice and opens the full list of goals.

**Three expressions:** calm for advice, pleased when a goal is done, worried when danger comes. That is three portraits per culture, 15 in all with the Itsekiri.

**Proverbs:** now and then he closes with a proverb in his own language, with its English meaning. Each culture pack carries 10 to 15 real proverbs collected and checked by a native speaker, never invented ones.

**Settings:** experienced players can turn off his optional tips. Objectives and warnings still show.

**Implementation notes**

- Each culture pack gains `adviser: { name, portraits: { calm, pleased, worried }, proverbs: [...] }`.
- Story steps with `who: 'guide'` show the adviser. The objectives box and warning notices show his portrait, with the expression set by the kind of message.
- Art: 12 portraits made with Higgsfield in the style of the leader portraits (`art/leader_*.webp`), each culture's three expressions made from one reference image so the face stays the same. Descriptors are in the Appendix.
- Later: a short voiced greeting per culture in the local language.

## Elite units

Each culture trains one elite unit at its Training Ground from the Town era, and each fights differently, so a home kingdom changes how you win battles.

| Unit (id) | Culture | Look | Battlefield role |
| --- | --- | --- | --- |
| Lifidi Horseman (`lifidi`) | Hausa | Rider and dark horse both in quilted cotton armour (lifidi), chain mail, turban with face veil, lance and broadsword, decorated bridle | Heavy shock cavalry: breaks spear lines, slow to turn, costly |
| Ẹ̀ṣọ́ Rider (`eso`) | Yoruba | Lighter horse, quilted vest, aso-oke sash, cap, spear and bow | Fast raider: hunts archers and supply carriers, weak in a long melee |
| Abam Warrior (`abam`) | Igbo | No horse. Big, muscular fighter with a heavy two-handed iron sword, raffia anklets, red war cloth on the head, white chalk lines | Slow, devastating melee: each blow also strikes one enemy beside the target |
| Leopard Guard (`leopardguard`) | Edo | Leopard-skin tunic, coral collar, bronze bells, iron sword, decorated shield | Defensive heavy: stronger near walls, moats or the palace, and steadies nearby soldiers |
| War-Canoe Gunman (`canoegun`) | Itsekiri | No horse. White head cloth, white smock, indigo-and-white wrapper, coral beads, powder gourds on a bandolier, trade gun | Fires from the water: crosses creeks, lagoons and mangroves like dry land, takes half from arrows and shot afloat, and his gun frightens horses |

**Numbers, as tuned** (compare: Horseman 140 hp, 15 attack, speed 3.2; Swordsman 125, 14, 2.0). The first guesses let the Abam win every fight and the Lifidi none; these came out of the headless fight test (`tests/fight.mjs`, `tests/elite.test.mjs`), which sets armies of equal worth against each other on open ground, counting each recruit as worth 100 because people and army places are what run short by the Town age.

| Unit | HP | Attack | Speed | Cost | Its edge |
| --- | --- | --- | --- | --- | --- |
| Lifidi Horseman | 250 | 20 | 2.7 | 1 horse, 2 weapons, 4 cloth, 70 money | Double against soldiers on foot; a beat to wheel round before each new foe |
| Ẹ̀ṣọ́ Rider | 135 | 14 | 3.9 | 1 horse, 1 weapons, 45 money | 3.5 times against archers and gunmen, 1.8 against carriers; weaker after six seconds in one melee |
| Abam Warrior | 200 | 20 (every 1.5 s) | 1.8 | 2 weapons, 20 food, 50 money | Each blow also strikes the enemy beside the target, at 70% |
| Leopard Guard | 170 | 16 | 2.1 | 2 weapons, 4 iron, 55 money | Within 4 tiles of your walls, towers or palace: 30% harder blows, 25% less harm; soldiers beside him take 15% less |
| War-Canoe Gunman | 100 | 22 (range 6) | 2.4 | 1 weapons, 12 wood, 60 money | Lagoon, river and mangrove like dry land; half damage from arrows and shot afloat; 1.5 times against horsemen |

Who beats whom in the open: Lifidi breaks Abam, Leopard Guards and spearmen; Abam beats swordsmen, Leopard Guards and the gunmen; swordsmen and gunmen stop the Lifidi; Ẹ̀ṣọ́ rides down archers, musketeers and the canoe men. By your walls the Leopard Guard holds against the Abam who beats him in the open.

**Rules**

- Only your own culture's elite can be trained.
- Allied or conquered provinces of another culture let you hire their elite for a daily wage. Uniting a Hausa kingdom gives you Lifidi Horsemen, so diverse alliances pay. Until the campaign map exists (milestone 8), the peoples of your own land stand in for provinces: an allied or conquered people of another culture lends its elite (150 money, then 5 a day), so Warri can hire Leopard Guards from the Oba's river post, and Benin Ẹ̀ṣọ́ riders from Owo.
- Optional, to test: horses slowly lose health in forest (the tsetse fly). This is why northern cavalry never conquered the forest belt, and it keeps north and south different.

## Love and fear

A new Rule dial runs from Loved to Feared. Joyful buildings push it one way and speed up workers; fearful buildings push it the other way and make soldiers stronger but workers slower.

**How it works**

- Happiness stays as it is (food, taxes, events) and still decides whether newcomers arrive or people leave. Joyful buildings raise it; fearful ones lower it a little.
- The Rule dial runs from −5 (Feared) to +5 (Loved). It comes from the joy and fear points of your buildings, measured against population, so a growing town needs more of them to hold its level. It shows in the Rule panel (⚖️) and on the top bar.

| Dial | Workers | Soldiers | Also |
| --- | --- | --- | --- |
| Loved (+5) | Up to 25% faster | No change | Newcomers come more often; joyful buildings cost upkeep |
| Feared (−5) | Up to 20% slower | Up to 20% stronger attack | Less theft and desertion, conquered provinces rebel more slowly, lower happiness, fewer newcomers |

Each step on the dial gives a fifth of the full effect.

**Joyful buildings**

| Building | What you see | Joy | Upkeep |
| --- | --- | --- | --- |
| Palm wine hut | Drinkers on benches, singing; one drunkard wanders out | 2 | Palm wine from a new Palm Wine Tapper |
| Storyteller's tree | Children round an elder at dusk | 1 | None |
| Board-game shade | Elders playing ayò or their culture's own board game | 1 | None |
| Wrestling ground | A bout every few days with a cheering crowd | 3 | 10 money prize per bout |
| Drum and dance ground | Drummers and dancers in the evening | 2 | 5 money a day |
| Festival ground | The culture's festival: Eyo, Durbar, New Yam Festival or Igue | 4 during a festival, 1 otherwise | Food and money for each festival |

**Fearful buildings**

| Building | What you see | Fear | Upkeep |
| --- | --- | --- | --- |
| Stocks | Now and then a wrongdoer sits in the stocks while villagers jeer | 2 | None |
| Lock-up | A guarded hut with a barred door | 2 | A guard's wage |
| War-trophy rack | Captured shields, spears and banners at the gate, growing with each victory | 1 for every 3 victories, up to 4 | None: earned in war |
| Curfew drum | A drummer beats curfew at dusk and everyone goes indoors | 3 | A drummer's wage; workers stop at dusk |
| Guards' parade ground | Palace guards drilling in the square | 2 | Soldiers' upkeep |
| Executioner's platform | A raised platform and a ceremonial sword; sentences are announced in event text and no violence is shown | 5 | None |

**Culture skins**

- Kano gets a kola-nut house instead of a palm wine hut, with no drunkard: kola was the north's great social pleasure and suits a Muslim court. Its wrestling ground holds dambe boxing and kokawa wrestling, and its guards are the emir's dogarai.
- Yoruba: ẹmu (palm wine), ìjàkadì wrestling and ayò. Igbo: palm wine and mgba wrestling. Edo: palm wine and the Oba's palace guard.
- Native speakers name every building in each culture.

**The drunkard**

- Each palm wine hut lets out one drunkard. He wanders the lanes singing, naps under trees, and sometimes drifts towards the bush.
- He is an ordinary villager: raiders and wild animals can kill him. If he dies, the village mourns him for a day, with a small dip in happiness.
- Now and then he starts a palm wine brawl (see the choice events below).
- He is played for comedy: a sway in his walk and a calabash in his hand, nothing crude.

**Prompts along the way**

The adviser nudges the player. These are advice, not orders.

| When | His expression | What he suggests |
| --- | --- | --- |
| Happiness low for 3 days | Worried | "The people are weary": a palm wine hut, wrestling ground or festival |
| Theft from the stores | Worried | Stocks or a lock-up |
| A great host gathers | Worried | A trophy rack or guards' parade, so the men fear you more than the enemy |
| After a big victory | Pleased | Show the captured shields on a trophy rack |
| Workers slowed by fear for 5 days | Worried | Ease off: a festival or a storyteller's tree |

Choice events, run by the existing event engine:

- **A thief at the granary:** pardon him (one step towards Loved for a few days), a day in the stocks (one step towards Feared), or banish him (lose one villager).
- **A palm wine brawl:** laugh it off (happiness up, but it may happen again), fine the drinkers (money and a little fear), or close the hut for a week (happiness down).
- **Families talk of leaving** (the dial at Feared for 10 days): ease up (one step towards Loved) or crack down (fear holds and two families leave).

**Beheading stands are left out.** They break the brief's no-gore rule, push the age rating up, limit where the game can be advertised, and repeat the "City of Blood" image British accounts used to justify the 1897 attack on Benin. The executioner's platform gives the same top level of fear without showing violence.

**Implementation notes**

- Building definitions gain `joy` or `fear` points and an `upkeep`. A daily update in `js/sim/economy.js` sets `st.rule`: joy minus fear, divided by one point per 10 people, rounded and capped at ±5. Old saves start at 0.
- The workers' speed multiplier goes where work rates are worked out (`js/sim/citizens.js`); the soldiers' attack multiplier goes in `js/sim/military.js`.
- New resource `palmwine`, made by a Palm Wine Tapper workplace beside oil palms.
- The drunkard is a citizen with `special: 'drunk'`: an idle wander loop, a slowed walk with a sway, and a calabash prop.
- Culture packs carry the building names and skins, for example `skins: { winehut: 'kolahouse' }` for Hausa.
- The empire card shows "Ruled by love" or "Ruled by fear".
- Art: about 12 building sprites plus culture variants, the drunkard (an existing villager model with a calabash) and a villager-in-the-stocks pose.

## Wooden towers

The watchtower becomes a wooden tower that archers climb. From the top they see further, shoot further, raise the alarm sooner and are harder to kill, but if the tower falls, everyone on it dies.

**How it works**

- Select archers (tap them, or drag a box with ⬚ Select), then tap a tower. They walk to it and climb up, taking a couple of seconds each. The tower's panel shows its places and a "Come down" button.
- Archers and hired bowmen can climb, and so can musketeers and Dane-gun men once they exist. Spearmen, swordsmen and riders cannot.
- An empty tower still gives a little vision but shoots nothing. Today's watchtower shoots by itself; that goes.
- When enemies come into a manned tower's view, it raises the alarm: a drum, a notice and a flash on the minimap.

| | Archer on the ground | Archer on a wooden tower |
| --- | --- | --- |
| Sees | 6 tiles | 10 tiles |
| Shoots | 5 tiles | 7 tiles |
| Enemy arrows and shots | Full damage | Half damage |
| Enemy spears and swords | Can reach him | Cannot reach him; the enemy must bring the tower down |

**The tower:** Compound era, 3 archers, strength 260, costing 25 wood, 6 stone and 15 money (today's watchtower cost). A later upgrade can add a mud-brick tower with 4 places and twice the strength.

**When a tower falls**

- Enemy spearmen and swordsmen hack at the base while enemy archers shoot at the men on top.
- When the tower's strength runs out, it collapses in dust and falling timber, and every archer on it dies. A notice names the loss, for example "The east tower has fallen. Three archers died with it." No bodies are shown.
- A damaged tower can be mended with 🔨 Repair like any building, so the player can repair it in time or call the archers down.

**Prompts:** when raiders are sighted and a tower stands empty, the adviser says the towers need archers. The first time a tower falls with men on it, the adviser suggests mending damaged towers or bringing the men down sooner.

**Implementation notes**

- `watchtower` in `js/data/buildings.js` becomes the Wooden Tower. It loses its `tower` auto-fire (the palace keeps its own) and gains `garrison: { places: 3, accepts: ['archer', 'bowman', 'musketeer'], range: 2, vision: 4, shotDamage: 0.5 }`.
- Units on a tower carry `u.inTower = <building id>`. They stay at the top, are drawn on the tower, and melee enemies cannot target them.
- `damage()` in `js/sim/military.js` halves ranged damage to a unit with `inTower`. When the tower's strength reaches 0, every unit with that `inTower` dies.
- `armyPower` counts a tower only when it is manned; today it adds 25 for every watchtower.
- Old saves: existing watchtowers become empty wooden towers, and a one-time notice asks the player to man them.
- Art: a platform with three archer spots on the tower sprite, a climbing pose, and a collapse effect.

## Hidden consequences: the slave trade

The slave-trade choice is the game's signature: selling captives pays fast and buys guns early, and later those same people come back as soldiers against you. The player sees only the immediate effect when choosing.

**When it comes:** early, in the Compound or Town era, while guns still matter. It must not wait until the player already holds many provinces, or saying no costs nothing.

**How it arrives in each culture:** Èkó and Benin through the ships (Benin first, as it met the Portuguese earliest); Kano through buyers travelling with the desert caravans; the Igbo lands through the Aro and their oracle; Warri through the Portuguese ships in the creeks. Each version offers the same three options and sets the same flags.

| Choice | Shown right away | Hidden until it happens |
| --- | --- | --- |
| Sell captives to the buyers | Money, and muskets at half price from the next ship | Colonial landings include riflemen who were sold from your land. The British arrive sooner, giving "ending the slave trade" as their reason, as at Lagos in 1851. Neighbours whose people were taken trust you less. |
| Forbid it and free the captives | A barracoon appears to attack (already in Lagos) | Freed people join even over the settler cap, never desert, fight harder against slavers, spot enemy landings early, and some bring a craft |
| Look away and trade only palm oil | A small loss of morale (already in Lagos) | Nothing extra; the British keep their usual timetable |

The buyers come back every 20 to 30 days while the player keeps selling. Each sale is its own choice, and each makes the later consequence bigger.

**Reveal rules**

- Foreshadow at the choice with one line from an elder. Lagos already has one: a village that sells its neighbours will one day be sold itself.
- Never show the hidden effect in hints or tooltips.
- When it lands, an event card names the cause and the year, for example: "These soldiers were taken from your coast in 1523. The British trained them and gave them rifles."
- The chronicle and share card record which path the player took.

**Implementation notes**

- Flags: `soldCaptives` (a count), `soldYear` (the first sale), `abolition` (exists), `freedCount`.
- New enemy unit `colonial` (about 110 hp, 22 attack, rifle range 6), named on screen as soldiers taken from your land. Foreign landings add `min(12, soldCaptives × 2)` of them.
- Earlier British arrival: shorten the `consul` trigger by 10 days per sale, to a floor.
- Abolition rewards: a settler-cap bonus equal to `freedCount`, a `loyal` mark that skips desertion, +25% attack against slavers, and landings revealed a day early.
- This replaces the earlier idea of freed people eating a third of the food (see Open decisions).

## The Nigeria map

Players city-build only their home kingdom. The rest of Nigeria is 28 provinces based on the kingdoms and peoples' lands of around 1600, won by alliance, tribute or war. Nigeria's states only date from 1967, so the map follows the powers a player would really have met between 1400 and 1960.

| Province | Area | Held by, around 1600 | Roughly today |
| --- | --- | --- | --- |
| Kanem-Bornu | North | The Mai, at Ngazargamu | Borno, Yobe |
| Kano (home start) | North | The Sarki of Kano | Kano, Jigawa |
| Katsina and Daura | North | The Sarki of Katsina | Katsina |
| Zazzau | North | The Sarki of Zazzau; Queen Amina in the 16th century | Kaduna, FCT |
| Gobir and Zamfara | North | The Sarkin Gobir and the Sarkin Zamfara | Sokoto, Zamfara |
| Kebbi | North | The Kanta of Kebbi | Kebbi |
| Bauchi and Gombe lands | North | Many peoples, no single ruler (council) | Bauchi, Gombe |
| Upper Benue lands | North | Many peoples, no single ruler (council) | Adamawa |
| Nupe | Middle Belt | The Etsu Nupe | Niger |
| Borgu | Middle Belt | The king of Bussa | West Niger, north Kwara |
| Kwararafa | Middle Belt | The Aku Uka of the Jukun, at Wukari | Taraba, Nasarawa |
| Tiv lands | Middle Belt | Elders' councils (council) | Benue |
| Plateau lands | Middle Belt | Berom, Ngas and other peoples (council) | Plateau |
| Igala | Middle Belt | The Ata of Igala, at Idah | Kogi |
| Ọ̀yọ́ | West | The Alaafin, at Ọ̀yọ́-Ilé | Oyo, south Kwara |
| Ifẹ̀ and Ìjẹ̀ṣà | West | The Ooni of Ifẹ̀; the Owa Obokun at Ilesa | Osun |
| Ekiti kingdoms | West | The Ekiti kings | Ekiti |
| Ondo and Owo | West | The Olowo of Owo; the Osemawe of Ondo | Ondo |
| Ìjẹ̀bú | West | The Awùjalẹ̀, at Ìjẹ̀bú-Òde | East Ogun |
| Ẹ̀gbá and Awori towns | West | Forest towns under Ọ̀yọ́'s sway | West Ogun |
| Èkó (home start) | West | The Ọba of Èkó, paying tribute to Benin | Lagos |
| Benin (home start) | South | The Oba of Benin | Edo |
| Warri, Urhobo and Isoko (home start) | South | The Olu of Warri; Urhobo and Isoko clans | Delta |
| Delta city-states | South | The trading houses of Bonny, Kalabari, Nembe and Okrika | Rivers, Bayelsa |
| Old Calabar and Ibibio lands | South | Efik trading houses; Ibibio and Annang councils | Cross River, Akwa Ibom |
| Nri and Onitsha | South | The Eze Nri, a priest-king; the Obi of Onitsha | Anambra |
| Aro lands | South | The Aro, through their oracle at Arochukwu | Abia, Imo |
| Northern Igbo lands (home start) | South | Village councils (council) | Enugu, Ebonyi |

The borders and tribute links are a design snapshot, not a single historical year. Have a historian check them before milestone 8.

**Data** (`js/campaign/provinces.js`, new): for each province, its id, name, area, neighbours, holder and title, overlord if it pays tribute, culture pack if one exists, `council: true` for lands without kings, strength 1–5, daily yield, land type (coast, forest, savanna, delta), and the modern states it covers, shown in the picker. A simple province map replaces the state cartogram (`STATES` in `js/regions/index.js`).

**Colours:** the title-screen picker shades each province by its part of the land (north, Middle Belt, west, south) so a player can find their way; those colours belong to the picker only. The campaign map colours each province by who holds it.

**Province status:** independent, allied, paying tribute, conquered, or British. Some provinces start out paying tribute to another: Èkó to Benin, the Ẹ̀gbá towns to Ọ̀yọ́. Freeing a tributary wins a quick friend and angers its overlord.

**Lands without kings** (marked "council" in the table): Igbo village groups, the Tiv, the Plateau and Upper Benue peoples and the Ibibio were governed by councils of elders, not thrones. There is no capital to capture. The player wins them council by council, through gifts, trade, settling disputes and defending them from raiders. Force works, but each council resists separately and unrest stays high.

**Rules**

1. The map opens in the Town era. Before that, the game is the home kingdom alone, as today.
2. You can only act on a province next to one you hold or are allied with.
3. Diplomacy reuses today's options: gifts, trade agreement, greet as kin, demand submission.
4. War: send an army from home. It takes a few days per province crossed. The first version settles battles automatically from `armyPower`, with some chance, and applies the losses. A later version can offer "fight it yourself" on a battle map generated from that province's terrain.
5. Provinces pay a daily yield, send recruits, and let you hire their culture's elite unit.
6. A conquered province needs a garrison, or unrest grows until it rebels.
7. Era requirements count provinces instead of kingdoms. Starting values to tune: Town 1, Port City 4, Metropolis 10, out of 28.
8. History moves on through events, not new borders. The Sokoto Caliphate (1804) can unite Hausa provinces the player does not hold, Ọ̀yọ́ can collapse in the 1830s unless the player has allied with or taken it, and the Ẹ̀gbá can found Abẹ́òkúta.

**The British advance:** from the Port City era, every few days the British take one independent province on the coast, a river or next to their holdings. Weak ones sign treaties, as the Royal Niger Company did; strong ones are conquered. Your allies resist and can call on you. Your own provinces are never taken without a battle.

**The colonial map:** British-held provinces are drawn as the colonial territories of their time: the Lagos Colony (1861), the Oil Rivers Protectorate (1884), the Royal Niger Company's lands (1886) and Northern Nigeria (1900). The Northern, Western and Eastern Regions appear only in this colonial layer, never as the starting map.

**Winning:** hold or ally every province, reach the Metropolis era, and build the House of Assembly. Then proclaim the New Nigeria, using the existing `proclaim` logic extended to the whole map, and choose its shape: a union of the old kingdoms, a few large regions, or many smaller states. The choice appears on the empire card and in the chronicle.

**Save shape:** a new `st.campaign` object holding each province's owner, status, overlord, loyalty and garrison, plus armies on the move. Old saves load with a campaign built from their current kingdoms.

## Live events

Live events are weekly challenges shipped with updates: each hits every player at a given stage during a set week, and surviving earns a badge worth bragging about.

| Event | Who gets it | What happens | Reward |
| --- | --- | --- | --- |
| The hyena season | Farmstead to Town | Hyena packs test your fences every few days | Badge and 150 money |
| Bandit surge | Town and above | Two bandit camps appear near your borders | Their loot is doubled |
| The great Harmattan | Everyone | Farms grow at half speed for a week | Granaries hold a third more afterwards |
| Festival week | Everyone | Your culture's festival runs all week | Happiness boost and one free elite unit |

**Data shape:** declarative, so events can later come from the studio server as plain data.

```js
// js/data/live.js
export const LIVE_EVENTS = [
  {
    id: 'hyena-season-2026-11',
    title: 'The hyena season',
    from: '2026-11-02', to: '2026-11-09', // Nigeria time (WAT)
    minEra: 0, maxEra: 2,
    cultures: null, // null = everyone
    effect: { kind: 'pack', animal: 'hyena', n: 6, everyDays: 3 },
    badge: 'Survived the hyena season',
    reward: { cowries: 150 },
  },
];
```

**Rules**

- Checked when a game loads and once per game day, against the real date in Nigeria time. Each event fires once per save.
- Every event carries a reward or badge. It must feel like a challenge, not a punishment for being ahead.
- Strength scales with the player's army, so it tests strong players without wiping out weak ones.
- The title screen shows a banner for the current event.
- Effect kinds are a fixed list the engine knows: pack, raid, drought, flood, caravan, festival. New kinds need a game update.
- First version: events ship inside the game files, no server needed. Later: the studio server serves `live.json` so a new event needs no release.

## Bragging: cards, accounts and leaderboards

Bragging ships in three steps: a shareable empire card first, which needs no server, then accounts with cloud saves, then leaderboards on the studio server.

**1. The empire card (no server)**

- One tap from the Era panel, and at every chapter milestone, draws an image of your empire.
- It shows home kingdom and culture, a small Nigeria map coloured by who holds what, cities, population, wealth, era, in-game year, days played, badges, and the slave-trade path taken ("Freed 34 captives").
- Landscape 16:9 by default, plus a 9:16 version for TikTok and WhatsApp Status.
- Shared through the phone's share sheet (WhatsApp, X, TikTok, Instagram), with a download fallback.
- Studio mark and game link on every card, so each share advertises the game.

**2. Accounts and cloud saves (studio server)**

- A campaign played for weeks cannot live only in browser storage; clearing the browser would lose it all.
- Sign in with an email link or Google. The save uploads every few minutes and on exit; if two devices disagree, warn before overwriting.
- UK GDPR applies: a privacy policy and a delete-my-account button. Children will play, so follow the ICO Children's Code: private by default, no real names shown, no location.

**3. Leaderboards**

- Boards by home kingdom ("Top Kano empires"), overall, and a weekly fixed-seed challenge.
- Measures: provinces held, population, wealth, era reached, and fewest days to unite Nigeria.
- Players pick a display name, filtered for slurs, including ethnic slurs, with a report button.
- Rivalry is between places, never peoples: "Kano vs Lagos", not one ethnic group against another.

**The honest limit on cheating:** the game runs on the player's device, so any leaderboard can be faked. Lagos Life's economy had to be reset after hacked balances. The server should reject numbers that are impossible for the days played and flag sudden jumps. Never attach money or prizes to a leaderboard. Only running the simulation on the server would fully stop cheating, and that is out of scope.

## Art direction and asset pipeline

Each new culture needs about ten character models on the shared skeleton, so every existing animation works unchanged; buildings stay the same in the first release.

**Clothing by role**

| Role | Yoruba (exists) | Hausa | Igbo | Edo |
| --- | --- | --- | --- | --- |
| Founder | Agbada over buba and sokoto, fila cap, horsetail whisk | Wide embroidered gown (babban riga) in white or indigo, turban, leather sandals, staff | Wrapper at the waist, red cap of a titled man with an eagle feather, carved staff | White wrapper with a high side fold, coral bead collar and cap, ceremonial fan-shaped sword (eben) |
| Wife | Iro and buba, gele headtie | Wrapper and blouse, headtie with a light veil, henna on the hands | Wrapper and top, uli body-art patterns, coral beads, plaited hair | Wrapper, coral beads, tall beaded hairstyle in the style of Queen Mother Idia |
| Village woman | Iro and buba, adire | Wrapper, blouse, headtie | Wrapper and top, plaited hair | Wrapper and top |
| Farmer | Existing | Short tunic and trousers, wide straw sun hat, short hoe | Knee-length wrapper, hoe, yam basket | Wrapper, short top, hoe |
| Woodcutter, hunter, fisher, labourer | Existing | Sleeveless smock and cap; tools as today | Wrapper and cloth headband; tools as today | Wrapper; tools as today |
| Spearman | Existing | Tunic, cap, leather shield, spear | Wrapper, raffia anklets, hide shield, spear | Wrapper, leather breastplate, decorated shield, spear |

The elite units' looks are in the Elite units table. Two horses are new: an armoured horse for the Lifidi Horseman and a lighter horse for the Ẹ̀ṣọ́ Rider. Check first how the current Horseman is drawn.

**Pipeline**

1. Generate a front-facing, full-body reference image per model with Higgsfield (prompts in the Appendix): A-pose, plain background, even light, so the 3D conversion is clean.
2. Convert to 3D with Higgsfield and fit it to the skeleton the current models use, so `CLIPS` in `people.js` work as they are.
3. Bake sprites with `tools/bake` into one sheet set per culture, for example `art/iso/hausa/`.
4. Load only the player's culture, plus a culture's sheets when the player first meets it. Aim for 3 MB or less per culture, because Nigerian players pay for mobile data.

**Also needed:** hyena and leopard models to replace wolves, and landscape event art for each culture's story beats (Durbar, New Yam Festival, Igue, Queen Amina, Oba Ewuare, Queen Mother Idia) in the existing documentary style.

**Later:** regional building skins, such as Hausa mud houses with pinnacled rooftops, Igbo compounds with painted mud walls, and Benin's long grooved red walls.

## Sensitivity and authenticity

The game asks Nigerians "what if?" about their own history, so it must never set one people against another or treat a faith as an enemy.

- **Many peoples, not four.** Nigeria has over 250 ethnic groups. The home-kingdom picker says more peoples are coming. Provinces without a pack keep their own peoples and rulers on the map (Nupe, Jukun, Tiv, Ijaw, Kanuri, Efik, Igala, Urhobo and others), never relabelled as another culture.
- **Enemies are historical kingdoms and foreign powers,** never today's ethnic groups. There is always a way to unite through alliance or trade. The Northern, Western and Eastern Regions were colonial creations, so they appear only as British rule, never as the starting map.
- **Faith is never a faction.** Islam, Christianity and traditional religions are never defeated, rewarded or punished. Usman dan Fodio's movement appears as a historical political force the player can ally with, resist or negotiate with.
- **The slave trade carries weight.** Captives are people, named in event text. A sale gets no cheerful sound, celebration or reward animation.
- **No civil war.** Leave 1967–70 out of the game.
- **No gore,** in line with the studio's visual rules.
- **Native-speaker review.** Speakers check names, titles, greetings and tone marks. Someone from each culture reviews clothing and stories before release, and is credited.
- **Careful dates.** Where historians disagree, use "around": "around 1515".
- **Keep the "what if" visible.** The chronicle shows where the player's history left the real one.

## Build order

Ten milestones, each one or a few coding sessions, in this order. Character art runs alongside: until a culture's models are baked, the code uses the existing models with a colour tint, so art never blocks code.

1. **Foundations.** Add this brief to the project as `DESIGN.md`. Split `lagos.js` into terrain, factions, events, story and objectives files. Add a save version and migration. Rename the game to **Naija Rising — Build your Nigeria** on the title screen, page title and share tags, but keep the internal `eko-rising` ids and storage keys so saves and feedback history carry over. If the web address changes, keep the old one redirecting. Add a headless test that plays 200 game days on a fixed seed for each start and fails on any error.
   - Done when: the game plays exactly as before, old saves load, and the test passes.
2. **Culture packs and the Kano start.** Create `js/cultures/` with a Yoruba pack (moved from today's data) and a Hausa pack. Move the guided opening into a shared file that takes its words from the pack. Add `kano.js` with savanna terrain, the Katsina and Zazzau kingdoms, the Kwararafa host, hyena packs and the Durbar. Replace the title screen's state cartogram with the province map, and make Èkó and Kano tappable. Add the Yoruba and Hausa advisers beside objectives and hints.
   - Done when: a Kano game runs the guided opening with Hausa names and words, and the Kwararafa host can be beaten.
   - Status (October 2026): built and shipped; the advisers, added to this milestone afterwards, followed with milestone 3's elite units.
3. **Elite units and wooden towers.** Add the four elite units, the rule that only your own culture trains its elite, and hiring them from allied provinces. Turn the watchtower into a wooden tower that archers man (see Wooden towers).
   - Done when: each start trains its elite in the Town era, the test shows no unit winning every fight, archers on a tower outshoot the same archers on the ground, and a tower that falls kills those on it.
   - Status (October 2026): the elite units are built, at Kay's request, with a fifth for Warri, the War-Canoe Gunman. Each has its own 3D model made with Higgsfield; the two riders sit on horses whose legs are rigged in code (`js/render3d/horse.js`), and the ordinary horsemen ride the light horse too. Each start trains its own elite from the Town age and no other, allies lend theirs, and no unit wins every fight (`tests/elite.test.mjs`). The wooden towers are still to do.
4. **Benin, Warri and Northern Igbo starts.** Add Igbo, Edo and Itsekiri packs, their region files, story beats, festivals and advisers.
   - Done when: all five home kingdoms are playable from the title screen.
   - Status (October 2026): built ahead of milestone 3, at Kay's request, and the advisers followed with the elite units. Each start runs the guided opening and its first great host can be beaten: the Igala army, Benin's war fleet, the Aro war bands (`tests/lands.test.mjs`). New starts are built from `js/regions/kit.js`. Next: a start in the North East (Kanem-Bornu) and one in North Central (Nupe or Kwararafa).
5. **Love and fear.** Add the Rule dial, the joyful and fearful buildings with their culture skins, the Palm Wine Tapper and the drunkard, the elders' prompts and the three choice events.
   - Done when: in a test run, joyful buildings speed up workers, fearful ones make soldiers stronger and workers slower, the drunkard can be killed in a raid, and each prompt fires in its situation.
6. **The slave-trade branch.** Add the sell option and its hidden consequences in each culture's version.
   - Done when: in a test run, selling produces sold-captive riflemen in a later landing with the reveal card, and freeing produces settlers over the cap.
7. **Live events and the empire card.** Add `live.js` with the hyena season as the first event, the title-screen banner, badges, and the shareable card in both sizes.
   - Done when: setting the device date into an event week triggers it, and the card shares on a phone.
8. **The Nigeria map.** Add the 28 provinces, tribute links, elders' councils for lands without kings, diplomacy, automatic battles, yields, garrisons and era requirements counted in provinces. Split the Ogun chapter into the Ìjẹ̀bú and Ẹ̀gbá provinces.
   - Done when: a player can win a neighbouring province by treaty and another by war, and both pay yields.
9. **The British advance and the liberation war.** Add British expansion across independent provinces, the colonial map, the fight to take them back, winning across the whole map, and the player's choice of the New Nigeria's shape. In the north, the invaders come before the British (decided October 2026): the Moroccan army that crossed the Sahara in 1591, then Rabih az-Zubayr's army in Borno in 1893, then the British in 1903. Name them always as historical armies, never as a people or a faith.
   - Done when: a full test campaign can end in the New Nigeria.
10. **Accounts, cloud saves and leaderboards** on the studio server, with the privacy work from the Bragging section.
   - Done when: a save made on one device continues on another, and impossible scores are rejected.

## Open decisions

These need Kay's answer before the milestone that depends on them.

- [ ] **Freed captives' reward** (milestone 6): this brief replaces "they eat a third of the food" with loyalty, combat and settler-cap rewards. Confirm, or bring the food rule back.
- [ ] **The province map** (milestone 8): check the 28 provinces, their borders and tribute links with a historian. The Ogun chapter is settled: it becomes the Ìjẹ̀bú and Ẹ̀gbá provinces.
- [ ] **How many provinces before the British advance** (milestone 8): the brief starts it at the Port City era with era goals of 1, 4 and 10 provinces out of 28. The original idea was 10 to 15 states first, which is a third to half of the map.
- [ ] **Where players play** (milestones 7 and 10): the studio website, which can host feedback, accounts and leaderboards, or the claude.ai link, which cannot reach the studio server's `/api/game-feedback`.
- [ ] **Studio server** (milestone 10): hosting, cost, and who moderates display names.
- [ ] **Reviewers:** who checks the Hausa, Igbo, Edo and Itsekiri names, clothing and stories. The Edo and Itsekiri age names and the Itsekiri greeting are left in English until then.
- [x] **Warri's elite unit** (milestone 3): Kay asked for one in October 2026: the War-Canoe Gunman.
- [ ] **Warri's adviser** (milestone 4): built as Pa Omatsola, an Itsekiri name chosen for the game. An Itsekiri speaker should confirm the name and his look, or give a better one.

## Later updates

These continue the campaign after the first release and are not part of the current build.

- **Crude oil.** Oil is found in the Delta provinces, as at Oloibiri in 1956. It brings huge income, plus pollution and unrest in the provinces that produce it.
- **Corruption.** As wealth grows, officials skim taxes and tribute. Courts, the Assembly, schools and a free press reduce it. Left unchecked, it feeds unrest and attacks.
- **More culture packs:** Kanuri (Borno), Ijaw (Bayelsa, Rivers), Tiv (Benue), Nupe (Niger), Efik and Ibibio (Cross River, Akwa Ibom), Urhobo (Delta), Igala (Kogi), Jukun (Taraba).
- **Second cities** in held provinces, and battles you fight yourself on a generated map.
- **Sound:** talking drums for war, market and lagoon ambience, a narrator for story events.
- **"What really happened" cards** after each historical event, and regional building skins.

## Appendix: character prompts

One template turns into every character reference: swap a descriptor from the table into `[DESCRIPTOR]`, generate it, then convert it to 3D. Generate riders and horses as separate images.

```text
Full-body character reference of [DESCRIPTOR]. Standing in a relaxed A-pose, facing the camera, feet visible, arms slightly away from the body. Historically grounded pre-colonial Nigerian clothing and materials.
Plain mid-grey studio background, soft even front light, no hard shadows.
85mm lens at f/8, eye level, deep focus, everything sharp. Natural skin texture, realistic fabric weave.
Colour: neutral and true to the fabric, no film grade, so the textures stay accurate in the game.
Negative prompt: dynamic pose, cropped feet, crossed arms, props covering the body, background scenery, motion blur, shallow depth of field, cartoon, fantasy armour, European medieval styling, Middle Eastern costume, text, watermark, gore, sexualised styling.
--ar 2:3
```

For a horse, change the first line to a side view of the horse standing square, and use `--ar 3:2`.

| Model | Descriptor |
| --- | --- |
| Hausa founder | a dignified Hausa chief in his forties, wide white embroidered gown over trousers, indigo turban, leather sandals, carved wooden staff |
| Hausa wife | a Hausa woman in her thirties, indigo and ochre wrapper and blouse, headtie with a light veil over the shoulders, henna patterns on her hands |
| Lifidi Horseman | a Hausa heavy cavalryman in thick quilted cotton armour in faded red, cream and indigo panels, chain mail beneath, turban with a face veil, long lance and broadsword |
| Lifidi horse | a dark horse covered in matching quilted cotton armour, ornate leather bridle with tassels |
| Igbo founder | an Igbo titled elder in his fifties, deep red cap with an eagle feather, patterned wrapper at the waist, coral bead necklace, carved wooden staff |
| Igbo wife | an Igbo woman in her thirties, woven wrapper and top, black uli patterns on her arms, coral beads, neatly plaited hair |
| Abam Warrior | a tall, heavily muscled Igbo warrior, knee-length wrapped war cloth, red cloth band round the head, white chalk lines on chest and arms, raffia anklets, heavy broad two-handed iron sword |
| Edo founder | an Edo chief in his forties, white wrapper with a high fold at the hip, thick coral bead collar and beaded cap, fan-shaped ceremonial sword |
| Edo wife | an Edo noblewoman in her thirties, wrapper, coral necklaces and wristlets, tall conical beaded hairstyle in the style of Queen Mother Idia |
| Leopard Guard | a Benin palace guard, leopard-skin tunic over a wrapper, high coral collar, small bronze bells at the waist, iron sword, round decorated hide shield |
| Ẹ̀ṣọ́ Rider | a Yoruba cavalryman of Ọ̀yọ́, quilted cotton vest, indigo and red aso-oke sash, close cap, spear and short bow |
| Ẹ̀ṣọ́ horse | a lighter chestnut horse with a simple leather bridle and a woven saddle cloth |
| Yoruba adviser (Baba Ajayi) | an old Yoruba man in his seventies, short grey beard, plain fila cap, faded indigo buba and wrapper, a string of beads, leaning on a carved walking stick |
| Hausa adviser (Malam Sule) | an old Hausa man in his seventies, white beard, indigo turban, plain white gown, leather sandals, a tall walking staff |
| Igbo adviser (Ozo Nwafor) | an old Igbo titled elder in his seventies, grey beard, red cap of a titled man, wrapper at the waist, a carved walking stick and a hand fan |
| Edo adviser (Pa Osagie) | an old Edo man in his seventies, grey beard, white wrapper, coral bead necklace, plain cap, a walking stick |
| Itsekiri adviser (Pa Omatsola) | an old Itsekiri man of Warri in his seventies, grey beard, plain white cloth cap, loose white cotton smock, a woven wrapper over one shoulder, coral bead necklace, a walking stick |
| War-Canoe Gunman | an Itsekiri war-canoe gunman of Warri, white cloth wound round the head, loose white cotton smock, wrapper of indigo-and-white woven cloth to the knee, leather bandolier with small powder gourds, coral beads, bare feet |

For an adviser, change the first line to a head-and-shoulders portrait, use a warm painted look matching the leader portraits, and make calm, pleased and worried versions from the same reference image so the face stays the same.
