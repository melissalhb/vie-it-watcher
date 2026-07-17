import { readFile, writeFile } from "fs/promises";
import path from "path";

const STATE_PATH = path.resolve("data/seen.json");

// Charge la liste des IDs d'offres déjà envoyées par mail.
// Si le fichier n'existe pas encore (premier lancement), on part d'un état vide.
export async function loadSeenIds() {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    return new Set(JSON.parse(raw));
  } catch (err) {
    if (err.code === "ENOENT") return new Set();
    throw err;
  }
}

// Sauvegarde la liste mise à jour. On garde uniquement les 2000 IDs les plus
// récents pour que le fichier ne grossisse pas indéfiniment.
export async function saveSeenIds(seenSet) {
  const arr = Array.from(seenSet).slice(-2000);
  await writeFile(STATE_PATH, JSON.stringify(arr, null, 2), "utf-8");
}
