# Naija Rising — Build your Nigeria

Build your Nigeria, one home kingdom at a time. Chapter one is Èkó: build Lagos from scratch. Start as a farmer and his wife by the lagoon, grow a
yam farm into a compound, a town, a port city and a modern metropolis, and decide
how the history of Nigeria goes: trade with the Portuguese or send them away,
stand up to Benin and the British, and unite the peoples of the land into
**The New Nigeria**.

The title screen opens on a map of Nigeria's old kingdoms around 1600, drawn
from real borders: 28 kingdoms and peoples' lands, from Kanem-Bornu to the
Delta city-states, shaded by part of the land (the campaign map will colour
them by who holds each instead). The new-game form sits beside it on a wide
screen and under it on a phone. A key under the map explains the hatching
(lands without kings), PLAY and the capital dots of the home kingdoms (and
NEXT, while a home kingdom is still to come). Tap a kingdom, or its name, for
a panel with its full name, ruler, culture, today's states and the elite unit
it lets you hire, and what can be done there: **Start** in one of the five
home kingdoms, one in each part of the country but the North East and North
Central (Èkó in the south-west, Kano in the north-west, Benin and Warri in the
south-south, the Northern Igbo lands in the south-east), and "Win it in the
campaign" for the rest. Small kingdoms (Èkó, Ẹ̀gbá, Ìjẹ̀bú, Nri) have a tap
zone round their names, so they are easy to hit on a phone. Once breaking
Benin's host has opened the Ogun chapter, Ẹ̀gbá's and Ìjẹ̀bú's panels also
offer to play it. Picking a kingdom puts its people's names in the new-game
form (Àdìó, Àdùkẹ́ and Èkó; Garba, Hauwa and Dala; Osaro, Ivie and
Igodomigodo; Tosan, Omawumi and Ijala; Nwankwo, Adaeze and Umunwankwo).

An original game by alternatefact Studios. For now the game is its own
project, kept apart from the studio website.

The game was called Eko Rising until October 2026. The plan for growing it
into Naija Rising, and the order to build it in, is in [DESIGN.md](DESIGN.md):
read it before starting any work. Inside the code the game keeps its old id,
`eko-rising` (save slots, settings, feedback history and save files all use
it), so nothing a player has saved is lost.

## How it plays

The game opens with a guided story that goes at the player's pace: a guide at
the top left says who is speaking, what they say, and the one thing to do
next, points at it on the map or in the build bar, and waits until it is done.
When it asks for a building, each pick from the build bar places one; the
arrow then moves to the building site and the guide waits while it goes up,
so nobody builds five sheds thinking the first did not take.
Untick *Guided start* on the title screen (or choose *Start again without the
guide* after losing everything) to skip it: the founders arrive with a few
settlers and some food and planks, and you build whatever you think matters
first.

Àdìó and Àdùkẹ́ walk up a forest path to an abandoned house in a wide
clearing, and find it wrecked: the roof fallen in, a wall down. Its old roof
timbers lie stacked on the storage floor in front of it. The guide has you
tap Àdìó, then the house, then 🔨 Repair (the arrow points at each in
turn); he carries the timbers over and puts the roof back on, and only then
can anyone sleep there. The forest around the clearing is a wall: nobody
walks through standing trees, so footpaths lead out to the other peoples,
and clearing trees opens new ground and new ways through. Next you tap
Àdìó, then a tree; he fells it, cuts it into planks
where it lies, and carries them home four at a time to the storage floor in
front of the house, going back to the same tree until it is used up (a
rainforest tree gives 12 planks, a savanna or shade tree 8, a mangrove 6).

Two strangers come up the path and are welcomed into the house, which sleeps
five. A Wood Shed takes one of them; its woodcutter fells the trees nearest
the shed and moves outward. The wife points out antelope grazing nearby; the
other newcomer takes the Hunter's Shed, changes into hunting clothes, shoots
an antelope, carries it home on his shoulders, butchers it at the shed and
takes the meat to the stores (10 meat an antelope, 8 a bush pig). Two more
strangers sit by the fire with no work and no bed, so a Plank House goes up,
then a Yam Farm for them to work. A pack of four wolves kills the farmers; the
woodcutter and the hunter kill two each while the founder and his wife shut
themselves in. Then the clearing is fenced in, using the forest as a wall,
with a gate; newcomers start coming on their own. Bandits break through the
fence, kill and steal half the stores; a Guard House and five spearmen burn
their camp: hide tents round a fire in the far corner of the forest. Àdìó walks back down the path to the red-mud pit they passed on
the way in, a Mud Brick Shed goes up beside it, and once there are bricks
enough, the kingdom upgrade rebuilds every house and shed in mud at once.

