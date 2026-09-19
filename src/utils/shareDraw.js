// What a shared draw actually says.
//
// Report -P1pIl_Lbjv_7lesfEs2 (2026-09-18): "I'd like to be able to share a
// drawn movie in a way that I can share it directly to Slack."
//
// Share already went through navigator.share, and Slack is in that sheet —
// the problem was what arrived. The payload was
// `{ title: 'Movie from hat:', text: 'Added by: Matt\nNote: ', url: <poster
// image> }`, and the FILM'S OWN TITLE was in none of it. iOS drops the
// `title` field on the way into a share extension, so what landed in a Slack
// channel was "Added by: Matt" over a bare image URL. You had to open the
// image to find out what film the club had drawn.
//
// So the text carries the title, because the text is the only field that
// reliably survives.
export function drawShareText (movie, { hatName } = {}) {
  const title = movie?.title || 'a movie';
  const year = String(movie?.release_date || '').slice(0, 4);
  const named = year ? `${title} (${year})` : title;

  const lines = [`🎩 ${hatName ? `${hatName} drew` : 'Drawn from the hat'}: ${named}`];
  if (movie?.addedBy) lines.push(`Added by ${movie.addedBy}`);
  if (movie?.note) lines.push(`Note: ${movie.note}`);
  return lines.join('\n');
}
