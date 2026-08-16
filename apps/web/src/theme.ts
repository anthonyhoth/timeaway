/**
 * Brand tokens, taken from timeaway-brand-kit.png. The kit is authoritative
 * where it differs slightly from brief §21's approximate hexes, being the
 * later and more specific artifact (docs/DECISIONS.md).
 */
export const BRAND = {
  layover: "#4657E8",
  cloud: "#FAFAF8",
  white: "#FFFFFF",
  carryOn: "#202124",
  jetlag: "#6D7179",
  contrail: "#E6E7EA",
  // Semantic palette is independent of the brand hue (brief §21) and darker
  // than generic green/amber/red so it passes contrast on light surfaces.
  available: "#176B4D",
  maybe: "#996000",
  cant: "#B42318",
  unknown: "#6B7280",
  // Marketing surfaces only — never the logo, never routine buttons (§22).
  horizon: "linear-gradient(120deg, #4457E8 0%, #7767F1 52%, #55B7E8 100%)",
} as const;

/**
 * Söhne (the kit's display face) is a commercial Klim licence and needs a
 * separate webfont grant, so the site ships Inter — free, and already the
 * kit's body face — with Söhne first in the stack so it takes over
 * automatically if a licensed webfont is added later.
 */
export const FONT_STACK =
  '"Söhne", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
