// Small line icons (SF Symbols-like) and the three water-style illustrations. ES module.
const s = (d, w = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  eye: s('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  blink: s('<path d="M3 10.5c2.6 3.4 5.6 5 9 5s6.4-1.6 9-5"/><path d="M6.5 14.2l-1.3 2M12 15.6v2.3M17.5 14.2l1.3 2"/>'),
  drop: s('<path d="M12 3.2c3.6 4.2 6 7.6 6 10.6a6 6 0 0 1-12 0c0-3 2.4-6.4 6-10.6z"/>'),
  stretch: s('<circle cx="12" cy="4.6" r="1.9"/><path d="M12 7.8v7M12 14.8l-3 6M12 14.8l3 6M12 9.6L7 4.8M12 9.6l5-4.8"/>'),
  moon: s('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"/>'),
  gear: s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', 1.6),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
  back: s('<path d="M15 5l-7 7 7 7"/>', 2.2),
  chev: s('<path d="M9 5l7 7-7 7"/>', 2),
  snow: s('<path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5L4.2 17.5"/><path d="M9.5 3.8L12 6l2.5-2.2M9.5 20.2L12 18l2.5 2.2"/>'),
  power: s('<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>'),
  list: s('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  sound: s('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  paint: s('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>'),
  person: s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  heart: s('<path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.7 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.5 3.2 4.3 6.3C19.5 15.4 12 20 12 20z"/>'),
};

// three water styles, drawn small
export const STYLE_ART = {
  wave: `<svg viewBox="0 0 96 46" aria-hidden="true"><defs><clipPath id="sa-w"><rect x="1" y="1" width="94" height="44" rx="7"/></clipPath></defs>
    <rect x="1" y="1" width="94" height="44" rx="7" fill="var(--glass-2)"/>
    <g clip-path="url(#sa-w)">
      <path d="M-4 27C10 25 20 30 34 28S58 23 72 27 92 30 100 26V46H-4z" fill="#5BB6F0" opacity=".55"/>
      <path d="M-4 27C10 25 20 30 34 28S58 23 72 27 92 30 100 26" fill="none" stroke="#fff" stroke-width="1.6"/>
      <g fill="#fff" opacity=".8"><circle cx="12" cy="29.5" r=".9"/><circle cx="28" cy="30.5" r=".7"/><circle cx="52" cy="27.5" r="1"/><circle cx="66" cy="29.5" r=".7"/><circle cx="84" cy="30.5" r=".9"/></g>
      <path d="M44 23c2.6-3 4.6-5.4 4.6-7.4a4.6 4.6 0 1 0-9.2 0c0 2 2 4.4 4.6 7.4z" fill="#5BB6FF"/><circle cx="42" cy="14.5" r="1" fill="#0b2340"/><circle cx="46" cy="14.5" r="1" fill="#0b2340"/>
    </g><rect x="1" y="1" width="94" height="44" rx="7" fill="none" stroke="var(--hair)"/></svg>`,
  tumbler: `<svg viewBox="0 0 96 46" aria-hidden="true"><rect x="1" y="1" width="94" height="44" rx="7" fill="var(--glass-2)" stroke="var(--hair)"/>
    <g transform="translate(37 7)"><defs><clipPath id="sa-g"><path d="M1 1h14l-1.6 19q-.2 1.8-2 1.8H4.6q-1.8 0-2-1.8z"/></clipPath></defs>
      <path d="M1 1h14l-1.6 19q-.2 1.8-2 1.8H4.6q-1.8 0-2-1.8z" fill="#fff" fill-opacity=".8"/>
      <rect x="0" y="8" width="16" height="16" fill="#2F96F5" fill-opacity=".85" clip-path="url(#sa-g)"/>
      <path d="M1 1h14l-1.6 19q-.2 1.8-2 1.8H4.6q-1.8 0-2-1.8z" fill="none" stroke="var(--fg)" stroke-opacity=".5" stroke-width=".9"/>
      <path d="M3.6 3.5l.9 14" stroke="#fff" stroke-width="1" stroke-linecap="round"/></g>
    <path d="M58 26v12l3-3 2 4 2-1-2-4h4z" fill="var(--fg)" stroke="var(--glass-2)" stroke-width=".8"/></svg>`,
  card: `<svg viewBox="0 0 96 46" aria-hidden="true"><rect x="1" y="1" width="94" height="44" rx="7" fill="var(--glass-2)" stroke="var(--hair)"/>
    <rect x="34" y="7" width="56" height="22" rx="6" fill="var(--bg)" stroke="var(--hair)"/>
    <path d="M44 23c2-2.4 3.4-4.2 3.4-5.6a3.4 3.4 0 1 0-6.8 0c0 1.4 1.4 3.2 3.4 5.6z" fill="#2F96F5"/>
    <rect x="51" y="13" width="30" height="3" rx="1.5" fill="var(--fg)" opacity=".7"/><rect x="51" y="19" width="22" height="3" rx="1.5" fill="var(--fg)" opacity=".3"/>
    <rect x="51" y="33" width="18" height="6" rx="3" fill="#1E8FF2"/><rect x="72" y="33" width="14" height="6" rx="3" fill="var(--fg)" opacity=".15"/></svg>`,
};
