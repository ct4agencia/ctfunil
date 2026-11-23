export type AssistantMessage = { role: "user" | "model"; text: string };
export const MESSAGE_LIMIT = 8000;
export const MESSAGE_TOTAL_LIMIT = 30000;
export const REQUEST_BYTES_LIMIT = 50000;
export const REQUEST_MESSAGE_LIMIT = 20;

export function buildAssistantRequest(history: AssistantMessage[], text: string) {
  const messages: AssistantMessage[] = [{ role: "user", text: text.trim().slice(0, MESSAGE_LIMIT) }];
  let length = messages[0].text.length;
  const encoder = new TextEncoder();
  for (let index = history.length - 2; index >= 0 && messages.length + 2 <= REQUEST_MESSAGE_LIMIT; index -= 2) {
    const user = history[index];
    const model = history[index + 1];
    if (user.role !== "user" || model.role !== "model") break;
    const pair = [user, model].map(message => ({ ...message, text: message.text.trim().slice(0, MESSAGE_LIMIT) }));
    const additional = pair[0].text.length + pair[1].text.length;
    if (!pair.every(message => message.text) || length + additional > MESSAGE_TOTAL_LIMIT) break;
    if (encoder.encode(JSON.stringify({ messages: [...pair, ...messages] })).length > REQUEST_BYTES_LIMIT) break;
    messages.unshift(...pair);
    length += additional;
  }
  return messages;
}
