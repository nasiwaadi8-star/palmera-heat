// missions.js — Rafi's climb out of debt: a three-job story chain (a timed
// delivery, a car theft, a police escape) and, once the story is done, an
// endless board of courier errands between the city's named places. The
// manager watches the game, advances steps, runs timers and pays out.

export class MissionManager {
  constructor(game, storyIndex = 0, errandsDone = 0) {
    this.game = game;
    this.storyIndex = storyIndex;
    this.errandsDone = errandsDone;
    this.active = null; // { def, stepIndex, timeLeft }
    this.cooldown = 2.0; // breathing room before the first/next job
    this.storyCompleteAnnounced = storyIndex >= STORY_BUILDERS.length;
  }

  get busy() {
    return this.active !== null;
  }

  /** The world point the HUD marker and light beam should point at. */
  marker() {
    if (!this.active) return null;
    const step = this.active.def.steps[this.active.stepIndex];
    if (!step) return null;
    if (step.kind === 'steal' && this.game.missionCar) {
      return { x: this.game.missionCar.x, y: this.game.missionCar.y };
    }
    if (step.kind === 'escape') return null; // no marker: just run
    const loc = this.game.world.locations[step.loc];
    return loc ? { x: loc.x, y: loc.y } : null;
  }

  objectiveText() {
    if (!this.active) {
      return this.storyIndex < STORY_BUILDERS.length ? 'Waiting for the next job…' : 'Find work around Vista Palmera…';
    }
    const { def, stepIndex } = this.active;
    const step = def.steps[stepIndex];
    let text = step.text;
    if (step.kind === 'deliver-car' && this.game.player.mode !== 'car') {
      text = 'Get back in the Vireo GT, then reach the marker';
    }
    if (this.active.timeLeft !== null && this.active.timeLeft !== undefined) {
      text += ` — ${Math.max(0, Math.ceil(this.active.timeLeft))}s`;
    }
    return text;
  }

  update(dt) {
    if (!this.active) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.startNext();
      return;
    }
    const active = this.active;
    const step = active.def.steps[active.stepIndex];
    if (active.timeLeft !== null && active.timeLeft !== undefined) {
      active.timeLeft -= dt;
      if (active.timeLeft <= 0) return this.fail('Out of time.');
    }
    if (this.stepDone(step)) this.advance();
  }

  stepDone(step) {
    const g = this.game;
    const loc = g.world.locations[step.loc];
    switch (step.kind) {
      case 'goto':
      case 'pickup':
        return loc && Math.hypot(g.player.x - loc.x, g.player.y - loc.y) < (step.radius ?? 60);
      case 'deliver':
        return loc && Math.hypot(g.player.x - loc.x, g.player.y - loc.y) < (step.radius ?? 70);
      case 'steal':
        return g.missionCar && g.player.car === g.missionCar;
      case 'deliver-car':
        return loc && g.player.car === g.missionCar
          && Math.hypot(g.player.x - loc.x, g.player.y - loc.y) < 80;
      case 'escape':
        return g.wanted === 0;
      default:
        return false;
    }
  }

  advance() {
    const g = this.game;
    const active = this.active;
    const step = active.def.steps[active.stepIndex];

    if (step.kind === 'pickup') {
      g.sound.pickup();
      g.toast('Package collected. Move!');
    }
    if (step.kind === 'goto' && step.heat) {
      // The pickup was watched: the Palmera PD rolls out.
      g.setWanted(3);
      g.toast('The pickup was hot — the PPD is on you!');
      g.sound.sting(false);
    }

    active.stepIndex += 1;
    if (active.stepIndex >= active.def.steps.length) return this.complete();

    const next = active.def.steps[active.stepIndex];
    active.timeLeft = next.time ?? null;
    if (next.kind === 'steal') g.spawnMissionCar();
    g.toast(next.text);
  }

  startNext() {
    const g = this.game;
    let def;
    if (this.storyIndex < STORY_BUILDERS.length) {
      def = STORY_BUILDERS[this.storyIndex](g.world);
    } else {
      if (!this.storyCompleteAnnounced) {
        this.storyCompleteAnnounced = true;
        g.banner('STORY COMPLETE', 'Vista Palmera is yours, Rafi. Errands keep the cash coming.');
        g.sound.sting(true);
      }
      def = buildErrand(g);
    }
    this.active = { def, stepIndex: 0, timeLeft: def.steps[0].time ?? null };
    if (def.steps[0].kind === 'steal') g.spawnMissionCar();
    g.banner(def.title, def.intro);
    g.toast(def.steps[0].text);
    g.sound.blip();
  }

  complete() {
    const g = this.game;
    const { def } = this.active;
    this.active = null;
    this.cooldown = 3.5;
    if (def.story) this.storyIndex += 1;
    else this.errandsDone += 1;
    if (def.steps.some((s) => s.kind === 'steal')) g.clearMissionCar(); // Tito takes his Vireo back
    g.addMoney(def.payout);
    g.banner('JOB DONE', `${def.title} — +$${def.payout}`);
    g.sound.cash();
    g.saveProgress();
  }

  fail(reason) {
    const g = this.game;
    this.active = null;
    this.cooldown = 4;
    if (g.missionCar) g.clearMissionCar();
    g.banner('JOB FAILED', reason + ' The job will come around again.');
    g.sound.sting(false);
  }

  /** Called when the player is busted or wasted mid-job. */
  onPlayerDown() {
    if (this.active) {
      this.active = null;
      this.cooldown = 4;
      if (this.game.missionCar) this.game.clearMissionCar();
    }
  }
}

