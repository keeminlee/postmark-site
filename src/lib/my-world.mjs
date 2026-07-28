import { KEYS, OFFICE, tokenIsFresh } from "./auth.mjs";

export const WORLD_AXIS_LABELS = Object.freeze({
  trueWorld: "the True World",
  myWorld: "My World",
  everything: "everything",
  justMine: "just mine",
});

export function worldAxisState({ authenticated = false, baseLayer = "true", justMine = false } = {}) {
  return {
    controls: authenticated,
    base: authenticated && baseLayer === "mine" ? WORLD_AXIS_LABELS.myWorld : WORLD_AXIS_LABELS.trueWorld,
    relation: authenticated && justMine ? WORLD_AXIS_LABELS.justMine : WORLD_AXIS_LABELS.everything,
  };
}

export function portfolioIds(portfolio = {}) {
  return new Set(["drafts", "published", "backed"]
    .flatMap((category) => (portfolio[category] ?? []).map((mark) => mark.id ?? mark.mark))
    .filter(Boolean));
}

export function townDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function previewWorldLedgerLine({ mode = "stake", date = townDate(), handle, mark, stamps }) {
  const n = Number(stamps);
  if (!handle || !mark || !Number.isInteger(n) || n < 1) return "";
  return mode === "unstake"
    ? `- ${date} · stake:world-mark/${mark} → ${handle} · ${n} · for: unstake · sig: …`
    : `- ${date} · ${handle} → stake:world-mark/${mark} · ${n} · via: api · sig: …`;
}

export function worldStakeAnswer(answer = {}, mode = "stake") {
  if (answer.error === "bounce" || answer.defect) {
    return {
      kind: "refusal",
      text: [answer.defect || "the door refused the line", answer.hint].filter(Boolean).join(" — "),
    };
  }
  const applied = Number(answer.applied ?? 0);
  if (applied <= 0) {
    return {
      kind: "refusal",
      text: answer.reason || `No stamps were ${mode === "unstake" ? "returned" : "staked"}.`,
    };
  }
  const requested = Number(answer.requested ?? applied);
  const verb = mode === "unstake" ? "returned" : "staked";
  const clipped = answer.clipped || applied < requested
    ? ` The door clipped the request from ${requested} to ${applied}.`
    : "";
  return {
    kind: "success",
    text: `${applied} stamp${applied === 1 ? "" : "s"} ${verb} on ${answer.mark}.${clipped}`,
  };
}

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[char]));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function storedToken() {
  try {
    const token = JSON.parse(localStorage.getItem(KEYS.token) || "null");
    return tokenIsFresh(token) ? token.access_token : null;
  } catch {
    return null;
  }
}

function officeBase() {
  try {
    return String(localStorage.getItem("pm.office.base") || OFFICE).replace(/\/$/, "");
  } catch {
    return OFFICE;
  }
}

async function getJson(path, token) {
  const response = await fetch(officeBase() + path, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.defect || `${path} → ${response.status}`), { body, status: response.status });
  return body;
}

async function postJson(path, payload, token) {
  const response = await fetch(officeBase() + path, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({
    error: "bounce",
    defect: `the door answered ${response.status} without a readable receipt`,
  }));
  return { ok: response.ok, body };
}

async function waitForViewer() {
  for (let i = 0; i < 100; i += 1) {
    const host = document.querySelector("#app .wv-view");
    if (host) return host;
    await sleep(50);
  }
  return null;
}

// Full native support arrives at the first settlement's pin bump.
async function viewerHasNativeAxes() {
  try {
    const viewerUrl = "/world-engine/spectator/viewer.mjs";
    const viewer = await import(/* @vite-ignore */ viewerUrl);
    return typeof viewer.viewerAxisControls === "function" && typeof viewer.viewerAxisState === "function";
  } catch {
    return false;
  }
}

function categoryRows(category, rows) {
  if (!rows.length) return `<p class="mwi-empty">Nothing here yet.</p>`;
  return `<ul class="mwi-list">${rows.map((mark) => {
    const id = mark.id ?? mark.mark ?? "unnamed";
    const detail = category === "backed"
      ? `${Number(mark.stamps ?? 0)} staked${mark.holder ? ` by ${esc(mark.holder)}` : ""} · ✦weight ${Number(mark.weight ?? 0)}${mark.yours ? " · yours" : ""}`
      : [mark.kind, mark.tier, mark.by].filter(Boolean).map(esc).join(" · ");
    const unstake = category === "backed" && Number(mark.stamps ?? 0) > 0 && mark.holder
      ? `<button type="button" class="mwi-small" data-mwi-unstake data-mark="${esc(id)}" data-handle="${esc(mark.holder)}" data-max="${Number(mark.stamps)}">take stamps back</button>`
      : "";
    return `<li><code>${esc(id)}</code>${detail ? `<span>${detail}</span>` : ""}${unstake}</li>`;
  }).join("")}</ul>`;
}

