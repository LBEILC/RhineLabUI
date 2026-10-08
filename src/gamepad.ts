type PressedKeys = Set<string>;

function currentPad(): Gamepad | undefined {
  try {
    const pads = navigator.getGamepads();
    for (const pad of pads)
      if (pad?.connected && pad.mapping === "standard") return pad;
  } catch {
    /* Gamepad access can be blocked by Permissions Policy. */
  }
  return undefined;
}

function keysFor(pad: Gamepad): PressedKeys {
  const keys = new Set<string>();
  const axes = pad.axes;
  const button = (index: number) => pad.buttons[index]?.pressed ?? false;
  const axis = (index: number) => axes[index] ?? 0;

  if (button(0) || button(9)) keys.add("Enter");
  if (button(1) || button(8)) keys.add("Escape");
  if (button(2)) keys.add("/");
  if (button(3)) keys.add("Home");
  if (button(4)) keys.add("Shift+Tab");
  if (button(5)) keys.add("Tab");
  if (button(12) || axis(1) < -DEADZONE) keys.add("ArrowUp");
  if (button(13) || axis(1) > DEADZONE) keys.add("ArrowDown");
  if (button(14) || axis(0) < -DEADZONE) keys.add("ArrowLeft");
  if (button(15) || axis(0) > DEADZONE) keys.add("ArrowRight");

  return keys;
}

const gamepadEvents = new WeakSet<KeyboardEvent>();
export const isGamepadEvent = (event: KeyboardEvent) =>
  gamepadEvents.has(event);

function dispatch(key: string, repeat = false): void {
  const active = document.activeElement;
  const target =
    active instanceof HTMLElement && active !== document.body
      ? active
      : document.body;
  const modal =
    active instanceof HTMLElement ? active.closest(".terminal-modal") : null;
  const moveFocus =
    key === "Tab" || key === "Shift+Tab" || (modal && key.startsWith("Arrow"));
  if (moveFocus) {
    const scope =
      modal ??
      (active instanceof HTMLElement
        ? active.closest('[role="dialog"]')
        : null) ??
      document;
    const items = [
      ...scope.querySelectorAll<HTMLElement>(
        'a[href],button,input,select,summary,[tabindex="0"]',
      ),
    ].filter(
      (el) =>
        el.tabIndex >= 0 &&
        !el.matches(':disabled,[aria-disabled="true"]') &&
        !el.closest("[inert]") &&
        el.getClientRects().length > 0,
    );
    const index = items.indexOf(active as HTMLElement);
    const backwards = ["Shift+Tab", "ArrowUp", "ArrowLeft"].includes(key);
    if (items.length)
      items[
        index < 0
          ? backwards
            ? items.length - 1
            : 0
          : (index + (backwards ? items.length - 1 : 1)) % items.length
      ].focus();
    return;
  }
  const event = new KeyboardEvent("keydown", {
    key,
    repeat,
    bubbles: true,
    cancelable: true,
  });
  gamepadEvents.add(event);
  target.dispatchEvent(event);
  // Synthetic keyboard events have no native button activation.
  if (
    key === "Enter" &&
    !event.defaultPrevented &&
    active instanceof HTMLElement &&
    active.matches(
      'button,a[href],summary,input[type="checkbox"],input[type="radio"]',
    ) &&
    !active.matches(':disabled,[aria-disabled="true"]') &&
    !active.closest("[inert]")
  )
    active.click();
}

const DEADZONE = 0.35;
const REPEAT_START = 400;
const REPEAT_RATE = 120;

const held = new Set<string>();
const firstAt = new Map<string, number>();
const lastDispatched = new Map<string, number>();

let frame = 0;
let running = false;
let waitForRelease = false;

export type InputDevice = "keyboard" | "gamepad";

let device: InputDevice = "keyboard";
const deviceListeners = new Set<(device: InputDevice) => void>();

function setDevice(next: InputDevice): void {
  if (device === next) return;
  device = next;
  for (const listener of deviceListeners) listener(next);
}

export function inputDevice(): InputDevice {
  return device;
}

export function onInputDevice(
  listener: (device: InputDevice) => void,
): () => void {
  deviceListeners.add(listener);
  listener(device);
  return () => {
    deviceListeners.delete(listener);
  };
}

function poll(): void {
  frame = requestAnimationFrame(poll);
  if (document.hidden || !document.hasFocus()) {
    waitForRelease = true;
    held.clear();
    firstAt.clear();
    lastDispatched.clear();
    return;
  }
  const pad = currentPad();
  if (!pad) {
    setDevice("keyboard");
    held.clear();
    firstAt.clear();
    lastDispatched.clear();
    running = false;
    cancelAnimationFrame(frame);
    return;
  }
  const pressed = keysFor(pad);
  if (waitForRelease) {
    waitForRelease = pressed.size > 0;
    return;
  }
  const now = performance.now();
  if (pressed.size > 0) setDevice("gamepad");

  for (const key of [...held]) {
    if (!pressed.has(key)) {
      held.delete(key);
      firstAt.delete(key);
      lastDispatched.delete(key);
    }
  }

  for (const key of pressed) {
    if (!held.has(key)) {
      held.add(key);
      firstAt.set(key, now);
      lastDispatched.set(key, now);
      dispatch(key);
    } else if (
      (key.startsWith("Arrow") || key.endsWith("Tab")) &&
      now - firstAt.get(key)! >= REPEAT_START &&
      now - lastDispatched.get(key)! >= REPEAT_RATE
    ) {
      lastDispatched.set(key, now);
      dispatch(key, true);
    }
  }
}

function start(): void {
  if (running || !currentPad()) return;
  running = true;
  poll();
}

let enabled = false;
export function enableGamepad(): void {
  if (enabled) return;
  enabled = true;
  if (typeof navigator === "undefined" || !("getGamepads" in navigator)) return;
  window.addEventListener(
    "keydown",
    (event) => {
      if (event.isTrusted) setDevice("keyboard");
    },
    {
      capture: true,
      passive: true,
    },
  );
  window.addEventListener("pointerdown", () => setDevice("keyboard"), {
    passive: true,
  });
  start();
  window.addEventListener("gamepadconnected", () => {
    start();
  });
  window.addEventListener("gamepaddisconnected", () => {
    held.clear();
    firstAt.clear();
    lastDispatched.clear();
  });
}
