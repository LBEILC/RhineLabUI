import { createRollingNumber } from "@kitlangton/rolling-number";

export function createRollingClock(element: HTMLElement) {
  element.replaceChildren();
  element.setAttribute("role", "timer");
  const numbers = [0, 1, 2].map((index) => {
    if (index) element.append(":" );
    const part = document.createElement("span");
    part.setAttribute("aria-hidden", "true");
    element.append(part);
    return createRollingNumber(part, { value: 0, duration: 460, motionBlur: true,
      locales: "en-GB", format: { minimumIntegerDigits: 2, useGrouping: false }, animated: false });
  });
  let initialized = false;
  return (date: Date, animated: boolean) => {
    const values = [date.getHours(), date.getMinutes(), date.getSeconds()];
    element.setAttribute("aria-label", values.map(n => String(n).padStart(2, "0")).join(":"));
    numbers.forEach((controller, index) => {
      controller.update({ value: values[index], animated: animated && initialized, direction: "up" });
      if (!animated) controller.finish();
    });
    initialized = true;
  };
}
