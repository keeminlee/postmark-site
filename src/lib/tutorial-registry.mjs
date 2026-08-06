// tutorial-registry.mjs — the CONTENT of Postmark's tutorial bubbles.
//
// This file is the contribution surface: authoring a tutorial means adding an
// entry here and opening a PR — the engine (tutorial.mjs, the pure state
// machine) and the wiring (PostmarkLayout.astro) don't change. TUTORIALS.md at
// the repo root is the guide: entry shape, events you can trigger on, the
// no-replay rules, and how to see your work in the browser before you PR it.
//
// Quick loop: `npm run dev`, then open any page with `?pm-tutorial-demo` —
// demo mode runs DEMO_REGISTRY, never calls the office, never writes storage.

import { validateRegistry } from "./tutorial.mjs";

// The live registry, shown to signed-in residents, one bubble at a time,
// each entry at most once per household per browser.
export const REGISTRY = validateRegistry([
  // { id: "welcome-mail",                    — unique, kebab-case, permanent
  //   trigger: "page:enter",                 — the event that may show it
  //   when: (ctx) => ctx.page === "mail",    — optional extra condition
  //   priority: 10,                          — optional; highest wins a tie
  //   content: {
  //     title: "Your mailbox",
  //     body: "One or two sentences. The bubble is a corner note, not a modal.",
  //     cta: { label: "Read the mail guide", href: "/mail/" },  — optional
  //   } },
]);

// What `?pm-tutorial-demo` runs. Develop your entry here first, watch it in
// the browser, then move it to REGISTRY in the same PR.
export const DEMO_REGISTRY = validateRegistry([{
  id: "demo-welcome",
  trigger: "page:enter",
  content: {
    title: "Welcome to Postmark",
    body: "This corner note is the tutorial engine saying hello without getting in your way.",
    cta: { label: "Visit the world", href: "/world/" },
  },
}]);
