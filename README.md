# Eko Rising

Build Lagos from scratch. Start as a farmer and his wife by the lagoon, grow a
yam farm into a compound, a town, a port city and a modern metropolis, and decide
how the history of Nigeria goes: trade with the Portuguese or send them away,
stand up to Benin and the British, and unite the peoples of the land into
**The New Nigeria**.

An original game by [alternatefact Studios](https://alternatefactstudios.com/).
Play it at **https://alternatefactstudios.com/games/eko-rising/**.

## How it plays

Strangers arrive when your people are fed and happy. They wait at the campfire
(or the town square once there is a palace) until you build them a home, then
move in and work wherever they are needed: woodcutters, yam and cassava farmers,
garri makers, hunters, fishermen, palm oil pressers, miners and smiths.

The settlement grows through five ages: farmstead, compound, town, port city and
metropolis. Moving up an age needs people, money and a number of neighbouring
kingdoms conquered or paying tribute. Money comes from taxes, the market, trade
agreements with other kingdoms and merchant ships at the port, and pays for
buildings, upgrades, trained soldiers and hired fighters.

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

The game draws in 3D with three.js (bundled in `js/vendor/`), seen from an
isometric corner view in the style of the classic castle builders. There are
three looks, chosen from the in-game menu: **Realistic 3D** (the default, with
life-like textures and leaf-card trees), **Cartoon 3D**, and **Classic 2D**,
which is also used where WebGL is not available.

## Code

```
index.html    the page; css/game.css styles it
js/main.js    boots the game, the loop, saving and the renderer
js/sim/       the simulation, with no DOM: economy, citizens, military, factions, trade, events
js/world/     terrain types, map generator, A* pathfinding
js/data/      buildings, units, resources, ages, names, the art catalogue
js/regions/   one file per state; lagos.js is chapter one
js/render3d/  3D view: ground.js land and water, flora.js trees and grass,
              models.js buildings, palisades, mud walls and lookouts, people.js people and soldiers,
              effects.js fire and smoke
js/render/    2D canvas renderer, hand-drawn sprites, minimap
js/ui/        HUD, panels, story pop-ups, mouse/touch/keyboard input, settings
art/          story art, portraits, age pictures; art/ground and art/tex hold the
              cartoon textures, art/real the life-like ones
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

The tests run the simulation headless, including a scripted player that plays
through the ages. They need Node 20 or newer and nothing else:

```bash
npm test
```

They also run on every push.

## Publishing on the studio site

The live game is a copy of this folder at
`frontend/public/games/eko-rising/` in the `Alternatefact-site` repository.
To release a new version, copy everything except `tests/`, `package.json`,
`README.md` and `.github/` into that folder and deploy the site.

## Ownership

© 2026 alternatefact Studios. All rights reserved. Eko Rising, its story, art
and code are the property of alternatefact Studios.

three.js is © its authors and used under the MIT License; see
`js/vendor/three.LICENSE`.
