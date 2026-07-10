import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChromeMock, resetChromeMock } from "../../mocks/chrome";

vi.mock("../../../src/native/port-manager", () => ({
  initNativeMessaging: vi.fn(),
  postToNativeHost: vi.fn(),
}));

async function loadHandleMessage() {
  vi.resetModules();
  (globalThis as any).chrome = createChromeMock();
  const mod = await import("../../../src/service-worker/index");
  return mod.handleMessage;
}

describe("tab handlers", () => {
  beforeEach(() => {
    resetChromeMock();
  });

  it("registers the active tab when tabId is omitted", async () => {
    const handleMessage = await loadHandleMessage();
    const chrome = (globalThis as any).chrome;
    chrome.tabs.query.mockResolvedValue([
      { id: 123, url: "https://example.com/", active: true, windowId: 1 },
    ]);

    const result = await handleMessage({ type: "TABS_REGISTER", name: "work" }, {});

    expect(chrome.tabs.query).toHaveBeenCalledWith({ active: true, lastFocusedWindow: true });
    expect(result).toEqual({ success: true, name: "work", tabId: 123 });
  });

  it("rejects registration when the active tab is chrome:// or extension URL", async () => {
    const handleMessage = await loadHandleMessage();
    const chrome = (globalThis as any).chrome;
    chrome.tabs.query.mockResolvedValue([
      { id: 999, url: "chrome://settings/", active: true, windowId: 1 },
    ]);

    await expect(handleMessage({ type: "TABS_REGISTER", name: "settings" }, {})).rejects.toThrow(
      /chrome:\/\/ or extension tab/,
    );
  });

  it("moves tabs to the destination window", async () => {
    const handleMessage = await loadHandleMessage();
    const chrome = (globalThis as any).chrome;
    chrome.tabs.move.mockResolvedValue([{ id: 123, windowId: 456, index: 0 }]);

    const result = await handleMessage(
      { type: "TAB_MOVE", tabIds: "123,124", windowId: "456", index: "0" },
      {},
    );

    expect(chrome.tabs.move).toHaveBeenCalledWith([123, 124], { windowId: 456, index: 0 });
    expect(result).toMatchObject({
      success: true,
      moved: [123, 124],
      destinationWindowId: 456,
      index: 0,
    });
  });
});
