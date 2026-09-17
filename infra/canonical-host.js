// movie-hat.com is the canonical origin: it is where the app is installed
// from, what the invite email points at, and what the push Lambda's APP_URL
// now uses. www.movie-hat.com served the same content from a SECOND PWA
// scope, which gave a second Home Screen icon ("Movie Hat 2") and made
// notifications open in an in-app browser instead of the app.
//
// Anything that is not the www host passes through untouched.
function handler(event) {
  var request = event.request;
  var headers = request.headers;
  var host = headers.host && headers.host.value;

  if (host !== 'www.movie-hat.com') {
    return request;
  }

  // CloudFront Functions hand the query string back as an object, so it has
  // to be rebuilt. Multi-value keys keep every value.
  var qs = '';
  if (request.querystring) {
    var parts = [];
    for (var key in request.querystring) {
      var entry = request.querystring[key];
      if (entry.multiValue) {
        for (var i = 0; i < entry.multiValue.length; i++) {
          parts.push(key + '=' + entry.multiValue[i].value);
        }
      } else if (entry.value === '') {
        parts.push(key);
      } else {
        parts.push(key + '=' + entry.value);
      }
    }
    if (parts.length) {
      qs = '?' + parts.join('&');
    }
  }

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://movie-hat.com' + request.uri + qs },
      'cache-control': { value: 'max-age=3600' }
    }
  };
}
