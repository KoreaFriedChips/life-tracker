import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const ICONS_DIR = path.join(process.cwd(), "public", "icons");

/** Every committed PNG and its expected square pixel size (apple-touch-icon's name carries no size). */
const EXPECTED_PNG_SIZES: Record<string, number> = {
  "icon-192.png": 192,
  "icon-512.png": 512,
  "icon-512-maskable.png": 512,
  "apple-touch-icon.png": 180,
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reads IHDR width/height (big-endian uint32 at offsets 16/20) after validating the signature. */
function pngDimensions(file: Buffer): { width: number; height: number } {
  expect(file.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(file.subarray(12, 16).toString("latin1")).toBe("IHDR");
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

describe("manifest icons", () => {
  it("declares srcs/sizes/purpose matching the committed PNGs", () => {
    const icons = manifest().icons ?? [];
    expect(icons.map((icon) => icon.src)).toEqual([
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/icons/icon-512-maskable.png",
    ]);
    for (const icon of icons) {
      const filename = path.basename(icon.src);
      const expected = EXPECTED_PNG_SIZES[filename];
      expect(expected).toBeDefined();
      expect(icon.sizes).toBe(`${expected}x${expected}`);
      expect(icon.type).toBe("image/png");
    }
    expect(icons.filter((icon) => icon.purpose === "maskable").map((icon) => icon.src)).toEqual([
      "/icons/icon-512-maskable.png",
    ]);
  });

  it("committed PNGs have valid signatures and IHDR dimensions", () => {
    for (const [filename, size] of Object.entries(EXPECTED_PNG_SIZES)) {
      const file = readFileSync(path.join(ICONS_DIR, filename));
      expect(pngDimensions(file), filename).toEqual({ width: size, height: size });
    }
  });
});
