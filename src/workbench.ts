import { rollText, patchRollingPanel } from "./workbench-rolling";
import { escapeHtml } from "./html";
import { wallpaperHost, type WallpaperProperties } from "./wallpaper";
import { dayKey, durationText, idleTimer, parseTarget, restoreTimer, timerLeft } from "./workbench-state";
import "./workbench.css";
import { defaultWorkbenchVisibility, applyVisibilityProperties, type WorkbenchVisibility, type WorkbenchElement } from "./workbench-visibility";

type Media = { status?: { enabled?: boolean }; properties?: { title?: string; artist?: string; albumTitle?: string }; thumbnail?: { thumbnail?: string }; timeline?: { position?: number; duration?: number }; playing?: boolean };
declare global { interface Window { rhineWallpaperMedia?: Media; } }
const names = ["时间日期", "今日事项", "重要日程", "正在播放", "专注计时"];
const capabilityKeys = ["enabletime", "enabletasks", "enableevent", "enablemedia", "enablefocus"];
const key = "rhine-workbench-v1";
export class Workbench {
  enabled = false;
  private root: HTMLElement;
  private props: WallpaperProperties = {};
  private lane = 0;
  private timer = idleTimer();
  private done: string[] = [];
  private date = dayKey(new Date());
  private storageOK = true;
  private lastSecond = -1;
  private exitAnimation?: Animation;
  private visibility: WorkbenchVisibility = defaultWorkbenchVisibility();
  constructor(private stage: HTMLElement, private onMode: () => void, private onLane: (lane: number) => void) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      this.timer = restoreTimer(saved?.timer);
      if (saved?.date === this.date && Array.isArray(saved.done)) this.done = saved.done.filter((s: unknown) => typeof s === "string").slice(0, 3);
    } catch { this.storageOK = false; }
    stage.insertAdjacentHTML("beforeend", `<section class="workbench" hidden aria-label="桌面工作台">
      <div class="wb-overview"><div class="wb-time"><div class="wb-kicker">RHINE LAB / DAILY TERMINAL</div><time class="wb-clock"></time><div class="wb-date"></div></div>
      <section class="wb-today"><div class="wb-heading"><h2>今日事项</h2><span class="wb-task-count"></span></div><div class="wb-tasks"></div></section></div>
      <section class="wb-module"><div class="wb-kicker">PERSONAL WORKSPACE <span class="wb-index">01 / 05</span></div><h2 class="wb-title"></h2><div class="wb-content"></div><p class="wb-storage" role="status"></p></section>
      <nav class="wb-nav" aria-label="工作台功能">${names.map((n, i) => `<button data-wb-lane="${i}" aria-pressed="false"><small>0${i + 1}</small>${n}<span>↗</span></button>`).join("")}</nav>
    </section>`);
    this.root = stage.querySelector(".workbench")!;
    this.root.addEventListener("click", event => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button");
      if (!button) return;
      if (button.dataset.wbLane !== undefined) { this.select(+button.dataset.wbLane); onLane(this.lane); }
      if (button.dataset.wbTask !== undefined) {
        this.rollDay();
        const id = this.taskId(+button.dataset.wbTask);
        this.done = this.done.includes(id) ? this.done.filter(d => d !== id) : [...this.done, id];
        this.save(); this.renderTasks();
        this.root.querySelector<HTMLButtonElement>(`[data-wb-task="${button.dataset.wbTask}"]`)?.focus({ preventScroll: true });
      }
      if (button.dataset.wbTimer) this.actTimer(button.dataset.wbTimer);
    });
    window.addEventListener("rhine-wallpaper-properties", event => this.apply((event as CustomEvent<WallpaperProperties>).detail));
    window.addEventListener("rhine-wallpaper-media", () => { if (this.lane === 3) this.renderPanel(); });
    window.addEventListener("resize", () => { if (this.lane === 3) this.renderPanel(); });
    this.apply(wallpaperHost()?.properties ?? {});
  }
  private text(key: string) { const v = this.props[key]?.value; return typeof v === "string" ? v.trim().slice(0, 240) : ""; }
  private minutes(phase = this.timer.phase) { const n = this.props[phase === "focus" ? "focusminutes" : "breakminutes"]?.value; return typeof n === "number" && Number.isFinite(n) ? Math.max(1, Math.min(phase === "focus" ? 120 : 60, n)) : phase === "focus" ? 25 : 5; }
  private taskId(i: number) { return `${i}:${this.text(`task${i + 1}`)}`; }
  private apply(props: WallpaperProperties) {
    Object.assign(this.props, props);
    this.visibility = applyVisibilityProperties(this.visibility, props);
    if (props.desktopmode) this.setEnabled(props.desktopmode.value === "workbench");
    // Early/partial host updates must not clear saved tasks before their text arrives.
    const previous = this.done.length;
    this.done = this.done.filter(id => [0, 1, 2].every(i => !props[`task${i + 1}`] || !id.startsWith(`${i}:`) || id === this.taskId(i)));
    if (previous !== this.done.length) this.save();
    if (!this.laneEnabled(this.lane)) {
      this.lane = capabilityKeys.findIndex((_, i) => this.laneEnabled(i));
      if (this.lane >= 0) this.onLane(this.lane);
    }
    this.renderTasks(); this.renderPanel();
    this.syncElements();
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    this.stage.dataset.workbench = String(value);
    document.querySelectorAll<HTMLElement>("[data-workbench-mode]").forEach(button => button.setAttribute("aria-pressed", String((button.dataset.workbenchMode === "workbench") === value)));
    this.onMode();
    this.syncVisibility();
    this.syncElements();
  }
  syncVisibility() {
    const hidden = !this.enabled || this.stage.dataset.mode === "boot";
    const entering = this.root.hidden && !hidden;
    const reduced = this.stage.classList.contains("reduce-motion");
    this.root.inert = hidden;
    this.root.setAttribute("aria-hidden", String(hidden));
    if (hidden && !this.root.hidden && !reduced) {
      if (!this.exitAnimation) {
        const animation = this.root.animate([{ opacity: getComputedStyle(this.root).opacity }, { opacity: 0 }], { duration: 220, fill: "forwards", easing: "ease-out" });
        this.exitAnimation = animation;
        animation.onfinish = () => { this.root.hidden = true; animation.cancel(); this.exitAnimation = undefined; };
      }
      return;
    }
    const interrupted = Boolean(this.exitAnimation);
    const opacity = getComputedStyle(this.root).opacity;
    this.exitAnimation?.cancel();
    this.exitAnimation = undefined;
    this.root.hidden = hidden;
    if (interrupted && !hidden && !reduced) this.root.animate([{ opacity }, { opacity: 1 }], { duration: 220, easing: "ease-out" });
    if (entering) {
      [".wb-time", ".wb-today", ".wb-module", ".wb-nav"].forEach((selector, i) => {
        const element = this.root.querySelector<HTMLElement>(selector)!;
        element.getAnimations().forEach(a => a.cancel());
        if (!reduced) element.animate([{ opacity: 0, translate: "0 9px" }, { opacity: 1, translate: "0 0" }],
          { duration: 460, delay: 60 + i * 65, easing: "cubic-bezier(.22,.7,.2,1)", fill: "backwards" });
      });
    }
  }
  private laneEnabled(lane: number) { return lane >= 0 && lane < names.length && this.props[capabilityKeys[lane]]?.value !== false; }
  select(lane: number) {
    if (!this.laneEnabled(lane)) return;
    this.lane = lane;
    this.renderPanel();
  }
  settingsMarkup() {
    return `<div class="wb-settings"><strong>工作模式</strong><div><button data-workbench-mode="workbench" aria-pressed="${this.enabled}">桌面工作台</button><button data-workbench-mode="archive" aria-pressed="${!this.enabled}">档案展示</button></div><p>事项、日程和计时时长请在 Wallpaper Engine 属性中填写。事项完成状态按天保存，计时进度单独保留。</p><p>工作台元素与设置入口的显示开关位于 Wallpaper Engine 的壁纸属性中。全部关闭后只显示档案阵列；需要恢复时从那里重新打开。隐藏专注内容不会停止计时。</p></div>`;
  }
  private syncElements() {
    const selectors = { clock: ".wb-time", tasks: ".wb-today", module: ".wb-module", navigation: ".wb-nav" } as const;
    for (const [key, selector] of Object.entries(selectors)) this.root.querySelector<HTMLElement>(selector)!.hidden = !this.visibility[key as WorkbenchElement];
    const available = capabilityKeys.some((_, i) => this.laneEnabled(i));
    this.root.querySelector<HTMLElement>(".wb-module")!.hidden = !this.visibility.module || !available;
    this.root.querySelector<HTMLElement>(".wb-nav")!.hidden = !this.visibility.navigation || !available;
    this.root.querySelectorAll<HTMLButtonElement>("[data-wb-lane]").forEach(button => { button.hidden = !this.laneEnabled(+button.dataset.wbLane!); });
    this.root.querySelector<HTMLElement>(".wb-overview")!.hidden = !this.visibility.clock && !this.visibility.tasks;
    this.root.dataset.clockVisible = String(this.visibility.clock);
    this.stage.dataset.workbenchBrand = String(!this.enabled || this.visibility.brand);
    this.stage.dataset.workbenchFooter = String(!this.enabled || this.visibility.footer);
    this.stage.dataset.workbenchSettings = String(!this.enabled || this.visibility.settings);
  }
  private save() {
    try { localStorage.setItem(key, JSON.stringify({ date: this.date, done: this.done, timer: this.timer })); this.storageOK = true; }
    catch { this.storageOK = false; }
    this.root.querySelector(".wb-storage")!.textContent = this.storageOK ? "" : "当前无法保存进度，重新加载后可能丢失。";
  }
  private rollDay() {
    const today = dayKey(new Date());
    if (this.date !== today) { this.date = today; this.done = []; this.save(); this.renderTasks(); }
  }
  private renderTasks() {
    const entries = [0, 1, 2].filter(i => this.text(`task${i + 1}`));
    this.root.querySelector(".wb-task-count")!.textContent = entries.length ? `${entries.filter(i => this.done.includes(this.taskId(i))).length} / ${entries.length}` : "";
    this.root.querySelector(".wb-tasks")!.innerHTML = entries.length ? entries.map(i => `<button class="wb-task" data-wb-task="${i}" aria-pressed="${this.done.includes(this.taskId(i))}"><span class="wb-check" aria-hidden="true">${this.done.includes(this.taskId(i)) ? "✓" : ""}</span><span>${escapeHtml(this.text(`task${i + 1}`))}</span></button>`).join("") : '<p class="wb-muted">今天想完成什么？<br>在 Wallpaper Engine 属性中填写最多三件事。</p>';
  }
  private actTimer(action: string) {
    const now = Date.now();
    this.settle(now);
    if (action === "reset") this.timer = { ...idleTimer(), phase: this.timer.phase };
    if (action === "phase") this.timer = { ...idleTimer(), phase: this.timer.phase === "focus" ? "break" : "focus" };
    if (action === "toggle") {
      if (this.timer.status === "running") this.timer = { ...this.timer, status: "paused", remaining: timerLeft(this.timer, now), deadline: 0 };
      else {
        const remaining = this.timer.status === "paused" ? this.timer.remaining : this.minutes() * 60000;
        this.timer = { ...this.timer, remaining, deadline: now + remaining, status: "running" };
      }
    }
    this.save(); this.renderPanel();
    this.root.querySelector<HTMLButtonElement>(`[data-wb-timer="${action}"]`)?.focus({ preventScroll: true });
  }
  private settle(now: number) {
    if (this.timer.status === "running" && timerLeft(this.timer, now) === 0) {
      this.timer = { ...this.timer, status: "done", remaining: 0, deadline: 0 }; this.save(); this.renderPanel();
    }
  }
  tick(now = Date.now()) {
    if (Math.floor(now / 1000) === this.lastSecond) return;
    this.lastSecond = Math.floor(now / 1000);
    this.rollDay(); this.settle(now);
    const date = new Date(now);
    rollText(this.root.querySelector<HTMLElement>(".wb-clock")!, date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), !this.stage.classList.contains("reduce-motion"));
    this.root.querySelector(".wb-date")!.textContent = date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    if (this.lane === 0 || this.lane === 2) this.renderPanel();
    const timer = this.root.querySelector(".wb-timer-digits");
    if (timer) rollText(timer as HTMLElement, durationText(this.timer.status === "idle" ? this.minutes() * 60000 : timerLeft(this.timer, now)), !this.stage.classList.contains("reduce-motion"));
  }
  private renderPanel() {
    if (this.lane < 0) {
      this.root.querySelector(".wb-title")!.textContent = "";
      this.root.querySelector(".wb-content")!.replaceChildren();
      return;
    }
    this.root.querySelector(".wb-title")!.textContent = names[this.lane];
    const available = capabilityKeys.map((_, i) => i).filter(i => this.laneEnabled(i));
    this.root.querySelector(".wb-index")!.textContent = `${String(available.indexOf(this.lane) + 1).padStart(2, "0")} / ${String(available.length).padStart(2, "0")}`;
    this.root.querySelectorAll<HTMLButtonElement>("[data-wb-lane]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.wbLane! === this.lane)));
    let html = "";
    if (this.lane === 0) {
      const now = new Date(), end = new Date(now.getFullYear() + 1, 0, 1).getTime(), start = new Date(now.getFullYear(), 0, 1).getTime();
      const percent = (now.getTime() - start) / (end - start) * 100;
      html = `<div class="wb-large">${now.getFullYear()}<small>YEAR</small></div><div class="wb-rule"><i style="width:${percent}%"></i></div><p class="wb-muted">今年已走过 ${percent.toFixed(1)}%</p>`;
    }
    if (this.lane === 1) html = '<div class="wb-large">03<small>PRIORITIES</small></div><p class="wb-muted">把今天留给最重要的三件事。<br>点击左侧事项标记完成，再点一次撤销。完成状态每天重置。</p>';
    if (this.lane === 2) {
      const text = this.text("eventdate"), target = parseTarget(text), title = this.text("eventname");
      const delta = target === null ? 0 : target - Date.now();
      html = !text ? '<p class="wb-empty">留一个值得期待的日子。</p><p class="wb-muted">在 Wallpaper Engine 中填写日程名称与目标日期。</p>' : target === null ? '<p class="wb-empty">目标日期格式不正确</p><p class="wb-muted">请填写 YYYY-MM-DD，或 YYYY-MM-DD HH:mm。</p>' : `<p class="wb-event">${escapeHtml(title || "重要日程")}</p><div class="wb-large">${Math.ceil(Math.abs(delta) / 86400000)}<small>${delta > 0 ? "天后" : "天前"}</small></div><p class="wb-muted">${delta > 0 ? "距离目标" : "已到达目标"} · ${escapeHtml(text)}<br>${Math.floor(Math.abs(delta) / 3600000)} 小时 ${Math.floor(Math.abs(delta) / 60000) % 60} 分钟${delta > 0 ? "后" : "前"}</p>`;
    }
    if (this.lane === 3) {
      const media = window.rhineWallpaperMedia ?? {}, p = media.properties, t = media.timeline;
      const cover = media.thumbnail?.thumbnail;
      const safeCover = typeof cover === "string" && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(cover);
      html = media.status?.enabled === false ? '<p class="wb-empty">媒体信息未启用</p><p class="wb-muted">请在 Wallpaper Engine 中启用媒体信息集成。</p>' : !p?.title ? '<p class="wb-empty">此刻，留一点安静。</p><p class="wb-muted">在支持系统媒体信息的播放器中播放音乐，歌曲与封面会显示在这里。</p>' : `<div class="wb-media">${safeCover ? `<img src="${escapeHtml(cover!)}" alt="专辑封面"/>` : '<div class="wb-cover" aria-hidden="true">♫</div>'}<div><small>${media.playing ? "正在播放" : "媒体已暂停或停止"}</small><h3 data-wb-roll>${escapeHtml(p.title)}</h3><p data-wb-roll>${escapeHtml(p.artist || "")}</p></div></div>${t && typeof t.duration === "number" && t.duration > 0 && Number.isFinite(t.duration) && typeof t.position === "number" && Number.isFinite(t.position) ? `<div class="wb-rule"><i style="width:${Math.max(0, Math.min(100, t.position / t.duration * 100))}%"></i></div><p class="wb-muted"><span data-wb-roll>${durationText(t.position * 1000)}</span> / <span data-wb-roll>${durationText(t.duration * 1000)}</span></p>` : ''}`;
    }
    if (this.lane === 4) html = `<div class="wb-timer-label">${this.timer.phase === "focus" ? "专注" : "休息"} · ${this.timer.status === "done" ? "已结束" : this.timer.status === "running" ? "进行中" : this.timer.status === "paused" ? "已暂停" : "准备开始"}</div><div class="wb-large wb-timer-digits" data-wb-roll>${durationText(this.timer.status === "idle" ? this.minutes() * 60000 : timerLeft(this.timer, Date.now()))}</div><div class="wb-timer-buttons"><button data-wb-timer="toggle">${this.timer.status === "running" ? "暂停" : this.timer.status === "paused" ? "继续" : "开始"}</button><button data-wb-timer="reset">重置</button><button data-wb-timer="phase">${this.timer.phase === "focus" ? "转入休息" : "开始专注"}</button></div><p class="wb-muted">${this.timer.status === "done" ? "这一段时间已完成。准备好后再开始下一段。" : "暂停壁纸或重新加载后按实际时间校正。"}<br>时长在 Wallpaper Engine 中设置。</p>`;
    patchRollingPanel(this.root.querySelector<HTMLElement>(".wb-content")!, html, !this.stage.classList.contains("reduce-motion"));
    this.root.querySelector(".wb-storage")!.textContent = this.storageOK ? "" : "当前无法保存进度，重新加载后可能丢失。";
  }
}

