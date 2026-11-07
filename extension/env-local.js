// On Brinky's own pages, previews run the real layer locally and report nothing to the background.
globalThis.BrinkyEnv = { asset: (p) => p, send: () => Promise.resolve() };
