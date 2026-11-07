// Brinky's face, drawn live on top of the blank drop (mascot/blank.webp).
// One body, any expression, at any size: the eyes can blink, look around and close,
// so Brinky can show you where to look instead of telling you.
// Classic script → globalThis.BrinkyFace. Shared by the website, the extension pages and the in-page layer.
(() => {
  if (globalThis.BrinkyFace) return;
  const W = 1063, H = 989;
  // measured from the original render (eye ellipses, their tilt and highlight)
  const EYES = [
    { cx: 412.9, cy: 626.5, rx: 48.8, ry: 76.5, r: 14, hx: 441, hy: 582 },
    { cx: 789, cy: 662.7, rx: 45.4, ry: 74.2, r: 9.8, hx: 812, hy: 617 },
  ];
  const INK = "#0B0D11";
  // the drop's outline, traced from the render; clothes are clipped to it so they wrap the body
  const BODY = "M936 60 L911 41 L879 24 L840 12 L797 7 L759 8 L714 14 L671 24 L620 41 L527 85 L424 150 L319 230 L202 332 L126 408 L78 468 L37 540 L14 607 L7 651 L7 691 L17 747 L40 801 L77 852 L105 880 L151 915 L216 948 L254 961 L299 971 L364 979 L411 981 L597 978 L689 972 L756 964 L822 949 L873 930 L918 905 L953 878 L995 832 L1029 772 L1049 707 L1054 671 L1055 625 L1044 548 L1028 500 L1012 467 L968 402 L880 311 L867 283 L867 264 L876 246 L896 230 L951 204 L966 188 L976 167 L979 137 L973 111 L956 81Z";
  // clothes and hats. `in` is clipped to the body so it wraps the round shape; `on` sits on top of it (a hat).
  const OUTFITS = {
    // a chunky knit scarf, knotted at the side, tails resting on the ground
    scarf: { on: `<path d="M18 742C210 820 400 852 540 852S860 820 1044 732Q1062 790 1030 842C860 920 700 950 540 950S220 920 52 852Q8 800 18 742z" fill="#E4573F"/>
        <path d="M18 742C210 820 400 852 540 852S860 820 1044 732" fill="none" stroke="#F38A6E" stroke-width="18" stroke-linecap="round"/>
        <path d="M60 846C220 912 400 940 540 940S860 912 1024 836" fill="none" stroke="#B83D2B" stroke-width="16" stroke-linecap="round" opacity=".7"/>
        <path d="M130 820C260 868 400 892 540 892S820 868 960 806" fill="none" stroke="#C94632" stroke-width="10" stroke-linecap="round" stroke-dasharray="2 34" opacity=".55"/>
        <g transform="rotate(10 800 900)"><path d="M742 880Q800 862 858 880L874 1046Q806 1062 744 1046z" fill="#E4573F"/>
          <path d="M748 940Q806 928 866 940V978Q806 966 748 978z" fill="#FFF1DC"/><path d="M748 1006Q806 994 870 1006V1032Q806 1020 746 1034z" fill="#FFF1DC"/>
          <path d="M756 1048v34M784 1052v34M812 1052v34M840 1050v34M864 1046v32" stroke="#E4573F" stroke-width="12" stroke-linecap="round"/></g>
        <g transform="rotate(-6 690 900)"><path d="M650 886Q700 870 752 884L760 1020Q704 1034 652 1022z" fill="#D14A35"/>
          <path d="M654 930Q706 920 756 932V964Q706 954 654 966z" fill="#FBE6CC"/><path d="M654 988Q706 978 758 990V1010Q706 1000 654 1012z" fill="#FBE6CC"/>
          <path d="M662 1024v30M686 1028v30M710 1028v30M734 1026v30M754 1022v28" stroke="#D14A35" stroke-width="11" stroke-linecap="round"/></g>
        <path d="M690 842Q760 822 846 846Q872 900 840 934Q760 952 690 930Q664 884 690 842z" fill="#EE6A50"/>
        <path d="M704 860Q760 846 830 862" fill="none" stroke="#F79C82" stroke-width="12" stroke-linecap="round"/>` },
    // a proper office tie, knotted just under his mouth
    tie: { in: `<path d="M556 778H644L632 836H568z" fill="#1F2D52"/>
        <path d="M566 834H634L668 920 600 972 532 920z" fill="#2E4374"/>
        <path d="M566 834H634L668 920 600 972 532 920z" fill="none" stroke="#1F2D52" stroke-width="8" stroke-linejoin="round"/>
        <g stroke="#F2C14E" stroke-width="12" stroke-linecap="round"><path d="M560 870l60 40M548 912l66 46M606 846l42 28"/></g>
        <path d="M568 790H630" stroke="#3E5590" stroke-width="10" stroke-linecap="round"/>` },
    // a slouchy painter's beret on the top of his head
    beret: { on: `<g transform="translate(-20 80) rotate(-16 640 70)">
        <ellipse cx="652" cy="92" rx="214" ry="34" fill="#8C2B22"/>
        <path d="M420 76C380 -10 540 -70 700 -62C850 -54 940 0 906 72C880 108 760 110 640 106C520 102 430 104 420 76z" fill="#C8473A"/>
        <path d="M470 14C540 -30 660 -44 770 -32" fill="none" stroke="#E2705F" stroke-width="16" stroke-linecap="round"/>
        <path d="M668 -60q4-34 30-44" fill="none" stroke="#8C2B22" stroke-width="16" stroke-linecap="round"/></g>` },
  };
  const local = (e) => {
    const a = (-e.r * Math.PI) / 180, dx = e.hx - e.cx, dy = e.hy - e.cy;
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
  };
  let n = 0;
  const svg = () => {
    const id = `bf${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const clothes = Object.entries(OUTFITS).map(([k, v]) => v.in ? `<g class="bf-cl bf-cl-${k}">${v.in}</g>` : "").join("");
    const hats = Object.entries(OUTFITS).map(([k, v]) => v.on ? `<g class="bf-cl bf-cl-${k}">${v.on}</g>` : "").join("");
    const eyes = EYES.map((e) => {
      const [hx, hy] = local(e), w = e.rx * 0.92;
      return `<g transform="translate(${e.cx} ${e.cy}) rotate(${e.r})"><g class="bf-ball">
        <g class="bf-open"><ellipse rx="${e.rx + 3}" ry="${e.ry + 3}" fill="#0A4A9C" opacity=".32" filter="url(#${id}b)"/>
          <ellipse rx="${e.rx}" ry="${e.ry}" fill="url(#${id}g)"/>
          <ellipse cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" rx="${(e.rx * 0.2).toFixed(1)}" ry="${(e.ry * 0.17).toFixed(1)}" transform="rotate(18 ${hx.toFixed(1)} ${hy.toFixed(1)})" fill="#fff" opacity=".9" filter="url(#${id}s)"/></g>
        <path class="bf-shut" d="M${-w} 4 Q0 ${e.ry * 0.62} ${w} 4" fill="none" stroke="${INK}" stroke-width="31" stroke-linecap="round"/>
        <path class="bf-happy" d="M${-w} 24 Q0 ${-e.ry * 0.72} ${w} 24" fill="none" stroke="${INK}" stroke-width="31" stroke-linecap="round"/>
      </g></g>`;
    }).join("");
    return `<svg class="bf-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
      <defs><radialGradient id="${id}g" cx=".62" cy=".74" r=".8"><stop offset="0" stop-color="#3A3F49"/><stop offset=".5" stop-color="#14161B"/><stop offset="1" stop-color="#050608"/></radialGradient>
        <filter id="${id}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
        <filter id="${id}b" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
        <clipPath id="${id}c"><path d="${BODY}"/></clipPath>
        <linearGradient id="${id}sh" x1="0" y1="0" x2=".35" y2="1"><stop offset=".45" stop-color="#0A2850" stop-opacity="0"/><stop offset="1" stop-color="#0A2850" stop-opacity=".22"/></linearGradient></defs>
      <g class="bf-clothes" clip-path="url(#${id}c)">${clothes}<rect class="bf-shade" x="0" y="740" width="1063" height="249" fill="url(#${id}sh)"/></g>${hats}
      <g class="bf-think" fill="#FFFFFF" stroke="#1A1D23" stroke-opacity=".14" stroke-width="5"><circle cx="300" cy="430" r="20"/><circle cx="236" cy="338" r="30"/>
        <path d="M60 230c-30-60 40-110 90-80 20-50 110-50 130 0 50-20 110 30 80 80 40 40-10 100-60 80-30 40-120 40-150 0-60 20-120-40-90-80z"/>
        <g fill="#1A1D23" fill-opacity=".55" stroke="none"><circle cx="150" cy="215" r="12"/><circle cx="200" cy="215" r="12"/><circle cx="250" cy="215" r="12"/></g></g>
      <g class="bf-sweat"><path d="M912 420c12 20 24 34 24 48a24 24 0 0 1-48 0c0-14 12-28 24-48z" fill="#E4F6FF" stroke="#9ACDF3" stroke-width="6"/>
        <path d="M862 360c8 13 16 22 16 31a16 16 0 0 1-32 0c0-9 8-18 16-31z" fill="#E4F6FF" stroke="#9ACDF3" stroke-width="5"/></g>
      <g class="bf-eyes">${eyes}
        <g class="bf-glasses" fill="none" stroke="#1A1D23" stroke-width="15"><circle cx="412.9" cy="626.5" r="100" fill="#FFFFFF" fill-opacity=".14"/><circle cx="789" cy="662.7" r="96" fill="#FFFFFF" fill-opacity=".14"/>
          <path d="M512 622Q600 588 694 646M313 606L250 590M884 650L944 640" stroke-linecap="round"/></g>
        <g fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round">
          <path class="bf-brow bf-worry" d="M336 515Q392 502 456 468M744 504Q802 512 866 542"/>
          <path class="bf-brow bf-raise" d="M330 498Q392 452 462 478M742 538Q800 530 862 538"/></g></g>
      <g class="bf-mouthg">
        <path class="bf-smile" d="M533 688Q602 756 671 688" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
        <path class="bf-soft" d="M562 700Q602 734 642 700" fill="none" stroke="${INK}" stroke-width="28" stroke-linecap="round"/>
        <path class="bf-laugh" d="M526 682Q602 800 678 682Q602 706 526 682z" fill="${INK}" stroke="${INK}" stroke-width="14" stroke-linejoin="round"/>
        <ellipse class="bf-o" cx="602" cy="716" rx="30" ry="38" fill="${INK}"/>
        <path class="bf-wavy" d="M546 716q19-18 38 0t38 0 38 0" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
        <path class="bf-hmm" d="M572 722Q616 706 660 716" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round"/>
      </g></svg>`;
  };
  const css = `
.bf{position:relative;aspect-ratio:${W}/${H};user-select:none;-webkit-user-select:none}
.bf>img,.bf>.bf-svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.bf>img{filter:drop-shadow(0 6% 10% rgba(10,80,170,.18))}
.bf .bf-eyes,.bf .bf-mouthg{transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.bf .bf-eyes{transform:translate(calc(var(--lx,0) * 46px),calc(var(--ly,0) * 30px))}
.bf .bf-mouthg{transform:translate(calc(var(--lx,0) * 24px),calc(var(--ly,0) * 15px))}
.bf .bf-ball{transform-box:fill-box;transform-origin:50% 50%;transition:transform .09s ease-in}
.bf.blink .bf-ball{transform:scaleY(.07);transition-duration:.08s}
.bf>img,.bf>.bf-svg{transition:scale .16s ease}
.bf.blink>img,.bf.blink>.bf-svg{scale:1.012 .975}
/* the whole drop leans toward what it's looking at */
.bf.lean{transition:transform .9s cubic-bezier(.2,.8,.2,1);transform:translate(calc(var(--lx,0) * var(--lean,16px)),calc(var(--ly,0) * var(--lean,16px) * .45)) rotate(calc(var(--lx,0) * 4deg))}
.bf .bf-open,.bf .bf-shut,.bf .bf-happy,.bf .bf-smile,.bf .bf-soft,.bf .bf-laugh,.bf .bf-o{transition:opacity .25s ease}
.bf .bf-shut,.bf .bf-happy,.bf .bf-soft,.bf .bf-laugh,.bf .bf-o,.bf .bf-wavy,.bf .bf-hmm,.bf .bf-brow,.bf .bf-glasses,.bf .bf-sweat,.bf .bf-think,.bf .bf-cl,.bf .bf-shade{opacity:0;transition:opacity .45s ease}
.bf>.bf-svg{overflow:visible}
.bf[data-outfit~="scarf"] .bf-cl-scarf,.bf[data-outfit~="tie"] .bf-cl-tie,.bf[data-outfit~="beret"] .bf-cl-beret{opacity:1}
.bf[data-outfit~="tie"] .bf-shade{opacity:.5}
.bf[data-glasses="1"] .bf-glasses{opacity:1}
.bf[data-mood="stressed"] .bf-smile,.bf[data-mood="thinking"] .bf-smile{opacity:0}
.bf[data-mood="stressed"] .bf-wavy,.bf[data-mood="stressed"] .bf-worry,.bf[data-mood="stressed"] .bf-sweat{opacity:1}
.bf[data-mood="thinking"] .bf-hmm,.bf[data-mood="thinking"] .bf-raise,.bf[data-mood="thinking"] .bf-think{opacity:1}
.bf .bf-sweat{animation:bf-drip 2.4s ease-in infinite}
@keyframes bf-drip{0%,30%{transform:none}90%{transform:translateY(46px)}100%{transform:translateY(46px);opacity:0}}
.bf .bf-think circle{animation:bf-bob 2.6s ease-in-out infinite alternate}
@keyframes bf-bob{to{transform:translateY(-10px)}}
.bf[data-mood="calm"] .bf-open,.bf[data-mood="sleepy"] .bf-open,.bf[data-mood="happy"] .bf-open,.bf[data-mood="laugh"] .bf-open{opacity:0}
.bf[data-mood="calm"] .bf-shut,.bf[data-mood="sleepy"] .bf-shut{opacity:1}
.bf[data-mood="happy"] .bf-happy,.bf[data-mood="laugh"] .bf-happy{opacity:1}
.bf[data-mood="calm"] .bf-smile,.bf[data-mood="sleepy"] .bf-smile,.bf[data-mood="laugh"] .bf-smile,.bf[data-mood="surprised"] .bf-smile{opacity:0}
.bf[data-mood="calm"] .bf-soft,.bf[data-mood="sleepy"] .bf-soft{opacity:1}
.bf[data-mood="laugh"] .bf-laugh{opacity:1}
.bf[data-mood="surprised"] .bf-o{opacity:1}
.bf[data-mood="surprised"] .bf-ball{transform:scale(1.1)}
.bf[data-mood="sleepy"] .bf-eyes{transform:translateY(10px)}
.bf.breathe>img,.bf.breathe>.bf-svg{animation:bf-breathe 4.8s ease-in-out infinite alternate;transform-origin:50% 100%}
@keyframes bf-breathe{to{transform:scale(1.012,.988)}}
@media (prefers-reduced-motion:reduce){.bf *{transition:none!important;animation:none!important}}`;

  function mount(host, { src, mood = "neutral", breathe = true, label = "", lean = false, outfit = "none", glasses = false } = {}) {
    const el = document.createElement("div");
    el.className = "bf" + (breathe ? " breathe" : "") + (lean ? " lean" : "");
    el.dataset.mood = mood; el.dataset.outfit = outfit; el.dataset.glasses = glasses ? "1" : "0";
    if (label) { el.setAttribute("role", "img"); el.setAttribute("aria-label", label); }
    el.innerHTML = `<img alt="" src="${src}" draggable="false">${svg()}`;
    host.appendChild(el);
    let bt = 0, followOn = false, raf = 0, px = 0, py = 0, alive = true;
    const api = {
      el,
      look(x, y) { el.style.setProperty("--lx", Math.max(-1, Math.min(1, x)).toFixed(3)); el.style.setProperty("--ly", Math.max(-1, Math.min(1, y)).toFixed(3)); return api; },
      mood(m) { el.dataset.mood = m; return api; },
      outfit(o = "none") { el.dataset.outfit = o; return api; },
      glasses(on) { el.dataset.glasses = on ? "1" : "0"; return api; },
      blink(twice) {
        if (el.dataset.mood !== "neutral" && el.dataset.mood !== "surprised") return api;
        el.classList.add("blink");
        setTimeout(() => { el.classList.remove("blink"); if (twice) setTimeout(() => api.blink(), 180); }, 150);
        api.onblink?.();
        return api;
      },
      autoBlink(on = true) {
        clearTimeout(bt);
        if (!on) return api;
        const next = () => { bt = setTimeout(() => { if (!alive) return; api.blink(Math.random() < 0.18); next(); }, 2600 + Math.random() * 3600); };
        next(); return api;
      },
      // eyes follow the pointer (within this document), eased on the compositor
      follow(on = true) {
        followOn = on;
        if (on && !api._fl) {
          api._fl = (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(aim); };
          addEventListener("pointermove", api._fl, { passive: true });
        } else if (!on && api._fl) { removeEventListener("pointermove", api._fl); api._fl = null; api.look(0, 0); }
        return api;
      },
      destroy() { alive = false; clearTimeout(bt); api.follow(false); el.remove(); },
    };
    const aim = () => {
      raf = 0; if (!followOn) return;
      const r = el.getBoundingClientRect(), cx = r.left + r.width * 0.56, cy = r.top + r.height * 0.66;
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / (Math.max(innerWidth, innerHeight) * 0.45));
      api.look((dx / d) * k, (dy / d) * k);
    };
    return api;
  }
  // put the stylesheet into a document or a shadow root once
  function style(root = document.head) {
    if (root.querySelector?.("style[data-bf]")) return;
    const s = document.createElement("style"); s.dataset.bf = ""; s.textContent = css; root.appendChild(s);
  }
  globalThis.BrinkyFace = { mount, style, css, svg, W, H };
})();
