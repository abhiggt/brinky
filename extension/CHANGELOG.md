# Changelog

## 3.1.0
**Never late**
- The tab you're on is armed 15 seconds ahead with everything the break needs and starts it itself, to the millisecond. Measured: 7–17 ms after the due time (one screen refresh), including with a heavy page busy in another tab (3.0: about 1.9 s late) and with the background asleep (9 ms).
- Breaks go to the tab in front first; other tabs are told without waiting. A slow or frozen tab can no longer hold up a break.
- The break's look, faces, styles and fonts are prepared while armed; the chime starts just after the first frame; on modest machines the break uses a solid scrim instead of a live blur.
- Lighter: 17 KB of Brinky per page instead of 74 KB (minified, and the break screen and water wave load only when needed). Faces are WebP, 5× smaller. Settings and state are cached in memory; pages no longer wake the background on every load.

**Work mode**
- One switch in the popup: fewer, longer breaks for deep work (default 50 min focus, 5 min break; presets 25/5, 50/10, 90/15). The 20-second look-aways become a quiet note by your cursor every 20 minutes.
- Longer breaks: up to 8 guided moves (about 4 minutes), then free time until the chime, instead of cycling the same moves for 15 minutes.

**Water and breaks, together**
- Water due within 10 minutes of a break is asked for in the break, with "Glass N of goal" and "I had a glass" up front. A wave on screen when a break starts joins it. Water due during a break joins that break. No water right after a break.
- Water reminders are paced to your goal across your working day (sooner when you fall behind) instead of every 30 minutes.

**Settings, simplified**
- The popup keeps the basics. Everything else moved to SuperBrink settings, a page of its own, which apply only while SuperBrink mode is on. Off means Brinky's recommended settings.
- The welcome tour asks 20-20-20 or Work mode, and water reminders paced or off. Focus sites moved to SuperBrink.
- At most two snoozes in a row; then the break happens (adjustable in SuperBrink).
- Units follow your browser's language unless you choose.

## 3.0.0 — Brinky (Blink & Drink breaks)
Renamed from Blinky, with fixes from a 72-hour simulated test and headless-Chrome review.

**Fixed**
- Pausing or switching off during a break left an un-closable overlay in every tab. Every way out of a break now clears it, and the overlay removes itself if the extension stops answering.
- Breaks and waves appeared on shared screens and paused call audio. Brinky now detects camera, mic and screen sharing in any tab (and audible call sites), stays quiet, and never pauses call media.
- Breaks started on a locked screen or for nobody, and counted as taken. Breaks now need someone present with Chrome in front; otherwise a notification. "Taken" requires the break to have been seen.
- Any 60-second reading pause reset the timer and counted as rest. Now 3+ minutes away is required; nights don't count.
- Planned breaks ignored calls and covered the page for 30 minutes. They're now quiet times that pause reminders.
- Keystrokes reached the page under the break screen. They're now held back; focus returns afterwards.
- Ignored waves froze in background tabs and flooded them later; reminders sped up when ignored. Waves now show only in the visible tab, end everywhere, and back off.
- figma.com was a default focus site and blocked water too; matching was loose. The list starts empty, matching is exact, focus sites show water as a quiet card.
- "Rest of today" after midnight paused for ~30 hours. Now it means the next morning.
- The water card could go off-screen in narrow windows; it's clamped and pinned.
- Water never came while a break was waiting; it now does.
- Wave sounds played in every tab; now only the visible one.
- The default dark break look failed contrast on light pages. "Auto" matches the page; scrims are stronger.
- "Pause videos" paused music and calls; now only the video you're watching.
- Blink and posture pop-ups overlapped; nudges queue, and blink reminders are a toolbar blink by default.
- The evening tint lifted black text; it's now a warm backdrop filter.
- "Goal hit yesterday" showed on days the goal was hit today.
- Tips rotated over the end message; dead code removed; "tabs" permission dropped.
- Mascot images were readable at a fixed address by any website (a way to fingerprint you). They're now served only through a per-session URL.

**New**
- The new Brinky art: a glossy water drop with eleven faces, and matching toolbar icons that blink.
- Your name: the welcome tour and Settings ask what to call you; Brinky uses it in greetings, breaks, water reminders and notifications.
- Movement breaks: Brinky acts out each exercise inside the ring, with big clear steps, progress for each exercise and what's up next.
- Nudges by your cursor: posture (and pop-up blink) notes appear beside your pointer and follow it; the countdown chip for the last 10 seconds before a break is back.
- Look-away mode, hold-to-skip, off-screen guided exercises with figures and step sounds.
- Sip card style, wave height, stop-at-goal, sip-during-break.
- Post-call break, interruption budget, weekday schedule, quiet times.
- Honest stats (missed breaks, minutes since your last real rest), local tips, CSV export, reset to defaults, metric/imperial.
- Log-a-glass shortcut (Alt+Shift+W).