function renderPortfolio(root, portfolio) {
  for (const category of ["drafts", "published", "backed"]) {
    const rows = portfolio[category] ?? [];
    const section = root.querySelector(`[data-mwi-category="${category}"]`);
    section.querySelector("[data-mwi-count]").textContent = String(rows.length);
    section.querySelector("[data-mwi-rows]").innerHTML = categoryRows(category, rows);
  }
}

function renderDraftOverlay(root, portfolio, composed, visible) {
  const section = root.querySelector("[data-mwi-draft-overlay]");
  section.hidden = !visible;
  if (!visible) return;
  const full = new Map((composed?.marks ?? []).map((mark) => [mark.id, mark]));
  const drafts = (portfolio.drafts ?? []).map((draft) => ({ ...full.get(draft.id), ...draft }));
  section.querySelector("[data-mwi-draft-count]").textContent = String(drafts.length);
  const cards = section.querySelector("[data-mwi-draft-cards]");
  cards.innerHTML = drafts.length ? drafts.map((mark) =>
    `<article class="mwi-draft-card" data-mwi-draft data-id="${esc(mark.id)}">
      <div class="mwi-draft-state">pending · your household only</div>
      <div class="mwi-draft-body">${esc(mark.body || mark.id)}</div>
      <div class="mwi-draft-meta">${[mark.tier, mark.kind, mark.by].filter(Boolean).map(esc).join(" · ")}</div>
      <code>${esc(mark.id)}</code>
    </article>`).join("") : `<p class="mwi-empty">No private sketches are waiting.</p>`;
}

function paintAxes(root, state) {
  const axis = worldAxisState({ authenticated: true, baseLayer: state.baseLayer, justMine: state.justMine });
  for (const button of root.querySelectorAll("[data-world-base]")) {
    const on = button.textContent.trim() === axis.base;
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", String(on));
  }
  for (const button of root.querySelectorAll("[data-mine-filter]")) {
    const on = button.textContent.trim() === axis.relation;
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", String(on));
  }
}

function mountStakeButtons(viewer, openStake) {
  for (const card of viewer.querySelectorAll(".wv-card[data-id]")) {
    if (card.querySelector("[data-mwi-stake]")) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mwi-stake-launch";
    button.dataset.mwiStake = "";
    button.dataset.mark = card.dataset.id;
    button.textContent = "back this mark";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openStake({ mark: card.dataset.id, mode: "stake" });
    });
    (card.querySelector(".cmeta") ?? card).append(button);
  }
}

function applyFallbackRelation(viewer, mineIds, justMine) {
  for (const card of viewer.querySelectorAll(".wv-card[data-id]")) {
    card.classList.toggle("mwi-filtered-out", justMine && !mineIds.has(card.dataset.id));
  }
}

function syncLegacyControls(viewer, nativeAxes) {
  for (const legacyMine of viewer.querySelectorAll('.wv-fchip[data-mfilter="mine"]')) {
    legacyMine.classList.toggle("mwi-legacy-hidden", !nativeAxes);
    legacyMine.setAttribute("aria-hidden", String(!nativeAxes));
    legacyMine.tabIndex = nativeAxes ? 0 : -1;
  }
}

function setupDoor(root, context) {
  const sheet = root.querySelector("[data-mwi-door]");
  const title = sheet.querySelector("[data-mwi-door-title]");
  const markEl = sheet.querySelector("[data-mwi-mark]");
  const handleEl = sheet.querySelector("[data-mwi-handle]");
  const stampsEl = sheet.querySelector("[data-mwi-stamps]");
  const preview = sheet.querySelector("[data-mwi-preview]");
  const previewLine = sheet.querySelector("[data-mwi-preview-line]");
  const confirm = sheet.querySelector("[data-mwi-confirm]");
  const answer = sheet.querySelector("[data-mwi-answer]");
  let mode = "stake";

  function invalidate() {
    preview.hidden = true;
    previewLine.textContent = "";
    confirm.disabled = true;
    answer.hidden = true;
    answer.textContent = "";
    answer.dataset.kind = "";
  }

  function open({ mark, mode: nextMode = "stake", handle = "", max = "" }) {
    mode = nextMode;
    title.textContent = mode === "unstake" ? "Take stamps back" : "Back this mark";
    markEl.value = mark;
    handleEl.replaceChildren(...context.handles.map((resident) => {
      const option = document.createElement("option");
      option.value = resident;
      option.textContent = resident;
      option.selected = resident === handle;
      return option;
    }));
    handleEl.disabled = mode === "unstake" && Boolean(handle);
    stampsEl.value = "";
    stampsEl.max = max || "";
    sheet.hidden = false;
    invalidate();
    stampsEl.focus();
  }

  sheet.querySelector("[data-mwi-close]").addEventListener("click", () => { sheet.hidden = true; });
  handleEl.addEventListener("change", invalidate);
  stampsEl.addEventListener("input", invalidate);

  sheet.querySelector("[data-mwi-make-preview]").addEventListener("click", () => {
    const line = previewWorldLedgerLine({
      mode,
      handle: handleEl.value,
      mark: markEl.value,
      stamps: Number(stampsEl.value),
    });
    if (!line) {
      answer.hidden = false;
      answer.dataset.kind = "refusal";
      answer.textContent = "Choose a resident and enter a positive whole number of stamps.";
      return;
    }
    previewLine.textContent = line;
    preview.hidden = false;
    confirm.disabled = false;
    answer.hidden = true;
  });

  confirm.addEventListener("click", async () => {
    const payload = {
      mark: markEl.value,
      stamps: Number(stampsEl.value),
      handle: handleEl.value,
    };
    confirm.disabled = true;
    answer.hidden = false;
    answer.dataset.kind = "";
    answer.textContent = "The office is sealing the line…";
    const path = mode === "unstake" ? "/world/unstake" : "/world/stake";
    try {
      const response = await postJson(path, payload, context.token);
      const rendered = worldStakeAnswer(response.body, mode);
      answer.dataset.kind = rendered.kind;
      answer.textContent = rendered.text;
      if (response.ok && rendered.kind === "success") await context.refresh();
    } catch (error) {
      answer.dataset.kind = "refusal";
      answer.textContent = `The stake door could not be reached — ${error.message}`;
    }
  });

  return { open };
}

