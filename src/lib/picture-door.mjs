// picture-door.mjs — the site's picture button is a human path to the MCP
// (the atlas sitting, 2026-09-09: "the site's upload buttons are repointed to
// the office route, so the site is a human path to the MCP").
//
// THE SITE HAD NO PICTURE DOOR. Prose edits in place (address, home) PATCH the
// office's paper verbs; the only image the site ever sent was the profile
// avatar, to its own PATCH. A home picture went by GitHub PR or not at all.
//
// This is the request the button sends, and nothing else: the household apex
// over plain HTTP — `POST <office>/household` with the do:/args: envelope,
// `do: "upload"`, which the office routes to its one media door (the same
// handler `upload_media` and POST /media land in). The answer's `result.url`
// is the permanent media URL — the only kind a mark's `image:` takes — and
// the button's job ends at printing it with the one act that uses it.
//
// Pure: builds the request and reads the answer. The fetch is the caller's, so
// a test can aim it at a fixture server that records what arrived.

/** The apex envelope for one picture. `image` is raw base64 (no data: prefix). */
export function pictureUploadRequest({ officeBase, token, handle, image }) {
  const base = String(officeBase ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("the office base is required");
  if (!token) throw new Error("an upload needs a key — sign in first");
  if (!image) throw new Error("no picture to send");
  const args = { image: String(image) };
  if (handle) args.by = String(handle);
  return {
    url: `${base}/household`,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ do: "upload", args }),
    },
  };
}

/** What the office answered, in the button's words: the URL and the act that hangs it, or the refusal by name. */
export function readUploadAnswer(status, data) {
  const r = data?.result;
  if (status >= 200 && status < 300 && r?.url) {
    return {
      ok: true,
      url: r.url,
      already: r.already === true,
      line: `${r.already ? "already on your wall" : "on your wall"} — ${r.url}`,
      next: `hang it on your parcel: world { do: "leave-mark", args: { …, image: "${r.url}" } }`,
    };
  }
  const defect = String(data?.defect ?? "").trim();
  const hint = String(data?.hint ?? "").trim();
  return { ok: false, url: null, line: (defect || `the office said no (${status})`) + (hint ? ` — ${hint}` : "") };
}

/** Send one picture through the door with the caller's fetch. Returns readUploadAnswer's shape. */
export async function sendPicture(fetchImpl, params) {
  const { url, init } = pictureUploadRequest(params);
  const res = await fetchImpl(url, init);
  const data = await res.json().catch(() => ({}));
  return readUploadAnswer(res.status, data);
}
