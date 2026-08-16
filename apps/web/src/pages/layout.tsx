import type { PropsWithChildren } from "hono/jsx";
import { html, raw } from "hono/html";
import { ASSETS_VERSION } from "../assets/generated.js";
import { BRAND, FONT_STACK } from "../theme.js";

/**
 * The real logo, cropped from timeaway-brand-kit.png and served from
 * /assets — never redrawn. Using the kit's own wordmark also sidesteps the
 * Söhne licensing question, since the lettering ships as artwork rather than
 * as live text in a font we don't hold a webfont grant for.
 *
 * The crops keep the kit's Cloud background, which matches the page canvas.
 */
export function Logo({ height = 30 }: { height?: number }) {
  // Cropped mark is 140×130, wordmark 396×88 — tight bounds from the kit,
  // background removed. Keeping both to their source
  // aspect preserves the optical balance the kit already struck.
  const markWidth = Math.round(height * (140 / 130));
  const wordHeight = Math.round(height * (88 / 130));
  const wordWidth = Math.round(wordHeight * (396 / 88));
  return (
    <a
      href="/"
      style="display:inline-flex;align-items:center;gap:10px;text-decoration:none"
      aria-label="Timeaway home"
    >
      <img
        src={`/assets/mark.png?v=${ASSETS_VERSION}`}
        alt=""
        width={markWidth}
        height={height}
        style="display:block"
      />
      <img
        src={`/assets/wordmark.png?v=${ASSETS_VERSION}`}
        alt="Timeaway"
        width={wordWidth}
        height={wordHeight}
        style="display:block"
      />
    </a>
  );
}

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:${FONT_STACK};color:${BRAND.carryOn};background:${BRAND.cloud};
  -webkit-font-smoothing:antialiased;line-height:1.6}
h1,h2,h3{margin:0;letter-spacing:-0.03em;line-height:1.08;font-weight:700}
p{margin:0}
a{color:inherit}
.wrap{max-width:1080px;margin:0 auto;padding:0 24px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  border-radius:14px;padding:15px 26px;font-size:16px;font-weight:600;
  text-decoration:none;border:1px solid transparent;cursor:pointer;
  transition:transform .12s ease,opacity .12s ease}
.btn:active{transform:scale(.985)}
.btn-primary{background:${BRAND.layover};color:#fff}
.btn-primary:hover{opacity:.92}
.btn-ghost{background:transparent;color:${BRAND.layover};border-color:${BRAND.contrail}}
.btn-ghost:hover{border-color:${BRAND.layover}}
.card{background:${BRAND.white};border:1px solid ${BRAND.contrail};border-radius:20px;padding:26px}
.muted{color:${BRAND.jetlag}}
.chip{display:inline-flex;align-items:center;gap:7px;border-radius:999px;
  padding:6px 13px;font-size:14px;font-weight:600}
input[type=email]{font-family:inherit;font-size:16px;padding:14px 16px;border-radius:14px;
  border:1px solid ${BRAND.contrail};background:#fff;color:inherit;width:100%;outline:none}
input[type=email]:focus{border-color:${BRAND.layover};box-shadow:0 0 0 3px rgba(70,87,232,.14)}
@media (max-width:720px){.wrap{padding:0 18px}}
`;

export function Layout({
  title,
  description,
  extraCss,
  script,
  children,
}: PropsWithChildren<{
  title: string;
  description: string;
  /** Page-specific CSS appended after the base sheet. */
  extraCss?: string;
  /** Page-specific JS, run after the DOM is parsed. */
  script?: string;
}>) {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <meta name="description" content="${description}" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:type" content="website" />
        <meta name="theme-color" content="${BRAND.layover}" />
        <link rel="icon" type="image/png" href="/assets/icon.png?v=${ASSETS_VERSION}" />
        <link rel="apple-touch-icon" href="/assets/icon.png?v=${ASSETS_VERSION}" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>
          ${raw(BASE_CSS)}${raw(extraCss ?? "")}
        </style>
      </head>
      <body>
        ${children}
        ${script ? html`<script>${raw(script)}</script>` : ""}
      </body>
    </html>`;
}