export async function mountMyWorldIslands(root, template) {
  if (!root || !template) return;
  const token = storedToken();
  if (!token) {
    root.replaceChildren();
    root.hidden = true;
    return;
  }

  const viewer = await waitForViewer();
  if (!viewer) return;
  viewer.prepend(root);
  root.replaceChildren(template.content.cloneNode(true));
  root.hidden = false;

  const state = {
    token,
    handles: [],
    portfolio: { drafts: [], published: [], backed: [] },
    composed: null,
    mineIds: new Set(),
    baseLayer: "true",
    justMine: false,
    nativeAxes: false,
  };
  const status = root.querySelector("[data-mwi-status]");
  const fallback = root.querySelector("[data-mwi-fallback]");
  const door = setupDoor(root, {
    token,
    get handles() { return state.handles; },
    refresh: () => refresh(),
  });

  function syncViewer() {
    mountStakeButtons(viewer, door.open);
    syncLegacyControls(viewer, state.nativeAxes);
    if (!state.nativeAxes) applyFallbackRelation(viewer, state.mineIds, state.justMine);
  }

  async function refresh() {
    try {
      const [identity, portfolio, composed] = await Promise.all([
        getJson("/me", token),
        getJson("/world/my-marks", token),
        getJson("/world/state", token),
      ]);
      state.handles = identity.handles ?? identity.residents ?? [];
      state.portfolio = portfolio;
      state.composed = composed;
      state.mineIds = portfolioIds(portfolio);
      renderPortfolio(root, portfolio);
      renderDraftOverlay(root, portfolio, composed, !state.nativeAxes && state.baseLayer === "mine");
      paintAxes(root, state);
      status.textContent = `${portfolio.counts?.drafts ?? portfolio.drafts?.length ?? 0} drafts · ${portfolio.counts?.published ?? portfolio.published?.length ?? 0} published · ${portfolio.counts?.backed ?? portfolio.backed?.length ?? 0} backed`;
      syncViewer();
    } catch (error) {
      const detail = error.body?.hint ? `${error.message} — ${error.body.hint}` : error.message;
      status.textContent = `My World is unavailable at this door — ${detail}`;
      status.dataset.kind = "refusal";
    }
  }

  state.nativeAxes = await viewerHasNativeAxes();
  fallback.hidden = state.nativeAxes;
  root.dataset.nativeAxes = String(state.nativeAxes);
  await refresh();

  root.addEventListener("click", (event) => {
    const base = event.target.closest("[data-world-base]");
    if (base && !state.nativeAxes) {
      state.baseLayer = base.dataset.worldBase;
      paintAxes(root, state);
      renderDraftOverlay(root, state.portfolio, state.composed, state.baseLayer === "mine");
      return;
    }
    const relation = event.target.closest("[data-mine-filter]");
    if (relation && !state.nativeAxes) {
      state.justMine = relation.dataset.mineFilter === "mine";
      paintAxes(root, state);
      applyFallbackRelation(viewer, state.mineIds, state.justMine);
      renderDraftOverlay(root, state.portfolio, state.composed, state.baseLayer === "mine");
      return;
    }
    const unstake = event.target.closest("[data-mwi-unstake]");
    if (unstake) {
      door.open({
        mark: unstake.dataset.mark,
        mode: "unstake",
        handle: unstake.dataset.handle,
        max: unstake.dataset.max,
      });
    }
  });

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      syncViewer();
    });
  });
  observer.observe(viewer, { childList: true, subtree: true });
  syncViewer();
}
