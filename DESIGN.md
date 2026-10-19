# Naija Rising — Nigeria Expansion Brief

Oct 18, 2026 · Kay (alternatefact Studios)

## How to use this brief

Every coding session on Naija Rising starts by reading this brief, then builds exactly one milestone from the build order below.

1. Read this brief and the files named for the milestone before changing anything.
2. Build one milestone per session and finish it to its acceptance checks. Say what is left undone at the end.
3. Keep every existing save loading. When the save shape changes, add a save version number and a migration.
4. Extend the engine; don't rewrite it. Regions, factions, events, flags and the story runner already do most of the work.
5. Put new content in data files, not engine code. A new state or culture should be mostly data.
6. Ask before any architectural change this brief does not cover.
7. Bump `GAME_VERSION` in `js/ui/feedback.js` with each release.

## The vision

Eko Rising becomes **Naija Rising — Build your Nigeria**: one long campaign in which you pick your home state, build it up, unite Nigeria, and win it back from colonial rule. Each home state is a chapter: Naija Rising: Èkó (today's Eko Rising), Naija Rising: Kano, and so on.

- **Choose your state.** Every player starts in a state of their choice: Lagos, Kano, Anambra or Edo in the first release.
- **Same game, different skin.** Rules, buildings, economy and eras are identical everywhere. What changes is the culture: names, clothing, staple crop labels, an elite unit, festivals and stories from that region's history.
- **One long campaign.** Players come back for weeks. They city-build their home state and expand across a Nigeria map, state by state.
- **Choices with consequences.** Big decisions, starting with the slave trade, come back later in ways the player is not warned about.
- **Something to brag about.** States held, cities built, wealth and era go on a shareable card, and later on leaderboards by home state.
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
| 1 | Rise | Farmstead → Compound | Build your home state against local kingdoms, predators, floods and drought. | Compound era reached |
| 2 | First contact | Compound → Town | Ships or desert caravans bring trade and guns, and an offer to buy captives. | Palace built, one kingdom subdued: Town era |
| 3 | Expand | Town | The Nigeria map opens: win neighbouring states by treaty, tribute or war. | 4 states held: Port City era |
| 4 | Abolition era | Port City | Palm oil replaces the slave trade; past sales hand the British their excuse. | The British advance begins |
| 5 | The Scramble | Port City | The British take independent states one by one, by treaty or by force. | You refuse to hand over your states |
| 6 | Liberation war | Port City → Metropolis | Refuse to give up your states, then win back every British-held state. | Every state held or allied, Assembly built |
| 7 | The New Nigeria | Metropolis | Proclaim the New Nigeria. Oil and corruption arrive in later updates. | — |

The game's signature runs from phase 2 to phase 4: captives sold at first contact come back in the Abolition era and after, as the British excuse and as their riflemen.

## Same game, different skin: culture packs

A culture pack is one data file that reskins the game for one people; a home state names its culture, and the rules stay identical.

**What a culture pack changes**

- Names: default founder, spouse and settlement, citizen names, leader titles.
- Clothing: one character model per role (founder, wife, woman, farmer, woodcutter, hunter, fisher, labourer, spearman). All share one skeleton, so every animation clip is reused.
- One elite unit (see Elite units).
- Words: era names in the local language, the welcome greeting, the festival.
- Staple crop label and icon. The internal resource id stays `yam` so saves and code keep working; Kano simply shows it as millet.
- Story: opening text, first big enemy, three to six historical events, places of interest.
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
- The title screen's Nigeria map becomes the home-state picker. Tap a state, and its region and culture load.

## The four starting cultures

The first release offers four home states, one per culture: Lagos (Yoruba, already built), Kano (Hausa), Anambra (Igbo) and Edo (Benin).

| | Yoruba | Hausa | Igbo | Edo |
| --- | --- | --- | --- | --- |
| Home state | Lagos | Kano | Anambra | Edo |
| Founder · spouse | Àdìó · Àdùkẹ́ | Garba · Hauwa | Nwankwo · Adaeze | Osaro · Ivie |
| Settlement | Èkó | Dala, the hill Kano grew around | Umunwankwo, "children of Nwankwo" | Igodomigodo, the old name of Benin |
| Ruler's title | Ọba | Sarki | Eze (Obi in some towns) | Oba |
| Welcome line | Ẹ káàbọ̀ | Sannu da zuwa | Nnọọ | Kóyo (check) |
| Staple label | Yam, with fish and garri | Millet | Yam | Yam |
| Terrain | Lagoon, creeks, coastal forest | Dry savanna, Dala and Goron Dutse hills, no sea | Farmland and forest, gullies, River Niger to the west | Rainforest, the city's moats |
| Predator | Leopard (replaces wolves) | Hyena pack | Leopard | Leopard |
| Nature event | Lagoon flood, Harmattan | Drought, Harmattan, locusts | Gully erosion, heavy rains | Floods, heavy rains |
| First big enemy | The Oba's host from Benin (exists) | Kwararafa (Jukun) raiders | Aro raiding bands | The Igala army from Idah |
| Festival | Eyo (exists) | Durbar | New Yam Festival (Iri Ji) | Igue |
| Elite unit | Ẹ̀ṣọ́ Rider | Lifidi Horseman | Abam Warrior | Leopard Guard |

### Story beats

Each start gets three to six events from its own history, run by the existing event engine. The British arc at the end is shared by all.

**Hausa (Kano)**

- Founding at Dala Hill under Bagauda, the first king in the Kano Chronicle.
- Muhammad Rumfa (1463–99) extends the walls and opens the Kurmi market: a building milestone.
- Queen Amina of Zazzau (16th century), a powerful neighbour to ally with or rival. Her walls inspire a wall upgrade.
- The long Kano–Katsina rivalry with the next state.
- Kwararafa invasions (17th century): the first great host to break.
- Desert caravans bring horses, salt and books: Kano's version of the ships, so horses come early.
- Usman dan Fodio's movement (1804) and the Sokoto Caliphate. Handle with care (see Sensitivity).
- British conquest of Kano and Sokoto, 1903: the northern front of the colonial arc.

**Igbo (Anambra)**

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

### Names

| Culture | Men | Women |
| --- | --- | --- |
| Yoruba | Existing `names.js` | Existing `names.js` |
| Hausa | Garba, Musa, Bello, Sani, Usman, Yusuf, Haruna, Danjuma, Shehu, Aliyu | Hauwa, Amina, Zainab, Hadiza, Binta, Rakiya, Maimuna, Larai, Hafsat, Aisha |
| Igbo | Nwankwo, Okeke, Okafor, Okoye, Obinna, Chukwuemeka, Nnamdi, Ifeanyi, Ugochukwu, Obiora | Adaeze, Ngozi, Nneka, Chiamaka, Ifeoma, Adaku, Obiageli, Chinwe, Nkechi, Ogechi |
| Edo | Osaro, Osagie, Eghosa, Idahosa, Omoruyi, Efosa, Osayande, Ehigiator, Uyi, Ogbeide | Ivie, Osasu, Eseosa, Imade, Ewere, Ofure, Osayuki, Isoken, Itohan |

Have a native speaker check every name, title and greeting, with tone marks, before release.

## Elite units

Each culture trains one elite unit at its Training Ground from the Town era, and each fights differently, so a home state changes how you win battles.

| Unit (id) | Culture | Look | Battlefield role |
| --- | --- | --- | --- |
| Lifidi Horseman (`lifidi`) | Hausa | Rider and dark horse both in quilted cotton armour (lifidi), chain mail, turban with face veil, lance and broadsword, decorated bridle | Heavy shock cavalry: breaks spear lines, slow to turn, costly |
| Ẹ̀ṣọ́ Rider (`eso`) | Yoruba | Lighter horse, quilted vest, aso-oke sash, cap, spear and bow | Fast raider: hunts archers and supply carriers, weak in a long melee |
| Abam Warrior (`abam`) | Igbo | No horse. Big, muscular fighter with a heavy two-handed iron sword, raffia anklets, red war cloth on the head, white chalk lines | Slow, devastating melee: each blow also strikes one enemy beside the target |
| Leopard Guard (`leopardguard`) | Edo | Leopard-skin tunic, coral collar, bronze bells, iron sword, decorated shield | Defensive heavy: stronger near walls, moats or the palace, and steadies nearby soldiers |

**Starting numbers** (compare: Horseman 140 hp, 15 attack, speed 3.2; Swordsman 125, 14, 2.0)

| Unit | HP | Attack | Speed | Cost |
| --- | --- | --- | --- | --- |
| Lifidi Horseman | 200 | 18 | 2.7 | 1 horse, 2 weapons, 4 cloth, 70 money |
| Ẹ̀ṣọ́ Rider | 120 | 14 | 3.9 | 1 horse, 1 weapons, 45 money |
| Abam Warrior | 220 | 22 | 1.9 | 2 weapons, 20 food, 50 money |
| Leopard Guard | 170 | 16 | 2.1 | 2 weapons, 4 iron, 55 money |

These are first guesses; tune them with the headless test run.

**Rules**

- Only your own culture's elite can be trained.
- Allied or conquered states of another culture let you hire their elite for a daily wage. Uniting a Hausa state gives you Lifidi Horsemen, so diverse alliances pay.
- Optional, to test: horses slowly lose health in forest (the tsetse fly). This is why northern cavalry never conquered the forest belt, and it keeps north and south different.

## Hidden consequences: the slave trade

The slave-trade choice is the game's signature: selling captives pays fast and buys guns early, and later those same people come back as soldiers against you. The player sees only the immediate effect when choosing.

**When it comes:** early, in the Compound or Town era, while guns still matter. It must not wait until the player already holds many states, or saying no costs nothing.

**How it arrives in each culture:** Lagos and Edo through the ships (Edo first, as Benin met the Portuguese earliest); Kano through buyers travelling with the desert caravans; Anambra through the Aro and their oracle. Each version offers the same three options and sets the same flags.

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

Players city-build only their home state; every other state is a province on a Nigeria map, won by alliance, tribute or war. Building 36 full city maps would take years, so this two-layer design keeps scope realistic.

**Data** (`js/campaign/states.js`, new): for each state, its id, name, neighbours, historical holder (for example Kano: the Sarki of Kano; Oyo: the Alaafin of Ọ̀yọ́), culture pack if one exists, strength 1–5, daily yield, and land type (coast, forest, savanna, delta). The tile positions already exist in `STATES` in `js/regions/index.js`.

**Province status:** independent, allied, paying tribute, conquered, or British.

**Rules**

1. The map opens in the Town era. Before that, the game is the home state alone, as today.
2. You can only act on a state next to one you hold or are allied with.
3. Diplomacy reuses today's options: gifts, trade agreement, greet as kin, demand submission.
4. War: send an army from home. It takes a few days per state crossed. The first version settles battles automatically from `armyPower`, with some chance, and applies the losses. A later version can offer "fight it yourself" on a battle map generated from that state's terrain.
5. Provinces pay a daily yield, send recruits, and let you hire their culture's elite unit.
6. A conquered province needs a garrison, or unrest grows until it rebels.
7. Era requirements count states instead of kingdoms. Starting values to tune: Town 1, Port City 4, Metropolis 10.

**The British advance:** from the Port City era, every few days the British take one independent state on the coast, a river or next to their holdings. Weak states sign treaties, as the Royal Niger Company did; strong ones are conquered. Your allies resist and can call on you. Your own states are never taken without a battle.

**Winning:** hold or ally every state, reach the Metropolis era, and build the House of Assembly. Then proclaim the New Nigeria, using the existing `proclaim` logic extended to the whole map.

**Save shape:** a new `st.campaign` object holding each state's owner, status, loyalty and garrison, plus armies on the move. Old saves load with a campaign built from their current kingdoms.

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
- It shows home state and culture, a small Nigeria map coloured by who holds what, cities, population, wealth, era, in-game year, days played, badges, and the slave-trade path taken ("Freed 34 captives").
- Landscape 16:9 by default, plus a 9:16 version for TikTok and WhatsApp Status.
- Shared through the phone's share sheet (WhatsApp, X, TikTok, Instagram), with a download fallback.
- Studio mark and game link on every card, so each share advertises the game.

**2. Accounts and cloud saves (studio server)**

- A campaign played for weeks cannot live only in browser storage; clearing the browser would lose it all.
- Sign in with an email link or Google. The save uploads every few minutes and on exit; if two devices disagree, warn before overwriting.
- UK GDPR applies: a privacy policy and a delete-my-account button. Children will play, so follow the ICO Children's Code: private by default, no real names shown, no location.

**3. Leaderboards**

- Boards by home state ("Top Kano empires"), overall, and a weekly fixed-seed challenge.
- Measures: states held, population, wealth, era reached, and fewest days to unite Nigeria.
- Players pick a display name, filtered for slurs, including ethnic slurs, with a report button.
- Rivalry is between states, never peoples: "Kano vs Lagos", not one ethnic group against another.

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

- **Many peoples, not four.** Nigeria has over 250 ethnic groups. The home-state picker says more peoples are coming. States without a pack keep their own historical rulers on the map (Nupe, Jukun, Tiv, Ijaw, Kanuri, Efik, Igala, Urhobo and others), never relabelled as another culture.
- **Enemies are historical kingdoms and foreign powers,** never today's ethnic groups. There is always a way to unite through alliance or trade.
- **Faith is never a faction.** Islam, Christianity and traditional religions are never defeated, rewarded or punished. Usman dan Fodio's movement appears as a historical political force the player can ally with, resist or negotiate with.
- **The slave trade carries weight.** Captives are people, named in event text. A sale gets no cheerful sound, celebration or reward animation.
- **No civil war.** Leave 1967–70 out of the game.
- **No gore,** in line with the studio's visual rules.
- **Native-speaker review.** Speakers check names, titles, greetings and tone marks. Someone from each culture reviews clothing and stories before release, and is credited.
- **Careful dates.** Where historians disagree, use "around": "around 1515".
- **Keep the "what if" visible.** The chronicle shows where the player's history left the real one.

## Build order

Nine milestones, each one or a few coding sessions, in this order. Character art runs alongside: until a culture's models are baked, the code uses the existing models with a colour tint, so art never blocks code.

1. **Foundations.** Add this brief to the project as `DESIGN.md`. Split `lagos.js` into terrain, factions, events, story and objectives files. Add a save version and migration. Rename the game to **Naija Rising — Build your Nigeria** on the title screen, page title and share tags, but keep the internal `eko-rising` ids and storage keys so saves and feedback history carry over. If the web address changes, keep the old one redirecting. Add a headless test that plays 200 game days on a fixed seed for each start and fails on any error.
   - Done when: the game plays exactly as before, old saves load, and the test passes.
2. **Culture packs and the Kano start.** Create `js/cultures/` with a Yoruba pack (moved from today's data) and a Hausa pack. Move the guided opening into a shared file that takes its words from the pack. Add `kano.js` with savanna terrain, the Katsina and Zazzau kingdoms, the Kwararafa host, hyena packs and the Durbar. Make Lagos and Kano tappable on the title screen's map.
   - Done when: a Kano game runs the guided opening with Hausa names and words, and the Kwararafa host can be beaten.
3. **Elite units.** Add the four elite units, the rule that only your own culture trains its elite, and hiring them from allied states.
   - Done when: each start trains its elite in the Town era, and the test shows no unit winning every fight.
4. **Anambra and Edo starts.** Add Igbo and Edo packs, their region files, story beats and festivals.
   - Done when: all four home states are playable from the title screen.
5. **The slave-trade branch.** Add the sell option and its hidden consequences in all four cultural versions.
   - Done when: in a test run, selling produces sold-captive riflemen in a later landing with the reveal card, and freeing produces settlers over the cap.
6. **Live events and the empire card.** Add `live.js` with the hyena season as the first event, the title-screen banner, badges, and the shareable card in both sizes.
   - Done when: setting the device date into an event week triggers it, and the card shares on a phone.
7. **The Nigeria map.** Add state data, province status, diplomacy, automatic battles, yields, garrisons and era requirements counted in states. Fold the Ogun chapter into the Ogun province.
   - Done when: a player can win a neighbouring state by treaty and another by war, and both pay yields.
8. **The British advance and the liberation war.** Add British expansion across independent states, the fight to take them back, and winning across the whole map.
   - Done when: a full test campaign can end in the New Nigeria.
9. **Accounts, cloud saves and leaderboards** on the studio server, with the privacy work from the Bragging section.
   - Done when: a save made on one device continues on another, and impossible scores are rejected.

## Open decisions

These need Kay's answer before the milestone that depends on them.

- [ ] **Freed captives' reward** (milestone 5): this brief replaces "they eat a third of the food" with loyalty, combat and settler-cap rewards. Confirm, or bring the food rule back.
- [x] **The Ogun chapter** (milestone 7): fold it into the Ogun province, or keep its map as a second city for Lagos players? **Decided Oct 19, 2026: keep its map.** Lagos players build Ogun from scratch, carrying what they learned in Lagos (its buildings, crafts and ages, which come quicker the second time), and Ogun has its own story and enemies: Ọ̀yọ́ horsemen, Ìjẹ̀bú gunmen and the host of Dahomey.
- [ ] **How many states before the British advance** (milestone 7): the brief starts it at the Port City era with era goals of 1, 4 and 10 states. The original idea was 10 to 15 states first.
- [ ] **Where players play** (milestones 6 and 9): the studio website, which can host feedback, accounts and leaderboards, or the claude.ai link, which cannot reach the studio server's `/api/game-feedback`.
- [ ] **Studio server** (milestone 9): hosting, cost, and who moderates display names.
- [ ] **Reviewers:** who checks the Hausa, Igbo and Edo names, clothing and stories.

## Later updates

These continue the campaign after the first release and are not part of the current build.

- **Crude oil.** Oil is found in the Delta provinces, as at Oloibiri in 1956. It brings huge income, plus pollution and unrest in the provinces that produce it.
- **Corruption.** As wealth grows, officials skim taxes and tribute. Courts, the Assembly, schools and a free press reduce it. Left unchecked, it feeds unrest and attacks.
- **More culture packs:** Kanuri (Borno), Ijaw (Bayelsa, Rivers), Tiv (Benue), Nupe (Niger), Efik and Ibibio (Cross River, Akwa Ibom), Urhobo and Itsekiri (Delta), Igala (Kogi), Jukun (Taraba).
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
