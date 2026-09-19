// "Am I going to be reading this?"
//
// Report -P1rN7K8Ot7V4yqgW17O (2026-09-18): "It would be nice if the
// information could tell me if the movie is subtitled." Nothing in a hat
// entry answered that — the draw screen showed a poster, a note, and where
// to stream it, and you found out the film was in Korean by pressing play.
//
// TMDb has no "is it subtitled" field, and there isn't one to have: whether
// a given stream carries subtitles or a dub is a per-service fact that
// changes. What TMDb does know is the language the film was MADE in, and
// that is the question actually being asked — a non-English film watched
// here means reading, near enough always.
//
// So the claim on screen is the one that's true: what language it's in. The
// subtitles line is the inference, phrased as one.

// TMDb returns ISO 639-1. Intl.DisplayNames knows all of them, and knows
// them in the reader's own language; the table is the fallback for the
// handful of engines that don't have it, covering what actually turns up in
// a movie club.
const FALLBACK_NAMES = {
  cn: 'Cantonese', da: 'Danish', de: 'German', es: 'Spanish', fa: 'Persian',
  fr: 'French', he: 'Hebrew', hi: 'Hindi', it: 'Italian', ja: 'Japanese',
  ko: 'Korean', nl: 'Dutch', no: 'Norwegian', pl: 'Polish', pt: 'Portuguese',
  ru: 'Russian', sv: 'Swedish', th: 'Thai', tr: 'Turkish', zh: 'Chinese'
};

/** The language's name in English, or null if the code means nothing. */
export function languageName (code) {
  const key = String(code || '').trim().toLowerCase();
  if (!key || key === 'xx') return null; // TMDb's "no language" (silent films)
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(key);
    // Intl hands back the code itself when it doesn't recognise it.
    if (name && name.toLowerCase() !== key) return name;
  } catch {
    // No Intl.DisplayNames here; fall through to the table.
  }
  return FALLBACK_NAMES[key] || null;
}

/**
 * What to say about a film's language, or null when there's nothing worth
 * saying. English gets nothing — a caption on every second film is noise,
 * and the whole point is to flag the exception.
 *
 * `en` is also what TMDb returns when it doesn't know, so an unknown film is
 * silently treated as English. That's the right way round to be wrong: a
 * missing caption costs a surprise, a wrong one costs trust.
 */
export function subtitleNote (movie) {
  const code = String(movie?.original_language || '').trim().toLowerCase();
  if (!code || code === 'en') return null;
  const name = languageName(code);
  if (!name) return null;
  return { code, language: name, text: `In ${name} — subtitled` };
}
