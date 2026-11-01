import { ArticleSourceData, SegmentType } from "@/types";
import { fr } from "./i18n";

export interface VerificationAlert {
  id: string;
  category: "chiffre" | "entite" | "date" | "citation" | "coherence";
  severity: "warning" | "info";
  segmentIndex: number;
  segmentId: string | number;
  term: string;
  explanation: string;
  suggestedAction: string;
}

export interface VerificationReport {
  alerts: VerificationAlert[];
  totalAlerts: number;
  verifiedSegmentsCount: number;
  totalSegmentsCount: number;
  disclaimer: string;
}

const FRENCH_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  zéro: 0,
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
  onze: 11,
  douze: 12,
  treize: 13,
  quatorze: 14,
  quinze: 15,
  seize: 16,
  vingt: 20,
  trente: 30,
  quarante: 40,
  cinquante: 50,
  soixante: 60,
  cent: 100,
  mille: 1000,
  million: 1000000,
  milliards: 1000000000,
};

const MONTH_NAMES = [
  "janvier",
  "février",
  "fevrier",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "aout",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
  "decembre",
];

function cleanText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function verifyScriptAgainstSource(
  segments: SegmentType[],
  sourceArticle?: ArticleSourceData
): VerificationReport {
  const alerts: VerificationAlert[] = [];
  const sourceContent = sourceArticle?.content || "";
  const sourceTitle = sourceArticle?.title || "";
  const sourceFullClean = cleanText(`${sourceTitle} ${sourceContent} ${sourceArticle?.pubdate || ""}`);

  if (!sourceContent.trim()) {
    return {
      alerts: [
        {
          id: "no-source",
          category: "coherence",
          severity: "info",
          segmentIndex: 0,
          segmentId: "all",
          term: "Article source non disponible",
          explanation: "Aucune dépêche source n'a été rattachée à ce projet. La vérification croisée automatique est inactive.",
          suggestedAction: "Rattachez une dépêche source dans l'onglet source ou vérifiez manuellement le texte.",
        },
      ],
      totalAlerts: 1,
      verifiedSegmentsCount: 0,
      totalSegmentsCount: segments.length,
      disclaimer: fr.editorial.disclaimer,
    };
  }

  let verifiedCount = 0;

  segments.forEach((seg, index) => {
    const segText = seg.text || (seg.texts && seg.texts[0]?.text) || "";
    if (!segText.trim()) return;

    let segmentHadAlert = false;

    // 1. Détection des chiffres numériques (ex: 12, 100, 3.5, 20%)
    const digitMatches = segText.match(/\b\d+([.,]\d+)?%?\b/g) || [];
    for (const rawDigit of digitMatches) {
      const cleanDigit = cleanText(rawDigit.replace(/[%.,]/g, ""));
      if (cleanDigit && !sourceFullClean.includes(cleanDigit)) {
        segmentHadAlert = true;
        alerts.push({
          id: `alert-num-${index}-${rawDigit}`,
          category: "chiffre",
          severity: "warning",
          segmentIndex: index + 1,
          segmentId: seg.id,
          term: rawDigit,
          explanation: `Le chiffre « ${rawDigit} » présent dans cette séquence n'apparaît pas dans la dépêche source.`,
          suggestedAction: "Vérifiez dans la dépêche originale si cette valeur est exacte ou provient d'une estimation.",
        });
      }
    }

    // 2. Détection des nombres écrits en lettres (ex: douze, vingt)
    const words = segText.toLowerCase().split(/[^\wà-öø-ÿ]+/);
    for (const w of words) {
      if (FRENCH_NUMBER_WORDS[w] !== undefined && w.length > 2) {
        const val = FRENCH_NUMBER_WORDS[w];
        const hasWord = sourceFullClean.includes(cleanText(w));
        const hasDigit = sourceFullClean.includes(String(val));
        if (!hasWord && !hasDigit) {
          segmentHadAlert = true;
          alerts.push({
            id: `alert-wordnum-${index}-${w}`,
            category: "chiffre",
            severity: "warning",
            segmentIndex: index + 1,
            segmentId: seg.id,
            term: w,
            explanation: `Le nombre en toutes lettres « ${w} » (${val}) ne figure pas textuellement dans la source.`,
            suggestedAction: "Validez la conformité de ce montant avec l'article d'origine.",
          });
        }
      }
    }

    // 3. Détection des dates et mois
    for (const month of MONTH_NAMES) {
      if (cleanText(segText).includes(month) && !sourceFullClean.includes(month)) {
        segmentHadAlert = true;
        alerts.push({
          id: `alert-month-${index}-${month}`,
          category: "date",
          severity: "info",
          segmentIndex: index + 1,
          segmentId: seg.id,
          term: month,
          explanation: `La mention du mois « ${month} » n'est pas corroborée dans l'article source.`,
          suggestedAction: "Assurez-vous que l'événement ou le rapport s'est bien déroulé à cette période.",
        });
      }
    }

    // Détection des années (19xx / 20xx)
    const yearMatches = segText.match(/\b(19\d\d|20\d\d)\b/g) || [];
    for (const yr of yearMatches) {
      if (!sourceFullClean.includes(yr)) {
        segmentHadAlert = true;
        alerts.push({
          id: `alert-year-${index}-${yr}`,
          category: "date",
          severity: "warning",
          segmentIndex: index + 1,
          segmentId: seg.id,
          term: yr,
          explanation: `L'année « ${yr} » n'est pas mentionnée dans la source.`,
          suggestedAction: "Confirmez la chronologie auprès de la source originale.",
        });
      }
    }

    // 4. Détection des citations entre guillemets
    const quoteMatches = segText.match(/(?:«([^»]+)»|"([^"]+)")/g) || [];
    for (const q of quoteMatches) {
      const cleanQuote = cleanText(q.replace(/[«»"]/g, "").trim());
      if (cleanQuote.length > 5 && !sourceFullClean.includes(cleanQuote)) {
        segmentHadAlert = true;
        alerts.push({
          id: `alert-quote-${index}-${cleanQuote.slice(0, 10)}`,
          category: "citation",
          severity: "warning",
          segmentIndex: index + 1,
          segmentId: seg.id,
          term: q,
          explanation: `La citation ${q} ne correspond pas exactement à une phrase de la dépêche source.`,
          suggestedAction: "En journalisme, une citation entre guillemets doit être textuellement exacte. Vérifiez la formulation d'origine.",
        });
      }
    }

    if (!segmentHadAlert) {
      verifiedCount++;
    }
  });

  return {
    alerts,
    totalAlerts: alerts.length,
    verifiedSegmentsCount: verifiedCount,
    totalSegmentsCount: segments.length,
    disclaimer: fr.editorial.disclaimer,
  };
}
