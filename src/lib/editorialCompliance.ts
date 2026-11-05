export const EDITORIAL_PLACEHOLDER = "[À COMPLÉTER PAR LE RÉDACTEUR]";

export function getEditorialSourceFallback(section: "impact" | "suite", facts: Array<{ fact: string }>): string {
  const evidencePattern =
    section === "impact"
      ? /\b(conséquence|entra[iî]ne|provoque|cause|co[uû]te|affecte|augmente|r[eé]duit|diminue|permet|emp[eê]che|b[eé]n[eé]ficie|subit)\b/i
      : /\b(pr[eé]voit|prochaine [eé]tape|doit [eé]tudier|va [eé]tudier|enqu[eê]te|proc[eé]dure|audience|d[eé]cision attendue|sera examin[eé])\b/i;
  return facts.find((fact) => evidencePattern.test(fact.fact))?.fact || EDITORIAL_PLACEHOLDER;
}

export function containsEditorialPlaceholder(text: string | undefined): boolean {
  return Boolean(text?.includes(EDITORIAL_PLACEHOLDER));
}

export function hasEditorialPlaceholderInSegments(
  segments: Array<{ text?: string; texts?: Array<{ text?: string; displayText?: string }> }>
): boolean {
  return segments.some((segment) =>
    [segment.text, ...(segment.texts || []).flatMap((text) => [text.text, text.displayText])]
      .some(containsEditorialPlaceholder)
  );
}