Nothing builds itself. Whoever sits by the fire walks to the storage floor,
carries the planks over a load at a time and puts the building up stage by
stage: the ground pegged out with string, a frame of poles, the walls rising,
the roof. The founder builds too when nobody else is free, and you can tap any
worker and then a building site to have them help (they go back to their work
after). Fence stakes are dragged along as the line is marked out, so fence
builders go straight from section to section. Someone given work first changes
into its clothes, in a puff of dust, and only then walks there. The world runs
at a walking pace: one real second is 0.6 of a game second at 1×.

Each workplace takes its own hands. People with no work sit at the campfire
(up to five early on) and fill new workplaces by themselves; nobody leaves a
job on their own, so to move someone you tap them and then the workplace.
Tap a woodcutter and then a tree to choose where he cuts. Sheds and farm land
can be moved; houses and anything bigger must be pulled down (half of what it
cost comes back) and built again. Each new house brings two newcomers. Hungry
or sleeping in the open, people grumble to the founder first, and then leave.

After the opening, newcomers arrive when your people are fed and happy and
there are beds, and work wherever they are needed: woodcutters, yam and cassava
farmers, garri makers, hunters, fishermen, palm oil pressers, miners and smiths.

The settlement grows through five ages: farmstead, compound, town, port city and
metropolis. Moving up an age needs people, money and a number of neighbouring
kingdoms conquered or paying tribute. Money comes from taxes, the market, trade
agreements with other kingdoms and merchant ships at the port, and pays for
buildings, upgrades, trained soldiers and hired fighters.

Soldiers either stand their ground (fighting only what comes within reach) or
fight any close by: then they go for any enemy within a few steps and set
fire to enemy tents and huts they pass. A bandit camp is gone when its last
tent burns. On a phone, ⬚ Select at the top turns a drag into a selection box,
and taps add or remove soldiers. 🚩 *Set the gathering point* (in the army
panel or a Guard House) plants a flag on the map: newly trained soldiers walk
to it, and *Go to the flag* calls the army there.

Nothing mends by itself. A damaged building shows a 🔨 beside its health
bar; tap it (or tap one of your people, then it) and press 🔨 Repair. The
repair costs a share of what the building cost, as much as it has lost, and
needs the materials in the stores; builders carry them over and do the work
like a new building, and the hammer swings while they do.

When the stores are full, a warning stays at the top of the screen (above the
build bar on a phone) naming what has no room, how many workers are held up,
and a button to build another Storage Floor, granary or storehouse. Workers
who reach a full store do not hang about it: they go back to their workplace
with their loads and take them over as soon as there is room.

The Oba of Benin sends an envoy once the town is a compound. Swear allegiance
and pay tribute, send gifts to buy time, or refuse: after a first test from
small war bands, the view goes to the far end of the land, where the Oba's
host of fifty warriors in war dress is gathering round its war chief's tent.
They march when they are ready, on a day nobody is told (later if you sent
gifts), so there is time to build, grow and train an army, then carry the
war to their camp or wait for them behind the fence. Breaking the host wins
the Lagos stage and opens **Ogun State** on the map of Nigeria.

Ogun is the second land: inland forest and savanna along the Ogun and Yewa
rivers, the Ẹ̀gbá towns under Olúmọ Rock, the Ọ̀wu, the Ìjẹ̀bú of Ìjẹ̀bú-Òde,
the Rẹ́mọ and the Yewa, and two robber camps. There is no guide there. The
founders start again from scratch, with four families and four spearmen, in
the first age, but with what they learned in Lagos: everything Lagos could
build or train can be built and trained in Ogun from the first day, the tools,
nets and cassava come along, the calendar runs on, and every age Lagos reached
needs fewer people and half the cost the second time. The game keeps a record
of what each Lagos game has learned (it only grows), and an Ogun game started
from the map of Nigeria uses it. Setting out keeps the Lagos game in its own
save.

