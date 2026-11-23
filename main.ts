// Palmera Heat — make.fun entrypoint.
//
// Running `node main.ts` hands the game in: it copies game/ and screenshots/
// from this repository into the output directory and writes dossier.json
// there with buildDossier from the kit's vendor library, so the dossier is
// exactly the one the scorer rebuilds from the same files.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the bounty's gate.json names: passing them all makes this program
// fail anywhere the scorer would, and only text_max_bytes shapes the bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  mkdirSync(outputDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), {
    recursive: true,
  });
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  const bytes = Buffer.byteLength(dossier);
  console.log(`Palmera Heat handed in to ${outputDir} (dossier.json: ${bytes} bytes)`);
}

handIn();
