import { runEngineJob } from "./engine-runner";
import { type EngineRunMessage, type EngineToBrokerMessage, serializeError } from "./types";

const post = (message: EngineToBrokerMessage) => {
  self.postMessage(message);
};

self.addEventListener("message", async (event: MessageEvent<EngineRunMessage>) => {
  const message = event.data;

  try {
    const result = await runEngineJob(message, post);
    post({ type: "result", id: message.id, result });
  } catch (error) {
    post({ type: "error", id: message.id, error: serializeError(error) });
  } finally {
    setTimeout(() => self.close(), 0);
  }
});
