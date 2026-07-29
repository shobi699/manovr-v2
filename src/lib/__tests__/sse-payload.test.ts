import { describe, it, expect, afterEach } from "vitest";
import { sseEmitter, emitEntityChanged } from "@/lib/events";

afterEach(() => {
  sseEmitter.removeAllListeners("message");
});

describe("emitEntityChanged", () => {
  it("emits a message event with channel entity_changed", () => {
    const received: any[] = [];
    sseEmitter.on("message", (e) => received.push(e));

    emitEntityChanged("manovr", { id: 7, action: "CREATE" });

    expect(received).toHaveLength(1);
    expect(received[0].channel).toBe("manovr_changed");
  });

  it("emits data containing only id and action keys", () => {
    const received: any[] = [];
    sseEmitter.on("message", (e) => received.push(e));

    emitEntityChanged("train", { id: 12, action: "UPDATE" });

    expect(received).toHaveLength(1);
    const data = received[0].data;
    expect(Object.keys(data).sort()).toEqual(["action", "id"]);
  });

  it("emits only the channel signal, never audit detail", () => {
    const received: any[] = [];
    sseEmitter.on("message", (e) => received.push(e));

    emitEntityChanged("personnel", { id: 3, action: "UPDATE" });

    expect(received).toHaveLength(1);
    const serialized = JSON.stringify(received[0]);
    for (const forbidden of ["summary", "changes", "actorName", "actorId"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
