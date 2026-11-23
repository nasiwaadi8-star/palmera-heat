// save.js — Palmera Heat keeps one save in localStorage: cash, story
// progress and where Rafi was standing. Corrupt or missing data just means
// a fresh start; saving never throws.

import { STORAGE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (data.v !== undefined && data.v !== 1) return null; // a future shape: start fresh
    return {
      money: Number.isFinite(data.money) ? data.money : 0,
      storyIndex: Number.isFinite(data.storyIndex) ? data.storyIndex : 0,
      errandsDone: Number.isFinite(data.errandsDone) ? data.errandsDone : 0,
      x: Number.isFinite(data.x) ? data.x : null,
      y: Number.isFinite(data.y) ? data.y : null,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, ...state }));
  } catch {
    // Private mode or a full quota: the game plays on unsaved.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
