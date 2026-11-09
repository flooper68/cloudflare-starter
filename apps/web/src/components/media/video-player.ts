/**
 * `<walkthrough-video>`: plays the markup player-markup.ts renders.
 * - Walkthrough: nothing loads until Play (or a chapter) is pressed; then the native
 *   controls take over, captions are on, the current chapter is marked
 *   (`aria-current`). Never plays on its own, never with sound.
 * - Loop: muted, plays only while half in view (IntersectionObserver) and pauses off
 *   screen; the pause button is always there. Under prefers-reduced-motion it waits on
 *   its poster until the visitor presses Play.
 * - Loop, opened large (its expand button, or a click on the clip): on a touch screen
 *   the clip goes straight to native full screen (`requestFullscreen`, or
 *   `webkitEnterFullscreen` on iPhone); elsewhere a `<dialog>` lightbox plays it from the
 *   start with controls and a Full screen button. Escape, the backdrop or Close closes
 *   it and focus returns to the card. Under reduced motion the lightbox waits on the
 *   poster with a Play button.
 * - Missing media (not uploaded yet): the poster's designed stand-in stays, with a note.
 */

/** iPhone Safari: no element full screen, only the video's own. */
type AppleVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const SVG = "http://www.w3.org/2000/svg";
function icon(...paths: string[]): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  for (const [name, value] of Object.entries({
    viewBox: "0 0 24 24",
    width: "18",
    height: "18",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  }))
    svg.setAttribute(name, value);
  for (const d of paths) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  attrs: Record<string, string> = {}
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  for (const [name, value] of Object.entries(attrs))
    node.setAttribute(name, value);
  return node;
}

const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
const touchScreen = () =>
  matchMedia("(hover: none) and (pointer: coarse)").matches;

/** Whatever this browser puts a video into full screen with, or null. */
function fullscreenOf(video: AppleVideo): (() => Promise<void>) | null {
  if (document.fullscreenEnabled && video.requestFullscreen)
    return () => video.requestFullscreen();
  const enter = video.webkitEnterFullscreen?.bind(video);
  if (enter) return async () => enter();
  return null;
}

interface Clip {
  readonly title: string;
  readonly video: HTMLVideoElement;
  readonly poster: string | undefined;
  /** Focus goes back here when the lightbox closes. */
  readonly returnFocus: HTMLElement;
  readonly hold: () => void;
  readonly release: () => void;
}

/** One `<dialog>` per page, built on first use. */
class Lightbox {
  private readonly dialog: HTMLDialogElement;
  private readonly heading: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly fullscreen: HTMLButtonElement;
  private clip: Clip | null = null;
  private video: AppleVideo | null = null;

