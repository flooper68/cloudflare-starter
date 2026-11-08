/**
 * The hero scene's script (HeroScene.astro): the parts CSS cannot do alone.
 * - Tilt: under a fine pointer, the scene leans up to MAX_TILT degrees toward it, eased by
 *   one requestAnimationFrame loop that runs only while the tilt is still moving.
 * - Build fallback: where `animation-timeline: scroll()` is unsupported, `is-built` is
 *   added when most of the hero has scrolled away (and removed when it comes back).
 * Nothing runs under `prefers-reduced-motion: reduce`, and no tilt on touch screens.
 */
const MAX_TILT = 4;
const EASE = 0.08;

export function animateHeroScene(scene: HTMLElement): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const hero = scene.closest<HTMLElement>("[data-hero]") ?? scene;

  if (matchMedia("(hover: hover) and (pointer: fine)").matches)
    tilt(scene, hero);

  if (
    !CSS.supports("animation-timeline: scroll()") &&
    "IntersectionObserver" in window
  ) {
    new IntersectionObserver(
      ([entry]) =>
        scene.classList.toggle("is-built", entry.intersectionRatio < 0.6),
      { threshold: [0, 0.6, 1] }
    ).observe(hero);
  }
}

function tilt(scene: HTMLElement, area: HTMLElement): void {
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let frame = 0;

  const step = () => {
    current.x += (target.x - current.x) * EASE;
    current.y += (target.y - current.y) * EASE;
    scene.style.setProperty("--hs-rx", `${current.x.toFixed(3)}deg`);
    scene.style.setProperty("--hs-ry", `${current.y.toFixed(3)}deg`);
    const settled =
      Math.abs(target.x - current.x) < 0.01 &&
      Math.abs(target.y - current.y) < 0.01;
    frame = settled ? 0 : requestAnimationFrame(step);
  };
  const run = () => {
    if (!frame) frame = requestAnimationFrame(step);
  };

  area.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    const box = scene.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * 2 - 1;
    const y = ((event.clientY - box.top) / box.height) * 2 - 1;
    target.x = Math.max(-1, Math.min(1, x)) * MAX_TILT;
    target.y = -Math.max(-1, Math.min(1, y)) * MAX_TILT * 0.75;
    run();
  });
  area.addEventListener("pointerleave", () => {
    target.x = 0;
    target.y = 0;
    run();
  });
}
