export const ASSISTANT_STREAM_TYPE = 'application/x-ndjson';

export async function* readStreamLines(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        yield line;
        newline = buffer.indexOf('\n');
      }
      if (buffer.length > 262144) throw new Error('Resposta muito longa.');
      if (done) break;
    }
    if (buffer) yield buffer.replace(/\r$/, '');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readAssistantReply(response: Response, onText: (text: string) => void) {
  if (!response.ok || !response.headers.get('content-type')?.includes(ASSISTANT_STREAM_TYPE)) {
    const data = await response.json().catch(() => null);
    if (!response.ok || typeof data?.text !== 'string') {
      throw new Error(typeof data?.error === 'string' && data.error ? data.error : 'Não foi possível enviar. Tente novamente.');
    }
    return data.text;
  }

  let text = '';
  let errorMessage = 'A resposta foi interrompida. Tente novamente.';
  try {
    if (response.body) {
      for await (const line of readStreamLines(response.body)) {
        if (!line) continue;
        const event = JSON.parse(line) as { error?: unknown; done?: unknown; text?: unknown } | null;
        if (!event || typeof event !== 'object') break;
        if (typeof event.error === 'string' && event.error) {
          errorMessage = event.error;
          break;
        }
        if (event.done === true && text.trim()) return text.trim();
        if (typeof event.text === 'string') {
          text += event.text;
          onText(text);
        }
      }
    }
  } catch {
    // Falhas de rede e respostas cortadas ou inválidas seguem o fluxo de nova tentativa.
  }
  throw new Error(errorMessage);
}
