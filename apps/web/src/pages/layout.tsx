import type { PropsWithChildren } from "hono/jsx";
import { html, raw } from "hono/html";
import { BRAND, FONT_STACK } from "../theme.js";

/**
 * Wordmark plus a geometric reading of the folded-T mark.
 *
 * PLACEHOLDER: this is an approximation drawn from the raster brand kit.
 * Export the real vector from the kit and drop it in — the shape should not
 * be reverse-engineered from a PNG for production.
 */
export function Logo({ height = 28 }: { height?: number }) {
  return (
    <span style={`display:inline-flex;align-items:center;gap:10px`}>
      <svg
        viewBox="0 0 120 120"
        width={height}
        height={height}
        aria-hidden="true"
        style="display:block"
      >
        <path
          d="M14 34C14 18 25 8 40 8c15 0 20 11 20 26v20H38C23 54 14 48 14 34Z"
          fill={BRAND.layover}
        />
        <path
          d="M106 34c0-16-11-26-26-26-15 0-20 11-20 26v20h22c15 0 24-6 24-20Z"
          fill={BRAND.layover}
        />
        <path d="M60 34v20H38Z" fill={BRAND.white} opacity="0.38" />
        <path
          d="M48 50h24v46c0 11-7 18-18 18-6 0-11-3-13-8"
          stroke={BRAND.layover}
          stroke-width="0"
          fill={BRAND.layover}
        />
      </svg>
      <span
        style={`font-size:${Math.round(height * 0.86)}px;font-weight:700;letter-spacing:-0.02em;color:${BRAND.carryOn}`}
      >
        timeaway
      </span>
    </span>
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
  children,
}: PropsWithChildren<{ title: string; description: string }>) {
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <style>
          ${raw(BASE_CSS)}
        </style>
      </head>
      <body>
        ${children}
      </body>
    </html>`;
}
