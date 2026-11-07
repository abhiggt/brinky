// Brinky's eye exercise library. Classic script → globalThis.BrinkyEyes.
// Shared by the in-page layer, the popup, the walkthrough and the website.
//
// guide: how Brinky moves on screen while you follow it with your eyes.
//   far      Brinky drifts into the distance        blink    Brinky blinks in rhythm
//   dim      the screen goes dark (eyes closed)     eight    sideways figure eight
//   circle   slow circles, then the other way       sweepX   side to side
//   sweepY   up and down                            diag     corner to corner
//   clock    12 · 3 · 6 · 9 with a pause on each    zoom     near and far (Brinky grows and shrinks)
//   breathe  slow swell, in 4 and out 6             squeeze  squeeze shut, open wide
//   away     nothing to watch: the screen fades so you really look away, and a chime calls you back
// period: seconds for one loop of the guide.
(() => {
  if (globalThis.BrinkyEyes) return;
  const L = [
    { id: "far", name: "Look far away", dur: 20, guide: "away", period: 20, face: "calm",
      why: "The classic 20-20-20. Distance lets the focusing muscle let go.",
      steps: ["Look away from the screen, at something at least 6 metres away.", "Keep looking far. I'll chime when it's time.", "Stay with it. Almost done."] },
    { id: "blink", name: "Slow blinks", dur: 20, guide: "blink", period: 4, face: "happy",
      why: "We blink a third as often at screens. Slow, full blinks re-wet the eye.",
      steps: ["Blink with Brinky. Close gently, all the way.", "Hold for a moment, then open slowly.", "Close, hold, open. Keep the rhythm."] },
    { id: "eight", name: "Figure eight", dur: 30, guide: "eight", period: 7, face: "happy",
      why: "Smooth tracking works every eye muscle through its full range.",
      steps: ["Follow Brinky with just your eyes.", "Keep your head still, shoulders soft.", "Slow and smooth. No rush."] },
    { id: "circle", name: "Slow circles", dur: 24, guide: "circle", period: 6, face: "happy",
      why: "Circles loosen the muscles that hold your gaze fixed on the screen.",
      steps: ["Trace the circle with your eyes.", "Now let it carry you the other way.", "Breathe out as you finish."] },
    { id: "palming", name: "Palming", dur: 30, guide: "dim", period: 10, face: "sleepy",
      why: "Warm darkness is the fastest way to relax tired eyes.",
      steps: ["Rub your palms together until they're warm.", "Cup them over your closed eyes. No pressure.", "Breathe slowly in the dark.", "Open your eyes slowly at the chime."] },
    { id: "sweepX", name: "Side to side", dur: 20, guide: "sweepX", period: 4, face: "happy",
      why: "Wide side glances stretch the muscles that screens barely use.",
      steps: ["Look as far left as is comfortable.", "Glide all the way right with Brinky.", "Keep your head still."] },
    { id: "zoom", name: "Near and far", dur: 30, guide: "zoom", period: 8, face: "calm",
      why: "Shifting focus is exercise for the lens, which stays locked on screens.",
      steps: ["When Brinky is big, focus on it up close.", "When it's small, look past it, far away.", "Near, then far. Let each one sharpen."] },
    { id: "squeeze", name: "Squeeze and release", dur: 20, guide: "squeeze", period: 6, face: "wink",
      why: "A gentle squeeze pushes fresh tears across the eye.",
      steps: ["Squeeze your eyes shut for three seconds.", "Open wide and let your face relax.", "Again: squeeze, then release."] },
    { id: "sweepY", name: "Up and down", dur: 20, guide: "sweepY", period: 4, face: "happy",
      why: "Vertical glances balance hours of left-to-right reading.",
      steps: ["Look up toward your eyebrows.", "Then all the way down to your chin.", "Smooth, like a slow nod with your eyes."] },
    { id: "clock", name: "Clock face", dur: 24, guide: "clock", period: 8, face: "happy",
      why: "Holding each point builds steady, relaxed control.",
      steps: ["Look at 12 o'clock, then 3.", "Then 6, then 9. Pause on each one.", "Keep breathing as you go round."] },
    { id: "butterfly", name: "Butterfly blinks", dur: 15, guide: "blink", period: 0.6, face: "happy",
      why: "Light, quick blinks spread moisture without effort.",
      steps: ["Blink quickly and lightly, like a flutter.", "Keep your forehead soft.", "Slow down now, and rest."] },
    { id: "diag", name: "Diagonals", dur: 20, guide: "diag", period: 6, face: "happy",
      why: "Corners reach the angles your eyes rarely visit.",
      steps: ["Top left to bottom right.", "Now top right to bottom left.", "Follow Brinky, corner to corner."] },
    { id: "breathe", name: "Horizon breath", dur: 30, guide: "away", period: 10, face: "calm",
      why: "A slow exhale tells your whole body, eyes included, to unclench.",
      steps: ["Look out of a window, or across the room.", "Breathe in for four, out for six. Keep looking far.", "One more slow breath. I'll chime when it's time."] },
    { id: "temples", name: "Temple massage", dur: 30, guide: "dim", period: 10, face: "sleepy",
      why: "Eye strain often lives in the brow and temples.",
      steps: ["Close your eyes.", "Make small, slow circles on your temples.", "Now press gently along your eyebrows.", "Open slowly at the chime."] },
    { id: "thumb", name: "Thumb focus", dur: 30, guide: "away", period: 10, face: "calm",
      why: "A real-world near-far drill that keeps the lens flexible.",
      steps: ["Hold your thumb up at arm's length. Focus on the nail.", "Bring it slowly toward your nose, keeping it sharp.", "Move it back out, then look far beyond it."] },
  ];
  const byId = Object.fromEntries(L.map((e) => [e.id, e]));
  // Quick look-away mode only uses these two.
  const QUICK = ["far", "blink"];
  globalThis.BrinkyEyes = {
    list: L,
    get: (id) => byId[id] || L[0],
    // the next exercise after `i` for a mode ("guided" walks the whole library; "quick" alternates two)
    next(mode, i) {
      if (mode === "quick") { const k = QUICK.indexOf(L[i]?.id); return L.indexOf(byId[QUICK[(k + 1) % QUICK.length]]); }
      return (i + 1 + L.length) % L.length;
    },
  };
})();