  constructor() {
    const dialog = element("dialog", "wv-lightbox", {
      "aria-labelledby": "wv-lightbox-title",
    });
    const bar = element("div", "wv-lightbox-bar");
    this.heading = element("p", "wv-lightbox-title", {
      id: "wv-lightbox-title",
    });
    this.fullscreen = element("button", "wv-lightbox-button", {
      type: "button",
      "aria-label": "Full screen",
      title: "Full screen",
    });
    this.fullscreen.appendChild(icon("M8 3H3v5M21 8V3h-5M16 21h5v-5M3 16v5h5"));
    const close = element("button", "wv-lightbox-button", {
      type: "button",
      "aria-label": "Close",
      title: "Close",
    });
    close.appendChild(icon("M6 6l12 12M18 6L6 18"));
    bar.appendChild(this.heading);
    bar.appendChild(this.fullscreen);
    bar.appendChild(close);
    this.stage = element("div", "wv-lightbox-stage");
    dialog.appendChild(bar);
    dialog.appendChild(this.stage);
    document.body.appendChild(dialog);

    close.addEventListener("click", () => dialog.close());
    // A click on the backdrop lands on the dialog itself, outside its content.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    this.fullscreen.addEventListener("click", () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else if (this.video) void fullscreenOf(this.video)?.().catch(() => {});
    });
    dialog.addEventListener("close", () => this.closed());
    this.dialog = dialog;
  }

  open(clip: Clip) {
    if (this.dialog.open) this.dialog.close();
    this.clip = clip;
    clip.hold();
    const { width, height } = clip.video;
    this.dialog.style.setProperty(
      "--wv-ratio",
      String(width && height ? width / height : 16 / 10)
    );
    this.heading.textContent = clip.title;

    const video: AppleVideo = element("video", "wv-lightbox-video", {
      "aria-label": clip.title,
    });
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.controls = true;
    const reduced = reducedMotion();
    // Under reduced motion nothing loads until Play.
    video.preload = reduced ? "none" : "auto";
    if (clip.poster) video.poster = clip.poster;
    if (width) video.width = width;
    if (height) video.height = height;
    for (const source of clip.video.querySelectorAll("source"))
      video.appendChild(source.cloneNode());
    const track = clip.video.querySelector("track");
    if (track) {
      const copy = track.cloneNode() as HTMLTrackElement;
      if (copy.dataset.src && !copy.getAttribute("src"))
        copy.src = copy.dataset.src;
      copy.default = true;
      video.appendChild(copy);
    }
    const note = element("p", "wv-lightbox-missing", { role: "status" });
    const sources = video.querySelectorAll("source");
    sources[sources.length - 1]?.addEventListener("error", () => {
      this.stage.classList.add("wv-unavailable");
      note.textContent = "This video is not available yet.";
    });
    this.stage.classList.remove("wv-unavailable", "wv-started");
    this.stage.replaceChildren(video, note);
    this.video = video;
    this.fullscreen.hidden = fullscreenOf(video) === null;

    const play = () => {
      this.stage.classList.add("wv-started");
      void video.play().catch(() => {});
    };
    let focus: HTMLElement = video;
    if (reduced) {
      // No motion until asked for: the poster and a Play button.
      const button = element("button", "wv-play wv-lightbox-play", {
        type: "button",
        "aria-label": `Play ${clip.title}`,
      });
      button.appendChild(icon("M7 4.5v15l12.5-7.5z"));
      button.addEventListener("click", () => {
        play();
        video.focus();
      });
      video.addEventListener("play", () =>
        this.stage.classList.add("wv-started")
      );
      this.stage.appendChild(button);
      focus = button;
    }
    this.dialog.showModal();
    focus.focus();
    if (!reduced) play();
  }

  private closed() {
    if (document.fullscreenElement) void document.exitFullscreen();
    if (this.video) {
      this.video.pause();
      this.video = null;
    }
    // Removing the video stops its download.
    this.stage.replaceChildren();
    const clip = this.clip;
    this.clip = null;
    if (clip) {
      clip.returnFocus.focus();
      clip.release();
    }
  }
}

let lightbox: Lightbox | undefined;

class WalkthroughVideo extends HTMLElement {
  private video!: HTMLVideoElement;

  connectedCallback() {
    const video = this.querySelector("video");
    if (!video || this.video) return;
    this.video = video;
    const poster = this.querySelector<HTMLImageElement>(".wv-poster");
    if (poster) {
      const missing = () => this.classList.add("wv-noposter");
      if (poster.complete && poster.naturalWidth === 0) missing();
      poster.addEventListener("error", missing);
    }
    const sources = video.querySelectorAll("source");
    sources[sources.length - 1]?.addEventListener("error", () =>
      this.unavailable()
    );
    if (this.hasAttribute("data-loop")) this.loop();
    else this.walkthrough();
  }

  private unavailable() {
    this.classList.add("wv-unavailable");
    this.classList.remove("wv-started", "wv-playing");
    this.video.controls = false;
    const note = this.querySelector(".wv-missing");
    if (note) note.textContent = "This video is not available yet.";
  }

