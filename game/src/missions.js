// The story of Palmera Heat: six missions for Rafi Solano, told through short dialog
// lines and a chain of objectives. Lina (his sister, a mechanic), Bruno (a chop-shop
// owner) and Marisol Vega (a fixer) are all original characters. The manager walks
// the current mission's steps; main.js resolves each step type against the world.
import { CAR_KINDS } from './vehicles.js';

export function buildMissions(places) {
  const P = places;
  return [
    {
      title: 'First Wheels', reward: 200, start: P.safehouse, startLabel: "Rafi's Garage",
      intro: [
        ['Lina', 'Rafi, the Serpientes gave you a week. Start by bringing me a coupe I can sell.'],
        ['Rafi', 'One coupe, coming up. Nobody even has to know.'],
      ],
      steps: [
        { type: 'goto', x: P.workshop.x, y: P.workshop.y, text: "Meet Lina at her workshop", r: 60 },
        { type: 'stealcar', kind: 'Coupe', near: P.workshop, text: 'Steal the turquoise Coupe near the workshop', r: 70 },
        { type: 'delivercar', x: P.safehouse.x, y: P.safehouse.y, text: "Deliver the Coupe to Rafi's Garage", r: 64 },
      ],
      outro: [['Lina', 'Clean work. That buys us a day. Bruno at the Mercado needs a runner.']],
    },
    {
      title: 'Market Run', reward: 300, start: P.market, startLabel: 'Mercado Serena',
      intro: [
        ['Bruno', 'A package waits at the Mercado. Take it to Marisol at the marina. Fast.'],
        ['Rafi', 'Fast is the one thing I sell.'],
      ],
      steps: [
        { type: 'pickup', x: P.market.x, y: P.market.y + 46, text: 'Pick up the package at Mercado Serena (on foot)', r: 42 },
        { type: 'goto', x: P.marina.x, y: P.marina.y, text: 'Take the package to Marisol at Marina Serena', r: 70 },
        { type: 'escape', text: 'Lose the police heat, then the job is done', r: 0 },
      ],
      outro: [['Marisol', 'You drive like the bay is yours. I may have real work for you.']],
    },
    {
      title: 'Night Ledger', reward: 450, start: P.tower, startLabel: 'Palmera Crown Tower',
      intro: [
        ['Marisol', 'My accountant waits at the Crown Tower. The police would love to meet him. Do not let them.'],
      ],
      steps: [
        { type: 'pickupPassenger', x: P.tower.x, y: P.tower.y + 46, text: 'Pick up the accountant at the Crown Tower (in a car)', r: 62 },
        { type: 'goto', x: P.safehouse.x, y: P.safehouse.y, text: "Drop the accountant at Rafi's Garage", r: 64 },
        { type: 'escape', text: 'Shake the police before you come home', r: 0 },
      ],
      outro: [['Lina', 'He paid in cash and secrets. Both spend well here.']],
    },
    {
      title: 'Harbor Static', reward: 600, start: P.marina, startLabel: 'Marina Serena',
      intro: [
        ['Marisol', 'Rival lookouts hold my pier. Clear them out and take the blue briefcase.'],
        ['Rafi', 'On foot, quiet as I can. Loud as I must.'],
      ],
      steps: [
        { type: 'shootout', x: P.marina.x, y: P.marina.y, count: 4, text: 'Clear the 4 lookouts at Marina Serena', r: 300 },
        { type: 'pickup', x: P.marina.x + 90, y: P.marina.y + 30, text: 'Grab the blue briefcase on the pier', r: 40 },
        { type: 'escape', text: 'Get clear of the police', r: 0 },
      ],
      outro: [['Marisol', 'The pier is mine again. One more job, and your debt is ash.']],
    },
    {
      title: 'Checkpoint Run', reward: 550, start: P.chopshop, startLabel: "Bruno's Chop Shop",
      intro: [
        ['Bruno', 'Prove the bay wrong: hit every checkpoint before the clock eats you. Any car. Your car.'],
      ],
      steps: [
        { type: 'checkpoints', points: 'city', eachSeconds: 26, text: 'Hit each checkpoint before time runs out', r: 58 },
      ],
      outro: [['Bruno', 'Fastest hands in Vista Palmera. The Serpientes should fear you, not bill you.']],
    },
    {
      title: 'Serena Goodbye', reward: 1200, start: P.impound, startLabel: 'Police Impound',
      intro: [
        ['Marisol', 'Final job. The impound holds an armored SUV with everything I need. Take it to my boat.'],
        ['Rafi', 'Steal from the police, drive to a boat. A normal Tuesday in Vista Palmera.'],
      ],
      steps: [
        { type: 'stealcar', kind: 'SUV', near: P.impound, text: 'Steal the armored SUV from the Police Impound', r: 80 },
        { type: 'delivercar', x: P.marina.x, y: P.marina.y, text: "Deliver the SUV to Marisol's boat at the marina", r: 74 },
        { type: 'escape', text: 'Lose the police — then you are free', r: 0 },
      ],
      outro: [
        ['Marisol', 'Debt paid, Rafi. The bay is yours now.'],
        ['Rafi', 'Vista Palmera, I am keeping you.'],
      ],
    },
  ];
}

export const SUV_KIND = { name: 'Armored SUV', color: '#546e7a', top: 320, accel: 250, grip: 4.6, value: 600 };
export { CAR_KINDS };

export function createMissionManager(places) {
  const missions = buildMissions(places);
  return {
    list: missions,
    index: 0,
    phase: 'offer', // offer -> active -> done (story complete)
    stepIndex: 0,
    storyDone: false,
    dialog: [],
    checkpointIndex: 0,
    checkpointTimer: 0,
    hostilesLeft: 0,
    get current() { return this.list[this.index] || null; },
    get step() { return this.current ? this.current.steps[this.stepIndex] : null; },
    objectiveText() {
      if (this.storyDone) return 'Free roam: deliver stolen cars to the Chop Shop, find cash stashes, enjoy Vista Palmera.';
      if (!this.current) return '';
      if (this.phase === 'offer') return `Go to ${this.current.startLabel} to start "${this.current.title}"`;
      const s = this.step;
      return s ? s.text : '';
    },
    target() {
      if (this.storyDone || !this.current) return null;
      if (this.phase === 'offer') return { x: this.current.start.x, y: this.current.start.y };
      const s = this.step;
      if (!s) return null;
      if (s.type === 'checkpoints') return s.pointsList ? s.pointsList[this.checkpointIndex] : null;
      if (s.type === 'escape') return null;
      if (s.type === 'stealcar') return s.carRef ? { x: s.carRef.x, y: s.carRef.y } : (s.near ? { x: s.near.x, y: s.near.y } : null);
      return { x: s.x, y: s.y };
    },
  };
}
