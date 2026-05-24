import { disposeEngineRuntime, runEngineJob } from "./engine-runner";
import { type EngineRunMessage, type EngineToBrokerMessage, serializeError } from "./types";

const post = (message: EngineToBrokerMessage) => {
  self.postMessage(message);
};

self.addEventListener("message", async (event: MessageEvent<EngineRunMessage | { type: "dispose-engine"; id: string }>) => {
  const message = event.data;

  try {
    if ("type" in message && message.type === "dispose-engine") {
      await disposeEngineRuntime();
      self.postMessage({ type: "disposed", id: message.id });
      setTimeout(() => self.close(), 0);
      return;
    }

    const result = await runEngineJob(message, post);
    post({ type: "result", id: message.id, result });
  } catch (error) {
    post({ type: "error", id: message.id, error: serializeError(error) });
  } finally {
    if (!("persistence" in message) || !message.persistence?.enabled) {
      await disposeEngineRuntime();
      setTimeout(() => self.close(), 0);
    }
  }
});
