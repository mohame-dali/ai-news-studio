// Shared bounded access to the Ollama service.
// Local dev: defaults to http://127.0.0.1:11434 on the user's own machine.
// Hosted app: loopback is unreachable and refused; set OLLAMA_URL to a public
// HTTPS Ollama service. OLLAMA_URL is deployment-controlled, never user input.
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const isLoopback = (hostname: string) => /^(localhost|127\.|0\.0\.0\.0|\[::1?\])/i.test(hostname);

export function ollamaEndpoint(): URL {
  const service = new URL(process.env['OLLAMA_URL'] || DEFAULT_OLLAMA_URL);
  if (service.username || service.password) throw new Error('Adresse du service Ollama invalide');
  if (isLoopback(service.hostname)) {
    if (!import.meta.env.DEV) {
      throw new Error('Ollama local (127.0.0.1) est injoignable depuis l’application hébergée. Configurez OLLAMA_URL vers un service Ollama public en HTTPS.');
    }
  } else if (service.protocol !== 'https:' || !/^[a-z0-9.-]+$/i.test(service.hostname) || !/[a-z]/i.test(service.hostname)) {
    throw new Error('OLLAMA_URL doit être un domaine public en HTTPS');
  }
  return service;
}

export async function callOllama(path: string, init: RequestInit = {}, timeoutMs = 60000): Promise<string> {
  const service = ollamaEndpoint();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL(path, service), { ...init, redirect: 'manual', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new Error('Redirection refusée'); }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Ollama HTTP ${response.status}`); }
    if (Number(response.headers.get('content-length') || 0) > MAX_RESPONSE_BYTES) { await response.body?.cancel(); throw new Error('Réponse supérieure à 2 Mo'); }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Réponse vide');
    const decoder = new TextDecoder();
    let size = 0, text = '';
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Réponse supérieure à 2 Mo'); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { clearTimeout(timer); }
}
