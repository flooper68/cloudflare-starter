/**
 * `<walkthrough-video>`: plays the markup player-markup.ts renders.
 * - Walkthrough: nothing loads until Play (or a chapter) is pressed; then the native
 *   controls take over, captions are on, the current chapter is marked
 *   (`aria-current`). Never plays on its own, never with sound.
 * - Loop: muted, plays only while half in view (IntersectionObserver) and pauses off
 *   screen; the pause button is always there. Under prefers-reduced-motion it waits on
 *   its poster until the visitor presses Play.
 * - Missing media (not uploaded yet): the poster's designed stand-in stays, with a note.
 * - Analytics (src/lib/site-analytics.ts): pressing Play on a walkthrough (or on a loop)
 *   is `site.video_played` and a sign of interest, playing a walkthrough to its end
 *   `site.video_completed`, once each per video and page view. A loop that plays on its
 *   own counts nothing.
 */
import { markEngaged, trackSiteEvent } from "@/lib/site-analytics";

/** A visitor pressed Play on the video with this id. */
function played(id: string | undefined): void {
  if (!id) return;
  trackSiteEvent("site.video_played", { video: id }, { once: `play:${id}` });
  markEngaged("video");
}

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
      played(this.dataset.video);
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
    video.addEventListener("ended", () => {
      const id = this.dataset.video;
      if (id)
        trackSiteEvent(
          "site.video_completed",
          { video: id },
          { once: `ended:${id}` }
        );
    });
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
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let chosen: boolean | null = null;
    let visible = false;
    const label = () => {
      toggle?.setAttribute(
        "aria-label",
        `${video.paused ? "Play" : "Pause"} clip: ${title}`
      );
      this.classList.toggle("wv-playing", !video.paused);
    };
    const update = () => {
      const wanted = chosen ?? !reduced;
      if (visible && wanted) void video.play().catch(() => {});
      else video.pause();
    };
    video.addEventListener("play", label);
    video.addEventListener("pause", label);
    toggle?.addEventListener("click", () => {
      chosen = video.paused;
      if (chosen) played(this.dataset.video);
      if (chosen) void video.play().catch(() => {});
      else video.pause();
    });
    new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        update();
      },
      { threshold: 0.5 }
    ).observe(this);
  }
}

if (!customElements.get("walkthrough-video")) {
  customElements.define("walkthrough-video", WalkthroughVideo);
}
