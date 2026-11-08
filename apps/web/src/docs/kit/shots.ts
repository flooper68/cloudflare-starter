/**
 * The docs screenshots: what the pipeline (`bun run docs:screenshots`,
 * apps/web/test/screens/) captured, as `docs/images/screens/manifest.json`, and how a
 * doc finds a shot's files. Each shot has a dark and a light image at 1440 px wide and,
 * where useful, phone images; each image carries its callout positions, measured from
 * element locators at capture time, so the numbered markers follow the UI when it moves.
 * Shared by the Markdown plugin, the screenshot pipeline and the tests.
 */
import type { Callout, ShotVariant } from "./render";

/** Repository path of the screenshots folder and its manifest. */
export const SCREENS_DIR = "docs/images/screens";
export const SCREENS_MANIFEST = `${SCREENS_DIR}/manifest.json`;

export interface ShotImage {
  /** File name inside SCREENS_DIR. */
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  /** null: the element is not on this image (the doc shows no marker for it there). */
  readonly callouts: readonly (Callout | null)[];
}

export interface ShotEntry {
  /** The app path it shows. */
  readonly path: string;
  /** Default alt text. */
  readonly alt: string;
  readonly variants: Partial<Record<ShotVariant, ShotImage>>;
}

export interface ScreensManifest {
  readonly version: 1;
  readonly shots: Readonly<Record<string, ShotEntry>>;
}

export const EMPTY_MANIFEST: ScreensManifest = { version: 1, shots: {} };

/** The file name of one variant of a shot. */
export function shotFile(id: string, variant: ShotVariant): string {
  return `${id}.${variant}.webp`;
}

/** Ids are file names: lower case, digits and dashes. */
export function isShotId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

/**
 * The variants a doc shows, in the order the HTML lists them. Dark and light are
 * required; the phone ones are optional.
 */
export function shotVariants(
  manifest: ScreensManifest,
  id: string
): { variant: ShotVariant; image: ShotImage }[] {
  const entry = manifest.shots[id];
  if (!entry)
    throw new Error(
      `Docs screenshot "${id}" is not in ${SCREENS_MANIFEST}: add it to apps/web/test/screens/shots.ts and run \`bun run docs:screenshots\``
    );
  const order: ShotVariant[] = ["dark", "light", "phone-dark", "phone-light"];
  const found = order.flatMap((variant) => {
    const image = entry.variants[variant];
    return image ? [{ variant, image }] : [];
  });
  for (const required of ["dark", "light"] as const)
    if (!entry.variants[required])
      throw new Error(`Docs screenshot "${id}" has no ${required} image`);
  return found;
}
