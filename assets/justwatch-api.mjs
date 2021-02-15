// This is a local clone of the api found here:
// https://github.com/lufinkey/node-justwatch-api
// I decided to clone it so that I could add our CORS proxy onto the API_Domain

import https from 'https';
import QueryString from 'querystring';
import Buffer from 'buffer';

const API_DOMAIN = 'fast-refuge-34363.herokuapp.com/apis.justwatch.com';

export default class JustWatch {
  constructor(options) {
    this._options = Object.assign({ locale: 'en_US' }, options);
  }

  request(method, endpoint, params) {
    return new Promise((resolve, reject) => {
      params = Object.assign({}, params);
      // build request data
      const reqData = {
        protocol: 'https:',
        hostname: API_DOMAIN,
        path: '/content' + endpoint,
        method: method,
        headers: {},
      };
      let body = null;
      // add query string if necessary
      if (method === 'GET') {
        if (Object.keys(params) > 0) {
          reqData.path = reqData.path + '?' + QueryString.stringify(params);
        }
      } else {
        body = JSON.stringify(params);
        reqData.headers['Content-Type'] = 'application/json';
      }

      // send request
      const req = https.request(reqData, (res) => {
        // build response
        let buffers = [];
        res.on('data', (chunk) => {
          buffers.push(chunk);
        });

        res.on('end', () => {
          // check if response
          let output = null;
          try {
            output = Buffer.Buffer.concat(buffers);
            output = output.toString();
            output = JSON.parse(output);
          } catch (error) {
            if (res.statusCode !== 200) {
              reject(
                new Error(
                  'request failed with status ' +
                    res.statusCode +
                    ': ' +
                    res.statusMessage
                )
              );
            } else {
              reject(error);
            }
            return;
          }

          if (output.error) {
            reject(new Error(output.error));
          } else {
            resolve(output);
          }
        });
      });

      // handle error
      req.on('error', (error) => {
        reject(error);
      });

      // send
      if (method !== 'GET' && body) {
        req.write(body);
      }
      req.end();
    });
  }

  async search(options = {}) {
    if (typeof options === 'string') {
      options = { query: options };
    } else {
      options = Object.assign({}, options);
    }
    // build default params
    const params = {
      content_types: null,
      presentation_types: null,
      providers: null,
      genres: null,
      languages: null,
      release_year_from: null,
      release_year_until: null,
      monetization_types: null,
      min_price: null,
      max_price: null,
      scoring_filter_types: null,
      cinema_release: null,
      query: null,
      page: null,
      page_size: null,
    };
    const paramKeys = Object.keys(params);
    // validate options
    for (const key in options) {
      if (paramKeys.indexOf(key) === -1) {
        throw new Error("invalid option '" + key + "'");
      } else {
        params[key] = options[key];
      }
    }
    // send request
    const locale = encodeURIComponent(this._options.locale);
    return await this.request('POST', '/titles/' + locale + '/popular', params);
  }

  async getProviders() {
    const locale = encodeURIComponent(this._options.locale);
    return await this.request('GET', '/providers/locale/' + locale);
  }

  async getGenres() {
    const locale = encodeURIComponent(this._options.locale);
    return await this.request('GET', '/genres/locale/' + locale);
  }

  async getSeason(season_id) {
    season_id = encodeURIComponent(season_id);
    const locale = encodeURIComponent(this._options.locale);
    return await this.request(
      'GET',
      '/titles/show_season/' + season_id + '/locale/' + locale
    );
  }

  async getEpisodes(show_id) {
    show_id = encodeURIComponent(show_id);
    const locale = encodeURIComponent(this._options.locale);
    return await this.request(
      'GET',
      '/titles/show/' + show_id + '/locale/' + locale + '/newest_episodes'
    );
  }

  async getTitle(content_type, title_id) {
    title_id = encodeURIComponent(title_id);
    content_type = encodeURIComponent(content_type);
    const locale = encodeURIComponent(this._options.locale);
    return await this.request(
      'GET',
      '/titles/' + content_type + '/' + title_id + '/locale/' + locale
    );
  }

  async getPerson(person_id) {
    person_id = encodeURIComponent(person_id);
    const locale = encodeURIComponent(this._options.locale);
    return await this.request(
      'GET',
      '/titles/person/' + person_id + '/locale/' + locale
    );
  }
}

// module.exports = JustWatch;
