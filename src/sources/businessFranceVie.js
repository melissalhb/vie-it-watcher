// Source : mon-vie-via.businessfrance.fr (site officiel du VIE).
//
// Ce site est une application JS (SPA) : le contenu n'existe pas dans le HTML
// brut, il est chargé via un appel API interne vers
// civiweb-api-prd.azurewebsites.net/api/Offers/search. On a inspecté une
// vraie réponse (grâce à DEBUG_VIE=1) et voici les champs utiles qu'elle
// contient : missionTitle, organizationName, cityName, countryName,
// reference, id, creationDate, missionDescription, missionProfile.
//
// Si le mapping ne colle plus (le site a changé), relance avec DEBUG_VIE=1
// en local : ça sauvegarde toutes les réponses JSON dans
// data/debug-responses.json, ainsi qu'un aperçu des boutons/liens visibles
// sur la page dans data/debug-buttons.json.

import { chromium } from "playwright";
import { writeFile } from "fs/promises";

const SEARCH_URL = "https://mon-vie-via.businessfrance.fr/offres/recherche?latest=true";

// Nombre max de tentatives de "charger plus" (clic ou scroll) avant d'arrêter,
// par sécurité si jamais la pagination ne se termine jamais.
const MAX_LOAD_MORE_ATTEMPTS = 40;

// Mots-clés IT : on cible informatique / logiciel / systèmes d'information.
const IT_KEYWORDS = [
  "informatique", "logiciel", "système d'information", "systeme d'information",
  "développeur", "developpeur", "data", "cybersécurité", "cybersecurite",
  "cloud", "devops", "digital", "numérique", "numerique", " IT ", " SI ",
  "réseau", "reseau", "full stack", "fullstack", "backend", "frontend",
  "ingénieur informatique", "ingenieur informatique", "software", "sap",
  "programmeur", "programmation", "web developer", "software engineer",
];

// Une réponse "ressemble" à une liste d'offres VIE si ses éléments ont un
// champ missionTitle (nom de champ confirmé par inspection réelle de l'API).
function looksLikeJobArray(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  const sample = value[0];
  return (
    typeof sample === "object" &&
    sample !== null &&
    ("missionTitle" in sample || "reference" in sample)
  );
}

function extractJobsFromJson(json) {
  const found = [];
  function walk(value) {
    if (looksLikeJobArray(value)) {
      found.push(...value);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  }
  walk(json);
  return found;
}

async function tryLoadMore(page) {
  // Stratégie 1 : un vrai <button>/<a> dont le texte contient "plus" et "offre(s)"
  const byText = page.getByText(/plus.{0,15}offres?/i);
  if ((await byText.count()) > 0) {
    const el = byText.first();
    if (await el.isVisible().catch(() => false)) {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.click({ timeout: 3000 }).catch(() => {});
      return true;
    }
  }

  // Stratégie 2 : infinite scroll — certains sites chargent la suite
  // automatiquement quand on atteint le bas de page, sans bouton.
  const previousHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  const newHeight = await page.evaluate(() => document.body.scrollHeight);
  return newHeight > previousHeight;
}

export async function fetchBusinessFranceVieOffers() {
  const debug = process.env.DEBUG_VIE === "1";
  const capturedResponses = [];
  const jobsById = new Map();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    page.on("response", async (response) => {
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("application/json")) return;
      try {
        const json = await response.json();
        if (debug) capturedResponses.push({ url: response.url(), json });
        for (const job of extractJobsFromJson(json)) {
          jobsById.set(job.id ?? job.reference, job);
        }
      } catch {
        // réponse non-JSON valide, on ignore
      }
    });

    await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const cookieButton = page.getByRole("button", { name: /accepter|tout accepter|j'accepte/i });
    if ((await cookieButton.count()) > 0) {
      await cookieButton.first().click().catch(() => {});
      await page.waitForTimeout(500);
    }

    let attempts = 0;
    let stagnantRounds = 0;
    let lastCount = jobsById.size;
    while (attempts < MAX_LOAD_MORE_ATTEMPTS && stagnantRounds < 3) {
      const progressed = await tryLoadMore(page);
      await page.waitForTimeout(1500);
      attempts += 1;

      if (jobsById.size === lastCount && !progressed) {
        stagnantRounds += 1;
      } else {
        stagnantRounds = 0;
      }
      lastCount = jobsById.size;
    }
    console.log(
      `[businessFranceVie] ${attempts} tentative(s) de chargement, ${jobsById.size} offre(s) collectée(s).`
    );

    if (debug) {
      const clickableTexts = await page
        .locator("button, a, [role=button]")
        .allTextContents()
        .catch(() => []);
      await writeFile(
        "data/debug-buttons.json",
        JSON.stringify(clickableTexts.filter((t) => t.trim()), null, 2),
        "utf-8"
      );
    }
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
      `[businessFranceVie] DEBUG_VIE=1 : ${capturedResponses.length} réponses JSON sauvegardées dans data/debug-responses.json ` +
      `et les textes de boutons dans data/debug-buttons.json`
    );
  }

  const rawJobs = Array.from(jobsById.values());
  if (rawJobs.length === 0) {
    console.warn(
      "[businessFranceVie] Aucune offre détectée. Relance avec DEBUG_VIE=1 en local pour inspecter les réponses réseau."
    );
    return [];
  }

  const offers = rawJobs.map((job) => ({
    id: `bfv-${job.id ?? job.reference}`,
    title: job.missionTitle || "Offre VIE",
    company: job.organizationName || "Entreprise non précisée",
    location: [job.cityName, job.countryName].filter(Boolean).join(", ") || "Lieu non précisé",
    url: job.reference
      ? `https://mon-vie-via.businessfrance.fr/offres/details/${job.reference}`
      : SEARCH_URL,
    source: "Business France (VIE)",
    publishedAt: job.creationDate || null,
    _searchText: `${job.missionTitle || ""} ${job.missionDescription || ""} ${job.missionProfile || ""}`.toLowerCase(),
  }));

  return offers
    .filter((o) => IT_KEYWORDS.some((kw) => o._searchText.includes(kw.toLowerCase())))
    .map(({ _searchText, ...o }) => o);
}

