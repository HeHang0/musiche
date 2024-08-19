var getRawBody = require('raw-body');
const https = require('https');
const http = require('http');

const fetch = async (url, options) => {
  const headers = {};
  var status = 200;
  var requestOptions = {};
  const requestBody = (options && options.body) || '';
  const requestHeaders = {};
  if (!options) {
    const uu = new URL(url);
    requestOptions = {
      host: uu.host,
      hostname: uu.hostname,
      path: uu.pathname + uu.search,
      port: uu.port,
      protocol: uu.protocol,
      method: 'GET',
      rejectUnauthorized: false
    };
  } else {
    delete options.body;
    options.headers &&
      Object.keys(options.headers).forEach(k => {
        const value = options.headers[k];
        switch (k.toLowerCase()) {
          case 'contenttype':
            requestHeaders['content-type'] = value;
            break;
          case 'useragent':
            requestHeaders['user-agent'] = value;
            break;
          case 'referer':
            requestHeaders['referer'] = value;
            break;

          default:
            requestHeaders[k.toLowerCase()] = value;
            break;
        }
      });
    delete options.headers;
    options.headers = requestHeaders;
    const uu = new URL(url);
    requestOptions = {
      host: uu.host,
      hostname: uu.hostname,
      path: uu.pathname + uu.search,
      port: uu.port,
      protocol: uu.protocol,
      ...options,
      method: options.method || 'GET',
      rejectUnauthorized: false
    };
  }
  const body = await new Promise((resolve, reject) => {
    let data = [];
    const requestCall = (requestOptions.protocol || requestOptions).startsWith(
      'https'
    )
      ? https
      : http;
    const request = requestCall
      .request(requestOptions, res => {
        Object.keys(res.headers).forEach(k => {
          headers[k.toLowerCase()] = res.headers[k];
        });
        status = res.statusCode || 404;
        res.on('data', chunk => {
          try {
            data.push(Buffer.from(chunk));
          } catch (error) {
            reject(error);
          }
        });
        res.on('end', () => {
          Object.keys(res.headers).forEach(k => {
            headers[k.toLowerCase()] = res.headers[k];
          });
          resolve(Buffer.concat(data));
        });
      })
      .on('error', err => {
        reject(err);
      });
    requestBody && request.write(requestBody);
    request.end();
  });
  return {
    body: body,
    headers: headers,
    status
  };
};

const body404 = JSON.stringify({
  code: 404
});
/**
 * @param {Response} response
 */
function getHeaders(response) {
  const headers = response.headers;
  // response && response.headers.forEach((/** @type {any} */ value, /** @type {string} */ key) => headers[key.toLowerCase()] = value)
  delete headers['access-control-allow-origin'];
  delete headers['access-control-allow-headers'];
  delete headers['access-control-allow-methods'];
  delete headers['access-control-allow-credentials'];
  return headers;
}

/**
 * @param {Requesr} req
 * @param {boolean} json
 * @returns {Promise<string|object|null>}
 */
async function readBody(req, json) {
  try {
    const body = await new Promise((resolve, reject) => {
      getRawBody(req, function (err, bb) {
        try {
          resolve(bb.toString());
        } catch (error) {
          resolve('');
        }
      });
    });
    if (json && typeof body === 'string') return JSON.parse(body);
    else return body;
  } catch (error) {
    return null;
  }
}

exports.handler = async (request, resp, context) => {
  var response = null;
  var data = '';
  try {
    const method = request.method.toUpperCase();
    resp.setHeader('access-control-allow-origin', '*');
    resp.setHeader('access-control-allow-headers', '*');
    resp.setHeader('access-control-allow-methods', '*');
    resp.setHeader('access-control-allow-credentials', 'true');
    resp.setHeader('access-control-expose-headers', '*');
    if (method == 'GET') {
      const proxyUrl = request.queries.url; //requestUrl.searchParams.get('url')
      if (proxyUrl && proxyUrl.startsWith('http')) {
        response = await fetch(proxyUrl);
        data = response.body; //&& (await response.blob())
      }
    } else if (method == 'POST') {
      const requestData = await readBody(
        request,
        request.headers['content-type']?.includes('json') || true
      );
      if (requestData) {
        const method = (requestData.method || 'GET').toUpperCase();
        const noBody =
          requestData.method == 'GET' || requestData.method == 'HEAD';

        response = await fetch(requestData.url, {
          method: method || 'GET',
          headers: Object.assign(
            {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
            },
            requestData.headers
          ),
          body: noBody ? undefined : requestData.data
        });
        if (
          requestData.allowAutoRedirect == false &&
          response.status > 300 &&
          response.status < 310
        ) {
          data = JSON.stringify(response.headers);
          response.headers = {};
        } else {
          data = (response && response.body) || '';
          if (requestData.setCookieRename) {
            response.headers['set-cookie-renamed'] =
              response.headers['set-cookie'];
            delete response.headers['set-cookie'];
          }
        }
      }
    } else {
      data = null;
    }
  } catch (error) {
    data += error.stack;
  }
  if (response) {
    const headers = getHeaders(response);
    Object.keys(headers).forEach(key => {
      resp.setHeader(key, headers[key]);
    });
  }
  if (data == null) {
    resp.setStatusCode(200);
    resp.send('');
  } else {
    resp.setStatusCode((response && response.status) || 404);
    resp.send(data || body404);
  }
};
