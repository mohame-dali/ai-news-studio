import { extractFactsWithOllama, generateSectionWithOllama, type ExtractedFact } from '@/services/ollamaClient';
import { DURATION_PRESETS, isSensitiveTopic } from './constants';
import type { DurationOption } from '@/types';

export const SCRIPT_SECTIONS = [
  { key: 'accroche', label: 'Accroche' }, { key: 'contexte', label: 'Contexte' },
  { key: 'faits_cles', label: 'Faits clés' }, { key: 'impact', label: 'Impact' },
  { key: 'suite', label: 'Suite' },
] as const;
export type SectionKey = typeof SCRIPT_SECTIONS[number]['key'];
export type SectionDraft = { key: SectionKey; label: string; lines: string[]; error?: string };
export type ScriptDraft = { facts: ExtractedFact[]; sections: SectionDraft[]; sensitive: boolean; duration: DurationOption };
export async function generateSectionedScript(
  source: string, title: string, duration: DurationOption,
  onProgress?: (message: string, sections?: SectionDraft[]) => void,
  previous?: ScriptDraft,
): Promise<ScriptDraft> {
  onProgress?.('Extraction des faits');
  const facts = previous?.facts || await extractFactsWithOllama(source);
  const sensitive = isSensitiveTopic(`${title} ${source}`);
  const sections: SectionDraft[] = [];
  for (const section of SCRIPT_SECTIONS) {
    const saved = previous?.sections.find(s => s.key === section.key && !s.error);
    if (saved) { sections.push(saved); continue; }
    onProgress?.(`Rédaction : ${section.label.toLowerCase()}`, [...sections]);
    try {
      const lines = await generateSectionWithOllama(section.key, section.label, facts, DURATION_PRESETS[duration].sectionsBudget[section.key], sensitive);
      sections.push({ ...section, lines });
    } catch (error) {
      sections.push({ ...section, lines: [], error: error instanceof Error ? error.message : 'Section invalide' });
    }
    onProgress?.(`Rédaction : ${section.label.toLowerCase()}`, [...sections]);
  }
  return { facts, sensitive, duration, sections };
}
export class PartialScriptError extends Error {
  constructor(public draft: ScriptDraft) {
    super('Certaines sections sont à reprendre. Les autres sont conservées.');
  }
}