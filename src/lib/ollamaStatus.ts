import { DEFAULT_MODEL } from "@/config/ollamaConfig";

export interface OllamaStatus {
  running: boolean;
  modelPresent: boolean;
  modelName: string;
}

export function getOllamaStatus(
  running: boolean,
  tags: { models?: Array<{ name?: string }> } | null,
  modelName = DEFAULT_MODEL,
): OllamaStatus {
  const modelPresent = Boolean(
    running && tags?.models?.some((model) => model.name === modelName),
  );
  return { running, modelPresent, modelName };
}

export function getOllamaStatusMessage(status: OllamaStatus | null): string {
  if (!status) return "Ollama : vérification du statut…";
  if (!status.running) return "Ollama : non démarré";
  if (!status.modelPresent) return `Ollama : modèle manquant (${status.modelName})`;
  return `Ollama : prêt (${status.modelName})`;
}
