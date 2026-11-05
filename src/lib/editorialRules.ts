import { seoConfig } from "@/config/seoConfig";
import type { ExtractedFact } from "@/services/ollamaClient";

export const EDITORIAL_RULES_PROMPT = `Règles éditoriales uniques pour toute génération de script :
- N'invente aucun fait, chiffre, date, citation, conséquence ou prochaine étape ; chaque proposition doit être étayée par un fait fourni.
- Accroche : première phrase factuelle de douze mots maximum, fondée sur le fait concret le plus marquant ou une question factuelle à laquelle l'article répond. Cite son identifiant de fait. Pas d'introduction générique, de promesse vide ni de sensationnalisme.
- Langage simple, compréhensible par un jeune de dix-huit ans : phrases courtes, jargon expliqué en quelques mots.
- Impact : uniquement une conséquence explicitement indiquée dans les faits ; sinon conserver le marqueur éditorial existant.
- Sujet sensible (décès, guerre, violence, mineurs) : ton sobre et neutre, aucune question d'engagement ni effet sensationnaliste.
- Une question finale invitant aux commentaires est autorisée seulement pour un sujet non sensible et ne doit pas introduire de fait.
- Respecte le budget fourni pour chaque section et le format sélectionné ; ne force pas un nombre fixe de phrases.
- Expressions interdites dans l'accroche : ${seoConfig.bannedHookPhrases.join(", ")}.`;

const normalize = (value: string) =>
  value.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function validateHookCandidate(
  candidate: { text: string; supportingFactId: string },
  facts: ExtractedFact[],
): string | null {
  const factIndex = Number(candidate.supportingFactId.replace(/^fact-/, "")) - 1;
  if (!Number.isInteger(factIndex) || factIndex < 0 || !facts[factIndex]) return "L'accroche ne cite aucun fait source valide.";
  if (candidate.text.trim().split(/\s+/).length > 12) return "L'accroche dépasse douze mots.";
  const normalized = normalize(candidate.text);
  if (seoConfig.bannedHookPhrases.some((phrase) => normalized.includes(normalize(phrase)))) {
    return "L'accroche contient une formule sensationnaliste interdite.";
  }
  const sourceTokens = new Set((normalize(facts[factIndex].fact).match(/[\p{L}\p{N}]+/gu) || []));
  const stopWords = new Set<string>(seoConfig.hookStopWords);
  const unsupportedTokens = (normalized.match(/[\p{L}\p{N}]+/gu) || [])
    .filter((token) => !stopWords.has(token) && (token.length > 2 || /^\d+$/u.test(token)))
    .filter((token) => !sourceTokens.has(token));
  if (unsupportedTokens.length) return "L'accroche contient des éléments qui ne figurent pas dans le fait cité.";
  return null;
}