Ogun's history brings its own challenges, one band at a time and each sized
to the town: kidnappers from the robbers' camp; the Alaafin of Ọ̀yọ́'s ilari
demanding tribute, whose horsemen ride out of the north if you refuse, and
Lísàbí, who asks you to rise with the Ẹ̀gbá against them (around 1775); the
Ìjẹ̀bú closing the roads, and their gunmen if you force them; refugees from
Ọ̀wu; Abẹ́òkúta founded under the rock; Madam Tinúbú, a trader from Lagos,
who sends gunmen and supplies when war comes; and last the host of Dahomey,
gathering in the west with its women soldiers, the Agojie, and marching when
it is ready. Its army is all women: Agojie swordswomen in blue-and-white
striped tunics and white caps, and Agojie musketeers, the same uniform dyed
red, with long trade muskets. Breaking it wins Ogun. Each story ends with a
note on what happened in the history you know, and has its own picture.

The Agojie have their own 3D model (made with Higgsfield from a character
picture in the style of the others). The Ọ̀yọ́ horsemen and Ìjẹ̀bú gunmen have
none yet: until theirs are baked they wear the nearest existing one, washed
in their own colours.

**Kano** is the northern home kingdom, a Hausa start. Garba and Hauwa walk
across the dry plain to a wrecked mud house in a clearing of thorn trees below
Dala hill, and the same guided opening plays as in Èkó, in Hausa words: the
staple is millet (🌾, a Millet Farm), the newcomers come from Kano, Katsina,
Zazzau, Borno and the Fulani herders, a pack of spotted hyenas comes out of
the bush instead of wolves, and the ages are Gona, Gida, Gari, Birni and
Babban Birni. There is no sea: the land is savanna, with Dala hill and Goron
Dutse to quarry, the Jakara stream and the Kano river, and thorn woodland
rings the clearing nearly all the way round. Its history: Katsina's riders at
your wells, a first Sarki, Queen Amina of Zazzau offering her friendship and
her way of building walls, caravans from across the Sahara that bring horses
early (Kano's version of the ships), the Durbar, Muhammad Rumfa's Kurmi
market, and the host of Kwararafa, the Jukun army from the Benue, which
gathers in the south and marches when it is ready (gifts buy time; Zazzau's
warriors come if she is your friend). Breaking it wins Kano. Its stories have
their own pictures.

**Benin** is the Edo start. Osaro and Ivie come through the rainforest to a
wrecked red-mud house between the Ogba and Ikpoba rivers; leopards come out
of the forest instead of wolves (a mother and her grown cubs). Its peoples are
the rival town of Udo, the Esan chiefdoms, Owo, the Ika of Agbor and the river
port of Ughoton, and its history Oba Ewuare's walls, the Portuguese of the
1480s (the earliest anywhere), the bronze casters' guild, the Igue festival,
and the Igala army from Idah: Queen Mother Idia can raise warriors of her own
for that war, and the Esan come if they are your friends. Breaking it wins
Benin.

**Warri** is the Itsekiri start, in the delta: Tosan and Omawumi paddle up a
creek to an empty house among mangroves, lagoons and channels, plantain is the
staple, and crocodiles come up out of the creek. Prince Ginuwa of Benin
brings followers, there is creek trade with the Urhobo, Isoko and Ijaw, the
Portuguese come, and the canoe regatta. Then Benin claims Warri as its own,
and its war fleet is the great host (the Urhobo come if asked).

**The Northern Igbo lands** are the Igbo start, in the hills round Nsukka and
Udi: Nwankwo and Adaeze, leopards, the four market days (Eke, Orie, Afọ,
Nkwọ), the Iri Ji new-yam festival, the old furnaces of Lejja, bronzes in the
earth, the shrine of Ani, the Nsukka villages, the Udi hill towns, the Ezza of
Abakaliki and the Igala of Idah. The priests of Nri come as friends; when the
Aro war bands come with their hired fighters and trade guns, the Nri priests
can be asked to make peace, which sends a third of the host home. Breaking
the rest wins the land. Nri itself is a campaign province, not a start.

Soldiers wear their own people's dress, on the shared spearman and archer
models: Benin's warriors brass helmets and coral collars, Hausa spearmen
indigo with white turbans and hide shields, Igbo fighters red head-ties,
Itsekiri fighters white head-wraps and cutlasses; the Igala dark turbans, the
Aro red caps with matchets and trade guns. Èkó keeps its own looks. Each
look is a recolour plus headgear, collar and weapon added when the sprites
are baked (`LOOKS` in `tools/bake/bake.js`, the headgear in
`js/render3d/props.js`); a people's own 3D model can replace it later.
Townspeople still wear the Èkó models in every land for now.

Each people's names and words are a culture pack in `js/cultures/`: the
founders' and settlement's names, where newcomers come from, the age names,
the staple's name, the predator, the guided opening's words, and the local
names of buildings and soldiers. The rules are the same everywhere.

The view is a fixed isometric picture that can be turned in quarter turns
(⟲ ⟳ beside the minimap, or Q and E), so the far side of a wood, a fence or a
house can be seen; every building is baked from all four sides (those
pictures load the first time the view is turned). 🌳 (or T) makes the trees
see-through, and trees in front of whatever is selected fade by themselves.
While a fence is being built, every gap still open is marked in red on top of
everything. The guide's yellow arrow points at the tab and card to tap, then
at a good spot for the building on the map (for a fence, the next gap), and
at buttons such as Army or Train.

Games save themselves every minute (the autosave); 💾 at the top saves into
one of three slots, loads any of them, and saves a game to a file or opens
one, to keep it safe or carry on elsewhere. The ☰ menu has *Save game* and
*Load game*, and ⌂ beside the map brings the view back to the village.

Players can send feedback from the title screen (💬 Send feedback), the ☰
menu, and the end-of-game screens: a star rating and three optional answers
(what they enjoyed, what was confusing or broken, what they would like next),
and an email if they want a reply. The game adds its version, where the
player is (land, day, age, guide step), screen size, browser and the last
errors it hit, and lists them under "Also sent with it". On its own the game
sends it by email: the player's email app opens with the message written to
the studio, and the message can be copied too. If the game is ever served
next to a server that takes feedback (the studio website has one,
`/api/game-feedback`), set `<meta name="eko-feedback-url">` in `index.html`
to its address and feedback is posted there instead, falling back to email
if it cannot be reached. The game asks for feedback at most once a session,
at a natural pause (the end of the guided opening, a chapter won, or after
25 minutes), each reason only once, and not for a week after someone has
sent some.

The founder does not take a job. He walks the town like a supervisor, from one
workplace to the next, and anyone working within four tiles of him works 15%
faster. His wife keeps the household; everyone who arrives after them works,
and a newcomer who knows a trade takes that work first.

Along the way you meet the Awori, Egun, Egba, Ijebu and the Edo war camp, and
can befriend, trade with, subjugate or conquer each of them. Benin, the
Portuguese, the Atlantic trade, the French and the British arrive as your
progress brings them, and each asks for a choice. The chapter ends when every
people is united, the foreign question is settled, and The New Nigeria is
proclaimed.

## Run it

It is plain ES modules with no build step. Serve the folder with any static
server and open it in a browser:

```bash
npm start            # serves on http://localhost:8080
```

The game is drawn in 2D isometric: a fixed camera looking from the south-east,
30 degrees down, so every tile is a 64 x 32 diamond. Everything on the map is a
sprite, sorted back to front; the ground is painted from life-like textures in
chunks and drawn turned into the isometric view, with fog of war over it.

The sprites are baked from the game's 3D models (buildings in every level, in
wood and in mud, trees, goods on the storage floors, loads carried on the head,
animals) and from the life-like rigged characters made with Higgsfield: the
founder, his wife, village women, farmers, woodcutters, hunters, fishermen,
labourers, spearmen and bandits, in every movement (walking, carrying, chopping,
hoeing, drawing a bow, fighting) from five directions, the other three being
mirror images. The baker is a page in `tools/bake/`, driven by a headless
browser:

