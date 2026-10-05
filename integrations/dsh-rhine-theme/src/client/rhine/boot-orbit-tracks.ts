import { track } from "./boot-tracks";

// Source frames 543–568. Angles are unwrapped: the left arc turns clockwise,
// the right arc counterclockwise. Each grows while its angular speed decays.
// Columns: frame, left x/y, right x/y, radius, left/right start, left/right sweep.
// Early short strokes are manually fitted; longer arcs are measured by
// reference/measure-scan-detail.py. Centers also settle towards y=539.5.
const sides = [
  [543, 827.5, 561, 1091, 518, 38.7, 260, 250, 0, 0],
  [544, 827.5, 561, 1091, 518, 38.7, 260, 250, 3, 3],
  [545, 827.5, 560.5, 1091, 518.5, 38.6, 265, 236, 17, 17],
  [546, 827.5, 559.5, 1091, 519.5, 38.5, 274, 190, 44, 44],
  [547, 827.6, 558.2, 1090.6, 520.8, 38.5, 296, 121, 79, 81],
  [548, 828.06, 556.76, 1090.35, 522.58, 38.38, 332.38, 50.99, 111.73, 113.42],
  [549, 827.84, 555.13, 1090.42, 524.39, 38.34, 367.27, -14.03, 141.56, 145.66],
  [550, 827.89, 553.28, 1090.2, 525.89, 38.44, 396.14, -68.97, 168.88, 172.89],
  [551, 828, 551.68, 1090.21, 527.44, 38.28, 421.62, -113.84, 191.68, 195.3],
  [552, 828.19, 550.24, 1089.94, 528.85, 38.25, 444.24, -152.25, 208.55, 215.7],
  [553, 828.42, 548.83, 1089.7, 530.24, 38.18, 462.76, -184.19, 225.92, 230.73],
  [554, 828.61, 547.64, 1089.53, 531.44, 38.12, 479.15, -212.29, 239.9, 244.63],
  [555, 828.8, 546.47, 1089.37, 532.55, 38.03, 494.23, -237.06, 251.56, 257.75],
  [
    556, 829.06, 545.41, 1089.16, 533.53, 37.91, 508.57, -259.19, 261.49,
    267.63,
  ],
  [557, 829.25, 544.49, 1088.93, 534.52, 37.87, 520.46, -279.2, 271.23, 278.42],
  [558, 829.47, 543.66, 1088.7, 535.37, 37.79, 530.39, -295.86, 280.34, 286.17],
  [559, 829.75, 542.88, 1088.46, 536.12, 37.72, 541.33, -312.5, 287.17, 295.12],
  [
    560, 829.95, 542.16, 1088.26, 536.88, 37.65, 549.47, -326.37, 295.98,
    301.16,
  ],
  [
    561, 830.16, 541.63, 1088.02, 537.41, 37.57, 557.82, -338.78, 302.29,
    307.52,
  ],
  [562, 830.33, 541.08, 1087.81, 537.94, 37.52, 565.1, -350.74, 307.99, 312.58],
  [
    563, 830.59, 540.65, 1087.61, 538.36, 37.43, 571.89, -362.08, 313.78,
    319.28,
  ],
  [
    564, 830.83, 540.28, 1087.38, 538.74, 37.37, 578.93, -371.93, 316.97,
    323.53,
  ],
  [
    565, 831.04, 539.97, 1087.14, 539.04, 37.35, 583.85, -380.51, 322.27,
    327.78,
  ],
  [
    566, 831.25, 539.74, 1086.93, 539.28, 37.27, 589.84, -388.93, 325.61,
    331.62,
  ],
  [567, 831.48, 539.56, 1086.73, 539.4, 37.19, 594, -396.5, 330.93, 335.92],
  [568, 831.61, 539.51, 1086.55, 539.48, 37.15, 599.44, -403.94, 332.25, 338.7],
] as const;
const columns = Array.from({ length: 9 }, (_, i) =>
  sides.map((row) => [row[0], row[i + 1]] as const),
);
const orbit = [
  [548, 926.33, 554.33],
  [551, 944.38, 572.15],
  [553, 954.92, 575.05],
  [555, 963, 575],
  [558, 971.63, 572.85],
  [561, 977.53, 569.78],
  [564, 981.5, 566.86],
  [568, 984.71, 563.5],
] as const;
const orbitAngle = orbit.map(
  ([f, x, y]) => [f, Math.atan2(y - 539.5, x - 959.5)] as const,
);
const orbitRadius = orbit.map(
  ([f, x, y]) => [f, Math.hypot(x - 959.5, y - 539.5)] as const,
);
const dotGrowth = [
  [-1, 0],
  [0, 0.8],
  [1, 1.7],
  [2, 2.35],
  [3, 2.85],
  [4, 3.15],
  [5, 3.45],
  [7, 3.8],
  [10, 4.1],
  [15, 4.25],
  [20, 4.25],
] as const;

export function scanOrbitTrack(frame: number) {
  const values = columns.map((keys) => track(keys, frame));
  const [lx, ly, rx, ry, radius, leftStart, rightStart, leftSweep, rightSweep] =
    values;
  const angle = track(orbitAngle, frame),
    distance = track(orbitRadius, frame);
  const sourceFrame = Math.floor(frame + 0.00001);
  // Large core flashes are editorial cuts. The small core then grows gently
  // as six satellites appear in three-frame steps, with continuing orbit phase.
  const flash = [546, 547, 549, 550].includes(sourceFrame);
  const coreRadius = flash
    ? track(
        [
          [546, 42.93],
          [550, 42.43],
        ],
        frame,
      )
    : track(
        [
          [545, 0],
          [548, 7.96],
          [551, 9.89],
          [553, 10.63],
          [555, 11.08],
          [559, 11.45],
          [564, 11.45],
          [568, 11.27],
        ],
        frame,
      );
  return {
    sides: [
      {
        x: lx,
        y: ly,
        radius,
        start: (leftStart * Math.PI) / 180,
        sweep: (leftSweep * Math.PI) / 180,
      },
      {
        x: rx,
        y: ry,
        radius,
        start: (rightStart * Math.PI) / 180,
        sweep: (rightSweep * Math.PI) / 180,
      },
    ],
    sideVisible: frame >= 544,
    coreRadius,
    satellites: Array.from({ length: 6 }, (_, i) => {
      const phase = angle + (i * Math.PI) / 3;
      return {
        x: 959.5 + Math.cos(phase) * distance,
        y: 539.5 + Math.sin(phase) * distance,
        radius: track(dotGrowth, frame - 548 - i * 3),
      };
    }),
  };
}
