// Save games in localStorage: cash, story progress, position, the car you were driving
// and which cash stashes you already found. Versioned under one key; anything unreadable
// is treated as "no save" rather than breaking the game.
import { SAVE_KEY, BEST_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(game) {
  try {
    const player = game.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash,
      missionIndex: game.missions.index,
      storyDone: game.missions.storyDone,
      x: Math.round(player.x),
      y: Math.round(player.y),
      stashes: game.stashesFound,
      totalEarned: game.stats.earned,
      carColor: player.inCar ? player.inCar.color : null,
      carKind: player.inCar ? player.inCar.kindName : null,
    }));
  } catch {
    // Private windows etc.: playing on without a save is fine.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function loadBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}

export function storeBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* ignore */ }
}
