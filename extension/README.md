# Brinky 3.1: Blink & Drink breaks

Brinky is a little water drop who lives in your Chrome toolbar. It reminds you to rest your eyes (20-20-20) and to drink water, and it stays out of the way when you're busy.

## Install
1. Unzip `brinky-3.1.0.zip` into a folder you'll keep (Chrome loads it from there).
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick that folder (the one with `manifest.json` in it).
4. Pin Brinky from the puzzle-piece menu. The welcome tour opens by itself.

Chrome 130 or newer. If you had Blinky 2.x or Brinky 3.0 loaded, remove it first or load this over the same folder: your settings carry over.

## What Brinky does
- **Eye breaks.** Every 20 minutes, a 20-second look-away. After 2.5 s the screen fades to near-black, so there's nothing to watch; a chime marks the end. Skip is press-and-hold (Skip or Esc), so reflexes don't throw breaks away. After two snoozes in a row, the break happens.
- **Movement breaks.** Every third break is 2 minutes of off-screen moves. Brinky acts out each one inside the ring (tilting for the neck stretch, blinking for slow blinks, rising for the reach), with big clear steps and what's up next.
- **Work mode.** One switch in the popup: fewer, longer breaks for deep work (50 minutes focus, 5 minutes break by default; 25/5, 50/10 and 90/15 one tap away). The 20-second look-aways become a quiet note by your cursor every 20 minutes, so your eyes still get their rest without the screen being covered. Long breaks get up to 8 guided moves, then free time until the chime.
- **Water.** A wave (or a quiet sip card) in the tab you're looking at, paced to your daily goal across your working day, sooner if you fall behind. Unanswered reminders back off (15 → 30 → 45 min); after your goal, they rest.
- **When water and a break meet, they become one moment.** Water due within 10 minutes of a break is asked for during the break ("Glass 3 of 8 today", with "I had a glass" up front). A break that arrives while a wave is on screen carries the water question with it. Water also joins a break that's already running, and never splashes in right after one.
- **Nudges where you're looking.** The toolbar Brinky blinks every 15 minutes. A posture note appears beside your cursor every 45 and follows it for a few seconds. In the last 10 seconds before a break, a small countdown follows your cursor too.
- **Quiet when you're busy.** Breaks and reminders wait while any tab uses your camera or microphone or shares your screen, while you watch a video, in fullscreen, and mid-sentence (typing in editors counts). After a call of 30+ minutes, Brinky suggests a short break.
- **Only for someone who's looking.** Nothing starts on a locked screen or while you're away. Working in another app? You get a system notification instead of a hidden overlay. Breaks count as taken only if you saw them; 3+ minutes away counts as rest.
- **Your name.** Tell Brinky in the welcome tour or Settings and it greets you by name in the popup, on breaks, in water reminders and notifications.

## Never late
Fifteen seconds before a break, Brinky "arms" the tab you're on: it loads the break screen, works out its look, decodes the faces and rehearses the first frame invisibly. When the moment comes, that tab starts the break by itself and only then tells the rest of Brinky, so the break doesn't wait for anything: not the background (even if Chrome has put it to sleep), not other tabs, not storage. In testing it was on screen 7–17 ms after it was due, about one screen refresh, including with a heavy page busy in another tab (3.0 was about 1.9 s late there) and with the background asleep (9 ms).

Brinky is also lighter: each page loads 17 KB of Brinky instead of 74 KB; the break screen and water wave (37 KB) load only when they're about to appear. Breaks are sent to the tab in front first; every other tab is told without waiting for an answer.

## Settings
- **Popup → Settings** has the basics: your name, Work mode, movement breaks, water goal and style, nudges, quiet in calls, sounds and working hours.
- **SuperBrink settings** open on their own page: every timing, the heads-up and cursor countdown, snooze limit, focus and call sites, quiet times (lunch), the break screen's look and sounds, breathing guide, messages, water pacing and wave details, units, evening tint, and your data (tour, CSV export, resets). They take effect only while **SuperBrink mode** is on; off means Brinky's recommended settings.

## Shortcuts
Alt+Shift+B break now · Alt+Shift+P pause · Alt+Shift+S snooze 5 min · Alt+Shift+W log a glass

## Limits
Chrome doesn't let extensions draw over its own tab strip, chrome:// pages or the Web Store. In front of those, a break opens in its own small window and water arrives as a notification.

## Art
Brinky's faces are in `art/` as your original 300×252 PNGs (in the source package); the extension uses light WebP copies in `mascot/` (about 16 KB each, visually identical). "Curious" uses the surprised face. Web pages can reach the sprites only through Chrome's per-session address (`use_dynamic_url`), so a site can't check a fixed URL to see whether you have Brinky installed.

## Source and build
`brinky-3.1.0.zip` is the optimised build (minified). `brinky-3.1.0-source.zip` has the readable code, which also loads unpacked as-is, plus your original art. To rebuild: `node tools/art.mjs` (faces and icons from `art/`) and `node tools/build.mjs` (needs Node with `sharp` and `esbuild`).

Everything Brinky stores stays in your browser. See PRIVACY.md.
