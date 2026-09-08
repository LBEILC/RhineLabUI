// Original footage is 25 fps. App time zero corresponds to video time 5 s.
// Discrete editorial cuts use frame numbers; spatial motion uses continuous time.
export const progress = (t: number, a: number, b: number) =>
  Math.max(0, Math.min(1, (t - a) / (b - a)));
export const smooth = (p: number) => p * p * (3 - 2 * p);
const typed = (text: string, f: number, start: number, end: number) =>
  text.slice(
    0,
    f < start
      ? 0
      : Math.min(
          text.length,
          1 + Math.floor(((f - start) * (text.length - 1)) / (end - start)),
        ),
  );
const at = (f: number, frames: number[]) => frames.includes(f);
const accessCounts = [
  1, 1, 3, 4, 5, 6, 9, 11, 12, 14, 17, 18, 19, 20, 22, 23, 25, 26,
];

export function bootMotion(appTime: number, sessionName = "JOYCE MOORE") {
  const t = appTime + 5;
  const f = Math.floor(t * 25 + 0.00001);
  const step =
    t < 9.12
      ? "access"
      : t < 11.12
        ? "logo"
        : t < 19.48
          ? "auth"
          : t < 22.76
            ? "scan"
            : "welcome";
  let auth = "";
  if (f < 363) {
    auth = typed("ID CONFIRMED", f, 282, 295);
    if (f >= 320) auth += " : " + typed(sessionName, f, 321, 339);
  } else if (f < 421) auth = typed("REQUEST RECEIVED", f, 367, 389);
  else {
    auth = typed("START PROCESSING", f, 423, 440);
    if (f >= 449)
      auth += ".".repeat(Math.min(3, 1 + Math.floor((f - 449) / 4)));
    if (at(f, [479, 485, 486])) auth = "              SING...";
  }
  const radius = 248 + 652 * Math.exp(-Math.max(0, t - 20) * 2.8);
  const scanGlitch = at(f, [525, 526, 528, 529]);
  const welcomeIntro = [1, 0, 0.28, 0, 1, 0, 0];
  const flashIndex = f - 569;
  const exit = smooth(progress(t, 26.56, 26.92));
  return {
    t,
    f,
    step,
    auth,
    access: "ACCESS PERMISSION REQUIRED".slice(
      0,
      f < 170 ? 0 : accessCounts[Math.min(17, f - 170)],
    ),
    accessOpacity: f >= 170 && f < 227 ? (f === 226 ? 0.25 : 1) : 0,
    logoOpacity:
      t >= 9.16 && t < 19.48 ? (at(f, [461, 471, 475]) ? 0.55 : 1) : 0,
    logoLeft: 1 - Math.pow(1 - progress(t, 10.6, 11.84), 3),
    drawTop: smooth(progress(t, 9.16, 9.4)),
    drawLeft: progress(t, 9.36, 9.64),
    drawRight: progress(t, 9.58, 10.04),
    logoLetters: typed("RHINE·LAB", f, 232, 255),
    plus: progress(t, 9.88, 10),
    minus: progress(t, 10.08, 10.24),
    plusAngle: 90 * smooth(progress(t, 10.24, 10.72)),
    authOpacity: f >= 281 && f < 487 ? 1 : 0,
    brand: [11.12, 11.2, 11.28].map((start) => progress(t, start, start + 0.2)),
    brandX: 205 * Math.pow(1 - progress(t, 11.12, 11.84), 3),
    poweredLetters: typed("POWERED BY RHINE LAB", f, 279, 295).length,
    scanVisible: t >= 19.48 && t < 22.76,
    scanRadius: radius,
    ringScale: scanGlitch ? 1.94 : 1,
    ringOpacity: scanGlitch ? 0.32 : progress(t, 19.68, 19.96),
    scanTracking: 31 * (1 - progress(t, 19.48, 20.44)),
    scanFont: 22 + 14 * (1 - progress(t, 19.48, 20.44)),
    permissionOpacity:
      t < 21.84 ? progress(t, 19.48, 19.88) : at(f, [547, 550]) ? 0.05 : 0,
    ornament: t >= 21.84,
    coreRadius: at(f, [546, 547, 549, 550]) ? 42 : 5,
    welcomeVisible: t >= 22.76 && t < 26.92,
    welcomePanel:
      flashIndex >= 0 && flashIndex < 7 ? welcomeIntro[flashIndex] : 0,
    welcomeInk:
      flashIndex >= 0 && flashIndex < 7
        ? [0, 0, 0.2, 1, 0, 0, 0.25][flashIndex]
        : 1,
    companyVisible: f >= 588 && !at(f, [590, 591]),
    companyMask: at(f, [594, 595]),
    highlight: progress(t, 23.52, 24.04),
    databaseOpacity: f < 626 || at(f, [628, 629, 631, 634]) ? 0 : 1,
    welcomeLogo: f >= 588,
    welcomeScale: 1 - 0.46 * exit,
    welcomeOpacity: 1 - Math.pow(exit, 3),
    exitBlur: 8 * exit,
    exit,
    backgroundOpacity: t < 26.92 ? 1 : 0,
    white: smooth(progress(t, 26.16, 26.88)),
  };
}