```bash
node tools/bake/run.mjs   # writes art/iso/sheet-*.webp and art/iso/sprites.json
```

It needs Playwright (with its Chromium) installed. Re-run it after changing a
model in `js/render3d/` or the list of looks in `tools/bake/bake.js`.

## Code

```
index.html    the page; css/game.css styles it
js/main.js    boots the game, the loop, saving, orders from taps and clicks
js/sim/       the simulation, with no DOM: economy, citizens, military, factions, trade,
              events, story.js (the guided opening, step by step), migrate.js (save
              versions, and the steps that bring an older save up to date)
js/world/     terrain types, map generator, A* pathfinding
js/data/      buildings, units, resources, ages, the art catalogue
js/cultures/  one culture pack per people (yoruba, hausa, edo, igbo, itsekiri): names,
              words, staple, predator, soldiers' looks; index.js applies a pack's
              labels when a game starts or loads, and lists the predators
js/campaign/  the map of the old kingdoms: provinces.js (who held each, what it is
              today, which can be played) and geometry.js (their shapes, made by
              tools/map/build.py from Natural Earth's map of Nigeria's states)
js/regions/   one file per land: lagos.js (Èkó), kano.js, benin.js, warri.js, nigbo.js
              (Northern Igbo) and ogun.js (Èkó's second chapter), each put together
              from the files in its folder (terrain, factions, events, story,
              objectives); opening.js is the guided opening every home kingdom
              shares, in the words of its culture pack; kit.js builds a land's
              opening pop-ups and its first great host; common.js the questions
              they all ask about the town
js/render/    the isometric view: iso.js draws the world, atlas.js the sprite sheets,
              ground.js the land, minimap.js the overview map
js/render3d/  the 3D models the sprites are baked from: models.js buildings, fences and
              walls, flora.js trees, stocks.js goods on the floors, people.js animals and
              loads, characters.js the rigged characters (listed in js/data/people.js)
tools/bake/   the sprite baker
tools/map/    build.py, which draws the province map (see its header to run it)
js/ui/        HUD, panels, story pop-ups, mouse/touch/keyboard input, settings,
              kingdoms.js (the title screen's map), feedback.js (the feedback form
              and when to ask for it)
art/          story art, portraits, age pictures; art/iso the baked sprite sheets;
              art/real the life-like textures (ground textures are used by the game,
              the rest by the baker); art/people the 3D characters and their shared
              animations (*.glb), used by the baker
brand/        studio logo and favicon
tests/        headless simulation tests, a scripted player, the 200-day run of every
              start (long.test.mjs) and old saves that must keep loading (fixtures/)
```

