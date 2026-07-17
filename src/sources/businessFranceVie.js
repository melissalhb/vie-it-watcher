// Source : mon-vie-via.businessfrance.fr (site officiel du VIE).
//
// Ce site est une application JS (SPA) : le contenu n'existe pas dans le HTML
// brut, il est chargé via des appels API internes après coup. Comme je n'ai
// pas pu inspecter ces appels en direct (environnement sandbox sans accès à
// ce domaine), ce module utilise une stratégie robuste plutôt que des
// sélecteurs CSS figés :
//
//   1. On ouvre la page de recherche avec un vrai navigateur (Playwright).
//   2. On écoute TOUTES les réponses réseau que la page déclenche.
//   3. On garde celles qui sont du JSON et qui "ressemblent" à une liste
//      d'offres (héuristique sur les noms de champs les plus courants en
//      français : intitule/titre, entreprise/societe, pays/lieu, etc).
//
// Si l'héuristique ne trouve rien du premier coup, lance le script en local
// avec DEBUG_VIE=1 : il sauvegardera toutes les réponses JSON capturées dans
// data/debug-responses.json pour qu'on puisse ajuster ensemble le mapping
// exact des champs.

import { chromium } from "playwright";
import { writeFile } from "fs/promises";

const SEARCH_URL = "https://mon-vie-via.businessfrance.fr/fr/offres/recherche";

// Mots-clés IT utilisés pour filtrer les offres une fois récupérées
// (le site catégorise normalement par "domaine", mais tant qu'on n'a pas
// confirmé le nom exact du filtre, on filtre nous-mêmes sur le texte).
const IT_KEYWORDS = [
  "informatique", "développeur", "developpeur", "dev ", "data",
  "cybersécurité", "cybersecurite", "cloud", "devops", "logiciel",
  "digital", "numérique", "numerique", "IT ", "SI ", "réseau", "reseau",
  "système", "systeme", "full stack", "fullstack", "backend", "frontend",
  "ingénieur informatique", "ingenieur informatique",
];

function looksLikeJobArray(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  const sample = value[0];
  if (typeof sample !== "object" || sample === null) return false;
  const keys = Object.keys(sample).map((k) => k.toLowerCase());
  const hasTitleField = keys.some((k) =>
    ["intitule", "titre", "title", "libelle", "poste"].includes(k)
  );
  return hasTitleField;
}

function pick(obj, candidates, fallback) {
  for (const key of Object.keys(obj)) {
    if (candidates.includes(key.toLowerCase())) return obj[key];
  }
  return fallback;
}

function extractJobsFromJson(json) {
  const found = [];

  function walk(value) {
    if (looksLikeJobArray(value)) {
      found.push(...value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  }

  walk(json);
  return found;
}

export async function fetchBusinessFranceVieOffers() {
  const debug = process.env.DEBUG_VIE === "1";
  const capturedResponses = [];
  const rawJobs = [];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("application/json")) return;
      try {
        const json = await response.json();
        if (debug) capturedResponses.push({ url: response.url(), json });
        rawJobs.push(...extractJobsFromJson(json));
      } catch {
        // réponse non-JSON valide, on ignore
      }
    });

    await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 30000 });
    // Laisse le temps aux appels API déclenchés après le rendu initial de partir
    await page.waitForTimeout(3000);
  } catch (err) {
    console.error("[businessFranceVie] Erreur navigation:", err.message);
  } finally {
    await browser.close();
  }

  if (debug) {
    await writeFile(
      "data/debug-responses.json",
      JSON.stringify(capturedResponses, null, 2),
      "utf-8"
    );
    console.log(
      `[businessFranceVie] DEBUG_VIE=1 : ${capturedResponses.length} réponses JSON sauvegardées dans data/debug-responses.json`
    );
  }

  if (rawJobs.length === 0) {
    console.warn(
      "[businessFranceVie] Aucune offre détectée. Le site a peut-être changé de structure, " +
      "ou nécessite une interaction (clic, connexion) avant de charger les offres. " +
      "Relance avec DEBUG_VIE=1 en local pour inspecter les réponses réseau."
    );
    return [];
  }

  const offers = rawJobs.map((job) => {
    const title = pick(job, ["intitule", "titre", "title", "libelle", "poste"], "Offre VIE");
    const company = pick(job, ["entreprise", "societe", "nomsociete", "raisonsociale", "company"], "Entreprise non précisée");
    const location = pick(job, ["pays", "lieu", "ville", "localisation", "country"], "Lieu non précisé");
    const id = pick(job, ["id", "reference", "idoffre", "offerid"], `${title}-${company}-${location}`);
    const relativeUrl = pick(job, ["url", "lien", "lienoffre", "urldetail"], null);

    return {
      id: `bfv-${id}`,
      title: String(title),
      company: String(company),
      location: String(location),
      url: relativeUrl
        ? new URL(relativeUrl, "https://mon-vie-via.businessfrance.fr").toString()
        : SEARCH_URL,
      source: "Business France (VIE)",
      publishedAt: pick(job, ["datepublication", "dateCreation", "date"], null),
    };
  });

  // Filtre IT sur le titre (à défaut de connaître le vrai champ "domaine")
  return offers.filter((o) =>
    IT_KEYWORDS.some((kw) => o.title.toLowerCase().includes(kw.toLowerCase()))
  );
}
