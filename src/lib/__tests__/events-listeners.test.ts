import { describe, it, expect, afterEach } from "vitest";
import { sseEmitter } from "@/lib/events";

afterEach(() => {
  sseEmitter.removeAllListeners("message");
});

describe("sseEmitter listener hygiene", () => {
  it("allows more than Node's default ten listeners (maxListeners === 64)", () => {
    expect(sseEmitter.getMaxListeners()).toBe(64);
  });

  it("returns to a clean listener count after off()", () => {
    const before = sseEmitter.listenerCount("message");
    const handler = () => {};
    sseEmitter.on("message", handler);
    expect(sseEmitter.listenerCount("message")).toBe(before + 1);
    sseEmitter.off("message", handler);
    expect(sseEmitter.listenerCount("message")).toBe(before);
  });

  it("ensures a guarded listener that catches enqueue errors does not crash other listeners", () => {
    let secondHandlerCalled = false;

    // Simulate guarded listener (Step 2 design pattern)
    let closed = false;
    const guardedHandler = () => {
      if (closed) return;
      try {
        throw new Error("Simulated enqueue failure");
      } catch {
        closed = true;
        sseEmitter.off("message", guardedHandler);
      }
    };

    const secondHandler = () => {
      secondHandlerCalled = true;
    };

    sseEmitter.on("message", guardedHandler);
    sseEmitter.on("message", secondHandler);

    expect(() => sseEmitter.emit("message", { channel: "test", data: {} })).not.toThrow();
    expect(secondHandlerCalled).toBe(true);
    expect(sseEmitter.listenerCount("message")).toBe(1);
  });
});
