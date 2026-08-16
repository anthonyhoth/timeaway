/**
 * Scroll-driven hero narrative: unresolved chat → the sphere → resolved trip.
 *
 * The reference (amra.com) achieves its "3D" look with a large soft gradient
 * orb rather than a rendered mesh, so this is built the same way — layered
 * radial gradients on a circle, driven by scroll progress. No WebGL, no build
 * step, and it degrades to a static composition when JavaScript is off or the
 * visitor prefers reduced motion.
 */
import { BRAND } from "../theme.js";

/** Real phrasing from the product's own Singlish grammar, not lorem ipsum. */
export const CHAT_BUBBLES: {
  text: string;
  side: "l" | "r";
  x: number;
  y: number;
  z: number;
  delay: number;
}[] = [
  { text: "eh when are you all free?", side: "l", x: -24, y: -34, z: 40, delay: 0 },
  { text: "cmi october", side: "r", x: 30, y: -12, z: 100, delay: 0.7 },
  { text: "roster not out yet leh", side: "l", x: -30, y: 6, z: 0, delay: 1.4 },
  { text: "only got 2 days AL", side: "r", x: 28, y: 14, z: 70, delay: 2.1 },
  { text: "december can?", side: "l", x: -14, y: 30, z: 130, delay: 2.8 },
];

export const HERO_CSS = `
/* Progressive enhancement: the orb and its scroll choreography only exist
   when JS runs. Without it, the two orb-backed acts paint their own gradient
   so white text stays readable instead of vanishing into the page. */
.stage{display:none}
#act-sphere,#act-result{background:${BRAND.horizon}}
.js .stage{display:block;position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.js #act-sphere,.js #act-result{background:none}

/* The orb. A hard circular edge with a soft interior, exactly like the
   reference — the depth comes from layered gradients, not geometry. */
.orb{
  position:absolute;left:50%;top:50%;
  width:min(150vmax,1500px);aspect-ratio:1;border-radius:50%;
  background:
    radial-gradient(circle at 30% 22%, rgba(255,255,255,.55), rgba(255,255,255,0) 42%),
    radial-gradient(circle at 72% 34%, #7767F1 0%, rgba(119,103,241,0) 55%),
    radial-gradient(circle at 38% 74%, #55B7E8 0%, rgba(85,183,232,0) 58%),
    radial-gradient(circle at 50% 50%, #4457E8 0%, #4457E8 60%, #3D4FD6 100%);
  /* translate only — scaling a gradient this large forces a full repaint
     every frame, which is what made the scroll feel steppy. */
  transform:translate3d(-50%,-50%,0) translateY(var(--orb-y,70vh));
  opacity:var(--orb-o,1);
  will-change:transform;
  contain:paint;
}
/* Slow internal drift gives the "Siri" feeling without spinning the element. */
.orb::after{
  content:"";position:absolute;inset:0;border-radius:50%;
  background:
    conic-gradient(from 0deg at 46% 44%,
      rgba(85,183,232,.42), rgba(119,103,241,.30), rgba(68,87,232,.10),
      rgba(85,183,232,.42));
  mix-blend-mode:screen;filter:blur(42px);opacity:.7;
  animation:orbspin 48s linear infinite;
  will-change:transform;
}
@keyframes orbspin{to{transform:rotate(360deg)}}

.scene{position:relative;z-index:1;min-height:100svh;display:flex;
  flex-direction:column;align-items:center;justify-content:center;
  padding:80px 24px;text-align:center}

/* --- Act one: unresolved --------------------------------------------- */
.bubbles{position:relative;width:min(760px,100%);height:min(52vh,400px);
  perspective:1100px;margin:22px 0 34px}
.bubble{
  position:absolute;
  left:calc(50% + (var(--bx) * 1%));
  top:calc(50% + (var(--by) * 1%));
  padding:13px 19px;border-radius:20px;font-size:15px;font-weight:500;
  background:${BRAND.white};border:1px solid ${BRAND.contrail};
  color:${BRAND.carryOn};white-space:nowrap;
  box-shadow:0 18px 40px -22px rgba(32,33,36,.4);
  transform:
    translate(-50%,-50%)
    translate3d(0, var(--drift,0px), calc(var(--bz) * 1px))
    rotateX(calc(var(--by) * -.16deg)) rotateY(calc(var(--bx) * .18deg));
  opacity:var(--bubble-o,1);
  animation:float 7s ease-in-out infinite;animation-delay:var(--bd);
  will-change:transform,opacity;
}
.bubble.r{border-color:#D9DEFB;background:#F4F6FE}
@keyframes float{
  0%,100%{--drift:0px}
  50%{--drift:-14px}
}
@property --drift{syntax:'<length>';inherits:false;initial-value:0px}

/* --- Act two: the sphere --------------------------------------------- */
.on-orb{color:#fff;max-width:660px}
.on-orb h2{font-size:clamp(30px,5.2vw,52px);color:#fff}
.on-orb p{font-size:clamp(17px,2.2vw,21px);opacity:.92;margin-top:20px}

/* --- Act three: resolved --------------------------------------------- */
.result{
  width:min(430px,100%);padding:32px;border-radius:26px;
  background:${BRAND.white};border:1px solid ${BRAND.contrail};
  box-shadow:0 50px 90px -50px rgba(32,33,36,.55);
  text-align:left;perspective:900px;
  transform:none;
  opacity:1;transform-style:preserve-3d;
  will-change:transform,opacity;
}

/* Only animate the card in once JS is driving the scroll progress. */
.js .result{
  transform:translateY(var(--res-y,40px)) rotateX(var(--res-r,9deg));
  opacity:var(--res-o,0);
}

@media (prefers-reduced-motion:reduce){
  .bubble{animation:none}
  .orb::after{animation:none}
  .js .result{transform:none;opacity:1}
}
`;

