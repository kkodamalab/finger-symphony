/** An existing button remains the keyboard activation surface and owns its original action. */
export class ToggleSwitch {
  private action: ((this: GlobalEventHandlers, ev: PointerEvent) => any) | null;
  constructor(
    private button: HTMLButtonElement,
    private label: string,
    private read: () => boolean,
  ) {
    this.action = button.onclick;
    button.classList.add("toggle-switch");
    button.setAttribute("role", "switch");
    button.onclick = (e) => {
      this.action?.call(button, e);
      this.sync();
    };
    this.sync();
  }
  sync() {
    const on = this.read();
    this.button.setAttribute("aria-checked", String(on));
    this.button.textContent = this.label + " " + (on ? "ON" : "OFF");
  }
}
/** Native checkbox behavior is preserved, including labels, Space and form events. */
export function syncToggleInputs(root: ParentNode) {
  root
    .querySelectorAll<HTMLInputElement>("input[type=checkbox]")
    .forEach((input) => {
      if (!input.classList.contains("toggle-input")) {
        input.classList.add("toggle-input");
        input.setAttribute("role", "switch");
        const state = document.createElement("span");
        state.className = "toggle-state";
        state.setAttribute("aria-hidden", "true");
        input.after(state);
        const sync = () =>
          input.setAttribute("aria-checked", String(input.checked));
        input.addEventListener("input", sync);
        input.addEventListener("change", sync);
      }
      input.setAttribute("aria-checked", String(input.checked));
    });
}
export function observeToggleInputs(root: HTMLElement) {
  syncToggleInputs(root);
  const observer = new MutationObserver((records) => {
    if (
      records.some((r) =>
        [...r.addedNodes].some(
          (n) =>
            n instanceof HTMLElement && !n.classList.contains("toggle-state"),
        ),
      )
    )
      syncToggleInputs(root);
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
export function syncAudioButton(button: HTMLButtonElement) {
  const source = document.querySelector<HTMLButtonElement>("#audio");
  if (!source || source === button) return;
  button.textContent = source.textContent;
  button.disabled = source.disabled;
  button.dataset.operationState = source.dataset.operationState;
}
