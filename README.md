# Palmera Heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nasiwaadi8-star/palmera-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nasiwaadi8-star/palmera-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

This repository is an entry for the make.fun "Make GTA 6" bounty
(gta6-01) — see the bounty page at https://make.fun/bounty/gta6-01.

An original open-world crime game for the make.fun "Make GTA 6" bounty,
built from scratch as plain static files — no build step, no assets,
nothing loaded over the network.

Welcome to **Vista Palmera**, a sun-soaked coastal city of pastel hotels,
palm-lined avenues and one very crooked port. You are **Rafi Solano**, a
courier who owes money to the wrong people. Run jobs for the diner, the
garage and the marina, steal what you need, dodge the Palmera PD, and climb
out of the red one payout at a time.

## Play it

Serve the `game/` folder with any static file server and open
`index.html` in desktop Chrome:

```
node serve.ts        # then open http://localhost:8080
```

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrow keys | Walk, or steer and drive |
| Shift | Sprint on foot |
| E | Enter / steal a car, get out again |
| Space / mouse click | Punch (on foot), hard brake (in a car) |
| H | Horn (in a car) |
| P / Esc | Pause |
| M | Mute |

## What's in the city

- **A living open world** — a seeded procedural city: six avenues, six
  streets, a coast boulevard, a beach and pier, a park, parking lots and
  hundreds of pastel buildings, all generated the same way every visit.
- **Traffic and pedestrians** — cars follow the road grid, keep to their
  lane, brake for each other and for you; pedestrians stroll the
  sidewalks and run from trouble.
- **Cars to steal and drive** — sedans, taxis, vans, pickups and the Vireo
  GT sports car, each with its own pace; yank a driver out and the car is
  yours, witnesses permitting.
- **Wanted level and police** — crimes seen by pedestrians or the Palmera
  PD raise your stars (up to five). Interceptors hunt you down, corner you
  if you dawdle, and give up only when you break line of sight and lie low.
  Get caught and it's a fine and a walk out of the station; get flattened
  and it's the hospital.
- **Missions and a story** — a three-job chain (a timed delivery, a car
  theft for Tito's Garage, and a pickup that turns into a full police
  escape) followed by endless courier errands between the city's named
  places, all paying cash.
- **HUD and minimap** — cash, health, wanted stars, the current objective
  with its distance, a light-beam marker in the world, and a live minimap
  with traffic, police and objective blips.
- **Saving** — cash, story progress and your position persist in
  `localStorage` between visits.
- **Sound, synthesized live** — WebAudio engine hum, two-tone sirens,
  punches, crashes, pickup chimes and a proper two-tone horn (yours with
  H, the locals' whenever you block the road). No audio files.

## How the entry works

`main.ts` at the repository root is the make.fun entrypoint: it copies
`game/` and `screenshots/` into the output directory
(`MAKEFUN_OUTPUT_DIR`, or `/output` under the grader) and writes
`dossier.json` there with `buildDossier` from `vendor/makefun-game.ts`,
byte for byte the dossier the scorer rebuilds.

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Screenshots

The four shots in `screenshots/` are real renders of this build, captured
in headless Chrome against the locally served game using the game's own
staging mode (`game/src/shots.js`, `?shot=1..4`): the title over the bay,
the first job on foot, a drive down the avenue, and a four-star chase on
the coast road. `shots.json` lists each file with its caption.

## Layout

- `game/index.html` — page shell and HUD
- `game/style.css` — page and HUD styling
- `game/src/config.js` — city size, palette, tuning
- `game/src/random.js` — seeded RNG (the city is reproducible)
- `game/src/world.js` — procedural Vista Palmera: roads, buildings, beach, collision, spawns
- `game/src/vehicles.js` — car physics, traffic brain, police brain
- `game/src/people.js` — pedestrians
- `game/src/missions.js` — the story chain and the errand board
- `game/src/render.js` — canvas renderer and minimap
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/save.js` — localStorage saving
- `game/src/shots.js` — screenshot staging scenes
- `game/src/main.js` — the game loop and the systems that tie it together
- `main.ts` — the make.fun entrypoint (hands the game in)
- `serve.ts` — a tiny static dev server for `game/`

Everything — city, names, story, art, sound — is original to this entry.