  private walkthrough() {
    const { video } = this;
    const chapters = [...this.querySelectorAll<HTMLButtonElement>(".wv-chap")];
    const start = (at: number) => {
      if (this.classList.contains("wv-unavailable")) return;
      this.classList.add("wv-started");
      video.hidden = false;
      video.controls = true;
      video.muted = true;
      // The captions load with the video, not before Play.
      const captions = video.querySelector("track");
      if (captions?.dataset.src && !captions.getAttribute("src"))
        captions.src = captions.dataset.src;
      const seek = () => {
        video.currentTime = at;
        const track = video.textTracks[0];
        if (track) track.mode = "showing";
      };
      if (video.readyState > 0) seek();
      else video.addEventListener("loadedmetadata", seek, { once: true });
      void video.play().catch(() => {});
      video.focus();
    };
    this.querySelector(".wv-play")?.addEventListener("click", () => start(0));
    for (const chapter of chapters) {
      chapter.addEventListener("click", () =>
        start(Number(chapter.dataset.start))
      );
    }
    video.addEventListener("timeupdate", () => {
      let current: HTMLButtonElement | undefined;
      for (const chapter of chapters) {
        if (Number(chapter.dataset.start) <= video.currentTime + 0.05)
          current = chapter;
      }
      for (const chapter of chapters) {
        if (chapter === current) chapter.setAttribute("aria-current", "true");
        else chapter.removeAttribute("aria-current");
      }
    });
  }

  private loop() {
    const { video } = this;
    const toggle = this.querySelector<HTMLButtonElement>(".wv-toggle");
    const title = video
      .getAttribute("aria-label")
      ?.replace(/, a muted clip$/, "");
    const reduced = reducedMotion();
    let chosen: boolean | null = null;
    let visible = false;
    // Opened large: the card's copy stays still until it closes.
    let held = false;
    const label = () => {
      toggle?.setAttribute(
        "aria-label",
        `${video.paused ? "Play" : "Pause"} clip: ${title}`
      );
      this.classList.toggle("wv-playing", !video.paused);
    };
    const update = () => {
      if (held) return;
      const wanted = chosen ?? !reduced;
      if (visible && wanted) void video.play().catch(() => {});
      else video.pause();
    };
    video.addEventListener("play", label);
    video.addEventListener("pause", label);
    toggle?.addEventListener("click", () => {
      chosen = video.paused;
      if (chosen) void video.play().catch(() => {});
      else video.pause();
    });
    this.expandable(video, title ?? "", {
      hold: () => {
        held = true;
        video.pause();
      },
      release: () => {
        held = false;
        update();
      },
    });
    new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        update();
      },
      { threshold: 0.5 }
    ).observe(this);
  }

  /** The clip opened large: native full screen on touch screens, else the lightbox. */
  private expandable(
    video: AppleVideo,
    title: string,
    hold: { hold: () => void; release: () => void }
  ) {
    const expand = this.querySelector<HTMLButtonElement>(".wv-expand");
    const stage = this.querySelector<HTMLElement>(".wv-stage");
    if (!expand || !stage) return;
    const poster = this.querySelector<HTMLImageElement>(".wv-poster");
    const openLightbox = () => {
      lightbox ??= new Lightbox();
      lightbox.open({
        title,
        video,
        poster: this.classList.contains("wv-noposter")
          ? undefined
          : poster?.src,
        returnFocus: expand,
        ...hold,
      });
    };
    // The card's own video, full screen with controls; back to a muted loop after.
    const native = (enter: () => Promise<void>) => {
      hold.hold();
      const done = () => {
        document.removeEventListener("fullscreenchange", exited);
        video.controls = false;
        hold.release();
      };
      const exited = () => {
        if (!document.fullscreenElement) done();
      };
      video.addEventListener("webkitendfullscreen", done, { once: true });
      video.controls = true;
      video.currentTime = 0;
      if (!reducedMotion()) void video.play().catch(() => {});
      enter()
        .then(() => document.addEventListener("fullscreenchange", exited))
        .catch(() => {
          // Refused (iPhone, before the video has loaded): the lightbox instead.
          video.removeEventListener("webkitendfullscreen", done);
          video.controls = false;
          openLightbox();
        });
    };
    const open = () => {
      const enter = touchScreen() ? fullscreenOf(video) : null;
      if (enter) native(enter);
      else openLightbox();
    };
    expand.addEventListener("click", open);
    // A click anywhere on the clip opens it too; its pause button keeps its own job.
    stage.addEventListener("click", (event) => {
      if (!(event.target as Element).closest("button")) open();
    });
  }
}

if (!customElements.get("walkthrough-video")) {
  customElements.define("walkthrough-video", WalkthroughVideo);
}
