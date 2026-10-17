# Eko Rising

Build Lagos from scratch. Start as a farmer and his wife by the lagoon, grow a
yam farm into a compound, a town, a port city and a modern metropolis, and decide
how the history of Nigeria goes: trade with the Portuguese or send them away,
stand up to Benin and the British, and unite the peoples of the land into
**The New Nigeria**.

An original game by [alternatefact Studios](https://alternatefactstudios.com/).
Play it at **https://alternatefactstudios.com/games/eko-rising/**.

## How it plays

The game opens with a guided story that goes at the player's pace: a guide at
the top left says who is speaking, what they say, and the one thing to do
next, points at it on the map or in the build bar, and waits until it is done.

Àdìó and Àdùkẹ́ walk up a forest path to an abandoned house in a clearing:
“Let's settle in this abandoned house. Let's build a community here.” The
forest around it is a wall: nobody walks through standing trees, so footpaths
lead out to the other peoples, and clearing trees opens new ground and new
ways through. You tap Àdìó, then a tree; he fells it, cuts it into planks
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
and taps add or remove soldiers.

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
one, to keep it safe or carry on elsewhere.

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
              events, story.js (the guided opening, step by step)
js/world/     terrain types, map generator, A* pathfinding
js/data/      buildings, units, resources, ages, names, the art catalogue
js/regions/   one file per state; lagos.js is chapter one
js/render/    the isometric view: iso.js draws the world, atlas.js the sprite sheets,
              ground.js the land, minimap.js the overview map
js/render3d/  the 3D models the sprites are baked from: models.js buildings, fences and
              walls, flora.js trees, stocks.js goods on the floors, people.js animals and
              loads, characters.js the rigged characters (listed in js/data/people.js)
tools/bake/   the sprite baker
js/ui/        HUD, panels, story pop-ups, mouse/touch/keyboard input, settings
art/          story art, portraits, age pictures; art/iso the baked sprite sheets;
              art/real the life-like textures (ground textures are used by the game,
              the rest by the baker); art/people the 3D characters and their shared
              animations (*.glb), used by the baker
brand/        studio logo and favicon
tests/        headless simulation tests and a scripted player
```

The art in `art/` was made with Higgsfield and is listed in `js/data/art.js`;
anything missing from that list falls back to emoji art or textures drawn in
code.

To open another state, copy `js/regions/lagos.js` (terrain template, peoples,
places to explore, events, goals), register it in `js/regions/index.js`, and
give its entry in `STATES` a region id.

## Tests

The tests run the simulation headless, including the whole guided opening
played step by step (`tests/story.mjs`) and a scripted player that plays
through the ages (`tests/bot.mjs`). They need Node 20 or newer and nothing else:

```bash
npm test
```

They also run on every push.

## Publishing on the studio site

The live game is a copy of this folder at
`frontend/public/games/eko-rising/` in the `Alternatefact-site` repository.
To release a new version, copy everything except `tests/`, `tools/`,
`package.json`, `README.md`, `.github/` and what only the baker needs
(`js/render3d/`, `js/vendor/`, `art/people/`, `art/tex/`, `art/ground/`,
`art/real/tex/`) into that folder and deploy the site.

## Ownership

© 2026 alternatefact Studios. All rights reserved. Eko Rising, its story, art
and code are the property of alternatefact Studios.

three.js (used by the sprite baker) is © its authors and used under the MIT
License; see `js/vendor/three.LICENSE`.