The art in `art/` was made with Higgsfield and is listed in `js/data/art.js`;
anything missing from that list falls back to emoji art or textures drawn in
code.

To add a home kingdom, copy `js/regions/benin.js` and `js/regions/benin/`
(terrain template, peoples, places to explore, events, goals, and the guided
opening in its culture's words; `openingEvents` and `greatHost` from
`kit.js` write most of the story), add its people's culture pack to
`js/cultures/` (with its soldiers' looks, baked from `LOOKS` in
`tools/bake/bake.js`), register the region in `js/regions/index.js`, point
its province's `start` at it in `js/campaign/provinces.js`, and give its
stories pictures in `REGION_STORY` in `js/data/art.js`. A chapter that is not
a home start (Ogun) is a province's `region` instead, and stays shut while it
is listed in `LOCKED` until a flag in another chapter opens it (Ogun opens
when the host of Benin is broken).

## Tests

The tests run the simulation headless, including the whole guided opening
played step by step (`tests/story.mjs`) and a scripted player that plays
through the ages (`tests/bot.mjs`). `tests/long.test.mjs` plays every start
for 200 game days on a fixed seed and fails on any error or broken state, and
`tests/save.test.mjs` opens a real save from an older version of the game,
`tests/ogun.test.mjs` plays Ogun's stories and its start from Lagos, and
`tests/kano.test.mjs` plays Kano's guided opening in Hausa words, breaks the
Kwararafa host, and checks the map of the old kingdoms, and
`tests/lands.test.mjs` does the same for Benin, Warri and the Northern Igbo
lands, and plays each from the first day to breaking its host. They
need Node 20 or newer and nothing else:

```bash
npm test
```

They also run on every push.

Every save carries a version number (`SAVE_VERSION` in `js/sim/migrate.js`).
When the shape of the game state changes, raise it, add the step that upgrades
a save from the version before, and keep an old save in `tests/fixtures/` to
prove it still loads.

## Publishing

The game is plain static files: any web host that serves this folder can run
it. Everything a player needs is here except `tests/`, `tools/`,
`package.json`, `README.md`, `.github/` and what only the baker needs
(`js/render3d/`, `js/vendor/`, `art/people/`, `art/tex/`, `art/ground/`,
`art/real/tex/`), which can be left out of a release.

For now the game is kept apart from the studio website. An older copy of it
sits in the `Alternatefact-site` repository (`frontend/public/games/eko-rising/`)
and is no longer updated from here.

## Ownership

© 2026 alternatefact Studios. All rights reserved. Naija Rising (formerly Eko
Rising), its story, art and code are the property of alternatefact Studios.

three.js (used by the sprite baker) is © its authors and used under the MIT
License; see `js/vendor/three.LICENSE`.
