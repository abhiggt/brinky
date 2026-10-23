// Brinky, the blink-and-drink water drop. Classic script → globalThis.BrinkyMascot
// (content scripts, popup, break page, welcome).
(() => {
  // one sprite per mood in mascot/<mood>.webp (300×252; the original PNGs are in art/). "curious" and "thirsty" borrow a neighbouring face.
  const MOODS = ["happy", "blink", "calm", "proud", "excited", "surprised", "smug", "wink", "worried", "sleepy", "blank"];
  const ALIAS = { thirsty: "worried", curious: "surprised" };
  const RATIO = 252 / 300; // height / width
  const mood = (m) => (MOODS.includes(ALIAS[m] || m) ? ALIAS[m] || m : "happy");

  // The sprites are web-accessible only through Chrome's per-session dynamic URL (use_dynamic_url),
  // so pages can't probe a fixed address to detect Brinky.
  const cache = {};
  const url = (m) => {
    const k = mood(m);
    if (cache[k]) return cache[k];
    let u = `mascot/${k}.webp`;
    try { u = chrome.runtime.getURL(u); } catch {}
    return (cache[k] = u);
  };

  function html({ mood: m = "happy", size = 64, cls = "" } = {}) {
    const k = mood(m);
    return `<img class="brinky-m ${cls}" src="${url(k)}" data-mood="${k}" width="${size}" height="${Math.round(size * RATIO)}" alt="" draggable="false">`;
  }
  function set(img, m) { const k = mood(m); if (img && img.dataset.mood !== k) { img.dataset.mood = k; img.src = url(k); } }
  // fetch and decode ahead of time, so a face never pops in late
  function preload(list = MOODS) { return list.map((m) => { const i = new Image(); i.src = url(m); i.decode?.().catch(() => {}); return i; }); }

  // any happy Brinky inside `root` blinks every few seconds
  function blink(root = document) {
    const tick = () => {
      root.querySelectorAll("img.brinky-m[data-mood='happy']").forEach((img) => {
        img.src = url("blink");
        setTimeout(() => { if (img.dataset.mood === "happy") img.src = url("happy"); }, 150);
      });
      setTimeout(tick, 3200 + Math.random() * 2600);
    };
    preload(["blink"]);
    setTimeout(tick, 2500);
  }

  // What Brinky says in the popup. Friendly, never scolding.
  function line(c) {
    const h = new Date().getHours(), g = c.glasses, goal = c.goal;
    const n = String(c.name || "").trim(), you = n ? `, ${n}` : "";
    if (!c.enabled) return { mood: "sleepy", text: "I'm switched off. Wake me whenever you're ready." };
    if (c.asleep) return { mood: "sleepy", text: `Off duty until ${c.wakeAt}. Enjoy your time${you}.` };
    if (c.paused) return { mood: "calm", text: c.pausedUntil ? `Taking it easy until ${c.pausedUntil}.` : "Paused until you need me." };
    if (c.quiet) return { mood: "calm", text: `${c.quiet}. Reminders are resting.` };
    if (c.onBreak) return { mood: "calm", text: "Eyes off the screen. I'll chime when it's time." };
    if (c.waiting === "call" || c.waiting === "sharing") return { mood: "wink", text: "You're in a call, so I'm keeping quiet. Break right after." };
    if (c.waiting === "video" || c.waiting === "fullscreen") return { mood: "calm", text: "Enjoy the video. I'll wait until it's done." };
    if (c.waiting === "focus") return { mood: "calm", text: "You're in a focus site. I'll wait for a natural pause." };
    if (c.waiting === "away") return { mood: "sleepy", text: "Looks like you stepped away. Time away counts as a break." };
    if (c.breakSoon) return { mood: "surprised", text: "Eye break coming up. Finish that thought." };
    if (goal && g >= goal) return { mood: "excited", text: `${g} of ${goal} glasses. Hydration hero${you}! Waves are resting.` };
    if (c.justDrank) return { mood: "proud", text: `Glug glug${you}. That's ${g} today.` };
    if (c.sinceRest >= 60) return { mood: "worried", text: `${c.sinceRest} minutes since your last real rest. Look out of a window?` };
    if (c.waterOn && c.waterSoonMin != null && c.waterSoonMin <= 3) return { mood: "curious", text: "Feeling thirsty... a wave is on its way." };
    if (goal && c.expected - g >= 2) return { mood: "worried", text: `${c.expected - g} glasses behind the day so far. One now?` };
    if (c.tip) return { mood: "wink", text: c.tip };
    if (c.streak >= 2) return { mood: "wink", text: `${c.streak} days in a row on your water goal. Nice${you}.` };
    if (h < 5) return { mood: "sleepy", text: `It's late${you}. Your eyes would love some sleep.` };
    if (h < 12) return { mood: "happy", text: `Good morning${you}. Blink, drink, repeat.` };
    if (h < 17) return { mood: "happy", text: `Afternoon slump${you}? A sip and a long look outside help.` };
    return { mood: "happy", text: `Evening${you}. Screens dry eyes out, so blink slowly.` };
  }

  globalThis.BrinkyMascot = { MOODS, RATIO, url, html, set, preload, blink, line, mood };
})();