export const HERO_SCRIPT = `
(function(){
  document.documentElement.classList.add('js');
  var root = document.documentElement;
  if(!document.querySelector('.orb')) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ids = ['act-hero','act-sphere','act-result'];
  var els = ids.map(function(id){ return document.getElementById(id); });
  var card = document.querySelector('.result');
  var bubbles = Array.prototype.slice.call(document.querySelectorAll('.bubble'));

  // Measure once and on resize. Reading getBoundingClientRect every frame
  // forces a layout flush per frame, which shows up as scroll jank.
  var boxes = [];
  function measure(){
    boxes = els.map(function(el){
      if(!el) return { top: 0, height: 1 };
      var r = el.getBoundingClientRect();
      return { top: r.top + window.scrollY, height: r.height };
    });
  }
  measure();
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);

  function clamp(v){ return v < 0 ? 0 : v > 1 ? 1 : v; }
  function progress(box, scrollY, vh){
    return clamp((scrollY + vh - box.top) / (vh + box.height));
  }

  // Damped follow. The reference gets its glide from Lenis interpolating the
  // scroll position; easing our own progress values gets the same feel
  // without hijacking native scrolling (and without the a11y trade-offs).
  var cur = [0, 0, 0];
  var EASE = reduce ? 1 : 0.11;
  var last = '';

  function frame(){
    var scrollY = window.scrollY;
    var vh = window.innerHeight;

    for(var i = 0; i < 3; i++){
      var target = progress(boxes[i], scrollY, vh);
      cur[i] += (target - cur[i]) * EASE;
    }
    var pHero = cur[0], pSphere = cur[1], pResult = cur[2];

    // Position only — the orb is a fixed size and simply travels past.
    var y = 84 - pSphere * 150;
    var fade = clamp((pHero - 0.55) * 3);
    var settle = clamp((pResult - 0.25) * 2.6);

    // One string compare avoids redundant style writes on idle frames.
    var sig = y.toFixed(2) + '|' + fade.toFixed(3) + '|' + settle.toFixed(3);
    if(sig !== last){
      last = sig;
      root.style.setProperty('--orb-y', y.toFixed(2) + 'vh');
      root.style.setProperty('--orb-o', (1 - pResult * 0.4).toFixed(3));
      for(var b = 0; b < bubbles.length; b++){
        bubbles[b].style.setProperty('--bubble-o', (1 - fade).toFixed(3));
      }
      if(card){
        root.style.setProperty('--res-o', settle.toFixed(3));
        root.style.setProperty('--res-y', (40 - settle * 40).toFixed(1) + 'px');
        root.style.setProperty('--res-r', (9 - settle * 9).toFixed(2) + 'deg');
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
`;
