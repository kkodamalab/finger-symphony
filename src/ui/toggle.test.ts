import { it, expect, vi } from "vitest";
import { ToggleSwitch } from "./toggle";
it("synchronizes the actual setting, current-state text and accessibility on activation and external changes", () => {
  let on = false;
  const attributes = new Map<string, string>();
  const button = {
    onclick: () => {
      on = !on;
    },
    classList: { add: vi.fn() },
    setAttribute: (k: string, v: string) => attributes.set(k, v),
    textContent: "",
  } as unknown as HTMLButtonElement;
  const toggle = new ToggleSwitch(button, "THEREMIN", () => on);
  expect(attributes.get("role")).toBe("switch");
  expect(attributes.get("aria-checked")).toBe("false");
  button.onclick!.call(button, {} as PointerEvent);
  expect(on).toBe(true);
  expect(attributes.get("aria-checked")).toBe("true");
  expect(button.textContent).toBe("THEREMIN ON");
  on = false;
  toggle.sync();
  expect(button.textContent).toBe("THEREMIN OFF");
  expect(attributes.get("aria-checked")).toBe("false");
});
