import { RelayRound, SpectrumEnvelope } from "./archive-play-motion";
import type { ArchiveScene } from "./scene";
import { wallpaperHost, type WallpaperProperties } from "./wallpaper";
import { SurfaceTransition } from "./ui-transitions";
import "./archive-playground.css";

declare global { interface Window { rhineWallpaperSpectrum?: { samples: number[]; time: number }; } }
type Context = { enabled: boolean; paused: boolean; reduced: boolean };
export class ArchivePlayground {
  private props: WallpaperProperties = {};
  private envelope = new SpectrumEnvelope();
  private round = new RelayRound();
  private last = 0;
  private sampleTime = -1;
  private previousTarget = "";
  private musicGain = 1;
  private muted = false;
  private entry: HTMLButtonElement;
  private hud: HTMLElement;
  private marker: HTMLButtonElement;
  private score: HTMLElement;
  private message: HTMLElement;
  private retry: HTMLButtonElement;
  private bar: HTMLElement;
  private hudTransition: SurfaceTransition;
  private entryTransition: SurfaceTransition;
  private markerTransition: SurfaceTransition;
  private closing = false;
  private entryVisible = false;
  private markerVisible = false;
  get active() { return this.round.status !== "idle"; }
  constructor(private stage: HTMLElement, private scene: () => ArchiveScene | undefined, private context: () => Context, private mute: (value: boolean) => void, private hitSound: () => void) {
    stage.insertAdjacentHTML("beforeend", `<button class="relay-entry" hidden><span>↗</span> 波纹接力</button><section class="relay-hud" hidden aria-label="波纹接力"><div class="relay-heading"><small>RIPPLE RELAY</small><strong class="relay-score">00</strong><p class="relay-message" role="status"></p></div><div class="relay-time"><i></i></div><div class="relay-actions"><button class="relay-retry" hidden>再玩一次</button><button class="relay-exit">结束游戏</button></div></section><button class="relay-target" hidden aria-label="接住波纹"></button>`);
    this.entry = stage.querySelector(".relay-entry")!;
    this.hud = stage.querySelector(".relay-hud")!;
    this.marker = stage.querySelector(".relay-target")!;
    this.score = this.hud.querySelector(".relay-score")!;
    this.message = this.hud.querySelector(".relay-message")!;
    this.retry = this.hud.querySelector(".relay-retry")!;
    this.bar = this.hud.querySelector(".relay-time i")!;
    this.hudTransition = new SurfaceTransition(this.hud, this.hud, 300, 220);
    this.entryTransition = new SurfaceTransition(this.entry, undefined, 260, 180);
    this.markerTransition = new SurfaceTransition(this.marker, undefined, 160, 140);
    this.entry.onclick = this.retry.onclick = () => this.start();
    this.hud.querySelector<HTMLButtonElement>(".relay-exit")!.onclick = () => this.stop();
    this.marker.onclick = () => this.hit(this.round.target);
    window.addEventListener("rhine-wallpaper-properties", e => Object.assign(this.props, (e as CustomEvent<WallpaperProperties>).detail));
    Object.assign(this.props, wallpaperHost()?.properties ?? {});
    window.addEventListener("rhine-local-sound", event => {
      this.envelope.ignoreLocalSound((event as CustomEvent<{ until: number }>).detail.until);
    });
    window.addEventListener("rhine-wallpaper-pause", () => { this.last = 0; });
    document.addEventListener("visibilitychange", () => { this.last = 0; });
  }
  private bool(key: string, fallback: boolean) { const v = this.props[key]?.value; return typeof v === "boolean" ? v : fallback; }
  private start() {
    if (!this.context().enabled || !this.scene() || (this.stage.dataset.threeState && this.stage.dataset.threeState !== "on")) return;
    this.closing = false;
    this.round.start(); this.previousTarget = "";
    this.score.textContent = "00";
    this.message.textContent = "点击抬起的档案，接住下一道波纹";
    this.retry.hidden = true;
    this.bar.style.transform = "scaleX(0)";
    this.showMarker(false);
    this.scene()!.setRelayActive(true);
    this.stage.dataset.relay = "true";
    this.hud.inert = false;
    this.hud.setAttribute("aria-hidden", "false");
    this.hudTransition.show(this.context().reduced);
    this.updateEntry();
    this.syncInputIsolation();
    this.hud.querySelector<HTMLButtonElement>(".relay-exit")!.focus({ preventScroll: true });
  }
  stop() {
    if (!this.active && !this.closing) return;
    if (this.closing) return;
    this.round.stop(); this.closing = true;
    this.stage.dataset.relay = "false";
    this.hud.inert = true;
    this.hud.setAttribute("aria-hidden", "true");
    this.showMarker(false);
    this.hudTransition.hide(this.context().reduced, () => {
      this.closing = false;
      this.scene()?.setRelayActive(false);
      this.updateEntry();
      this.syncInputIsolation();
      if (this.context().enabled && !this.context().paused) {
        const target = this.entryVisible ? this.entry : this.stage.querySelector<HTMLButtonElement>(".settings-button");
        target?.focus({ preventScroll: true });
      }
    });
  }
  private updateEntry() {
    const visible = this.context().enabled && (!this.stage.dataset.threeState || this.stage.dataset.threeState === "on") && !this.active && !this.closing && this.bool("showgame", true);
    if (visible === this.entryVisible) return;
    this.entryVisible = visible;
    this.entry.inert = !visible;
    this.entry.setAttribute("aria-hidden", String(!visible));
    if (visible) this.entryTransition.show(this.context().reduced);
    else this.entryTransition.hide(this.context().reduced);
  }
  private showMarker(visible: boolean) {
    if (visible === this.markerVisible) return;
    this.markerVisible = visible;
    this.marker.inert = !visible;
    this.marker.setAttribute("aria-hidden", String(!visible));
    if (visible) this.markerTransition.show(this.context().reduced);
    else this.markerTransition.hide(this.context().reduced);
  }
  private syncInputIsolation() {
    const mode = this.stage.dataset.mode;
    const blocked = this.active || this.closing || Boolean(this.stage.querySelector("#modal-root")?.childElementCount);
    const workbench = this.stage.querySelector<HTMLElement>(".workbench");
    if (workbench) workbench.inert = blocked || !this.context().enabled;
    const archive = this.stage.querySelector<HTMLElement>("#archive-ui");
    if (archive) archive.inert = blocked || mode !== "archive" || this.stage.dataset.workbench === "true";
    const footer = this.stage.querySelector<HTMLElement>(".system-footer");
    if (footer) footer.inert = blocked || mode === "boot";
  }
  private hit(key: string | null) {
    if (this.context().paused) return;
    if (this.round.hit(key)) { this.scene()?.relayPulse(key!); this.hitSound(); }
  }
  tick(time: number) {
    const gap = time - this.last;
    const elapsed = this.last ? Math.max(0, gap) : 0;
    const dt = Math.min(.1, elapsed);
    this.last = time;
    const context = this.context(), scene = this.scene();
    if (!context.enabled && this.active) this.stop();
    const reactive = context.enabled && this.bool("audioreactive", true) && !context.reduced;
    const mute = reactive && this.bool("reactivemute", true);
    if (mute !== this.muted) { this.muted = mute; this.mute(mute); }
    const sample = window.rhineWallpaperSpectrum;
    if (sample && sample.time !== this.sampleTime) { this.sampleTime = sample.time; this.envelope.ingest(sample.samples, sample.time); }
    const bands = this.envelope.update(dt, time, reactive);
    const playing = this.round.status === "playing" || this.round.status === "preparing";
    this.musicGain += ((playing ? 0 : 1) - this.musicGain) * (1 - Math.exp(-dt * 6));
    const intensity = this.props.reactiveintensity?.value;
    const strength = typeof intensity === "number" && Number.isFinite(intensity) ? Math.max(0, Math.min(2, intensity / 100)) : 1;
    const style = this.props.selectionstyle?.value ?? "music-flat";
    const rhythm = this.props.rhythmstyle?.value;
    scene?.setRhythmStyle(rhythm === "wave" || rhythm === "lift" ? rhythm : "legacy");
    const flatten = playing || style === "flat" ? 1 : style === "music-flat" && reactive && strength > 0 ? bands.activity : 0;
    scene?.setPlayfield(context.enabled, { ...bands, low: bands.low * this.musicGain, mid: bands.mid * this.musicGain, high: bands.high * this.musicGain }, strength, flatten, this.round.target, this.bool("idlebreathing", true));
    if (scene) scene.onRelayPick = key => this.hit(key);
    this.round.tick(elapsed, context.paused);
    if (context.paused) this.last = 0;
    if (this.round.status === "preparing" && this.round.remaining === 0 && !context.paused && scene) {
      const candidates = scene.relayCandidates().filter(key => key !== this.previousTarget);
      if (candidates.length) {
        const key = candidates[Math.floor(Math.random() * candidates.length)];
        this.previousTarget = key;
        const pace = this.props.gamepace?.value;
        this.round.aim(key, pace === "gentle" || pace === "quick" ? pace : "normal");
      } else this.round.finish("这一侧没有可接力的档案，请退出后移动阵列再试");
    }
    const over = this.round.status === "over";
    // Keep the game isolated until the user exits, including its result screen.
    scene?.setRelayActive(this.active || this.closing);
    this.stage.dataset.relay = String(this.active);
    this.stage.dataset.relayStatus = this.round.status;
    this.stage.dataset.relayScore = String(this.round.score);
    this.stage.dataset.spectrumLevel = bands.activity.toFixed(3);
    this.updateEntry();
    this.syncInputIsolation();
    if (context.reduced) {
      this.hudTransition.finish(); this.entryTransition.finish(); this.markerTransition.finish();
    }
    if (this.closing) return;
    this.retry.hidden = !over;
    const score = String(this.round.score).padStart(2, "0");
    if (this.score.textContent !== score) this.score.textContent = score;
    const message = over ? this.round.reason : context.paused ? "已暂停" : "点击抬起的档案，接住下一道波纹";
    if (this.message.textContent !== message) this.message.textContent = message;
    this.bar.style.transform = `scaleX(${this.round.status === "playing" ? this.round.remaining / this.round.total : 0})`;
    this.position();
  }
  position() {
    const point = this.round.target ? this.scene()?.projectRelay(this.round.target) : null;
    this.showMarker(Boolean(point) && !this.context().paused && this.active && !this.closing);
    if (point) {
      const rect = this.stage.getBoundingClientRect();
      this.marker.style.left = `${(point.x - rect.left) / rect.width * 100}%`;
      this.marker.style.top = `${(point.y - rect.top) / rect.height * 100}%`;
      const label = String(this.round.score + 1).padStart(2, "0");
      if (this.marker.textContent !== label) this.marker.textContent = label;
    }
  }
}
