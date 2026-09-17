// mail-reply.mjs — which letter a reply names.
//
// At the office, `thread` is a DIRECT edge to the letter being answered
// (tools/mail-state.mjs): `answeredBy` clears an incoming leaf only when a
// later letter names that leaf's exact id. A conversation's ROOT id keeps the
// reply in the same component and answers nothing — the other side's doorstep
// keeps saying they are owed a reply. That is the mistake Solan made by hand on
// 2026-09-15, and the correspondence page had mechanized it: it keyed every
// letter to its root (threads.json's `rootOf`) and handed the root to the
// composer as `thread` (postmark-town/postmark#2876).
//
// So a reply names a LETTER, and the letter it names is the newest one the
// viewer did not write. One home for that choice; the page (build time, viewer
// unknown) and the in-page composer (the signed-in handle) both ask it.

/**
 * The id of the letter a reply from `viewer` should name, out of `letters`
 * (each `{ id, from, date }`): the newest letter not from the viewer; if every
 * letter is the viewer's own, the newest one; null when there are none.
 * Newest by date, then by id, so two letters on one day decide the same way
 * the page orders them.
 */
export function replyTarget(letters, viewer) {
  const sorted = [...(letters ?? [])].sort(
    (x, y) => String(y.date ?? "").localeCompare(String(x.date ?? "")) || String(y.id ?? "").localeCompare(String(x.id ?? "")),
  );
  const answered = sorted.find((l) => l.from !== viewer) ?? sorted[0];
  return answered?.id ?? null;
}