const STORY_BUILDERS = [
  (world) => ({
    story: true,
    title: 'FIRST RUN',
    intro: "Dona Rosa's special delivery has to reach the marina. Fast.",
    payout: 220,
    steps: [
      { kind: 'pickup', loc: 'diner', text: "Pick up the package at Dona Rosa's Diner" },
      { kind: 'deliver', loc: 'marina', text: 'Deliver it to the Marina del Sol pier', time: 75 },
    ],
  }),
  (world) => ({
    story: true,
    title: 'BORROWED WHEELS',
    intro: "Tito wants the yellow Vireo GT sitting at the Portside Warehouse.",
    payout: 380,
    steps: [
      { kind: 'steal', loc: 'warehouse', text: 'Steal the Vireo GT at the Portside Warehouse' },
      { kind: 'deliver-car', loc: 'garage', text: "Deliver the Vireo GT to Tito's Garage" },
    ],
  }),
  (world) => ({
    story: true,
    title: 'HEAT CHECK',
    intro: 'One last pickup at the marina. Something feels wrong about it.',
    payout: 550,
    steps: [
      { kind: 'goto', loc: 'marina', text: 'Meet the contact at the marina pier', heat: true },
      { kind: 'escape', text: 'Lose the heat — break line of sight and keep moving' },
      { kind: 'goto', loc: 'hideout', text: "Lie low at Rafi's Hideout", radius: 70 },
    ],
  }),
];

function buildErrand(g) {
  const ids = Object.keys(g.world.locations);
  const from = g.rng.pick(ids);
  let to = g.rng.pick(ids);
  if (to === from) to = ids[(ids.indexOf(from) + 2) % ids.length];
  const a = g.world.locations[from];
  const b = g.world.locations[to];
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  return {
    story: false,
    title: 'ERRAND',
    intro: `A parcel from ${a.name} needs to reach ${b.name}.`,
    payout: Math.round((70 + dist / 11) / 5) * 5, // clean fives, like real cash
    steps: [
      { kind: 'pickup', loc: from, text: `Pick up at ${a.name}` },
      { kind: 'deliver', loc: to, text: `Deliver to ${b.name}`, time: Math.round(40 + dist / 16) },
    ],
  };
}
