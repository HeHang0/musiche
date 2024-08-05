const http = require('http');
const https = require('https');
const stream = require('stream');
/**
 * @param {http.ServerResponse} response
 */
function setHeader(response) {
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-headers', '*');
  response.setHeader('access-control-allow-methods', 'POST,GET,OPTIONS');
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-expose-headers', '*');
}
/**
 * Retuen
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 * @return {Boolean}
 */
function filterRequest(request, response) {
  if (!request.url.startsWith('/proxy')) {
    response.writeHead(404);
    return true;
  }
  if (request.method.toUpperCase() == 'OPTIONS') {
    response.writeHead(200);
    return true;
  }
}
/**
 * ReadRequestData
 * @param {Request} request
 * @return {Promise<{
 * url: string;
 * method: string;
 * data?: string;
 * headers: http.OutgoingHttpHeaders;
 * allowAutoRedirect: boolean;
 * setCookieRename: boolean;
 * }|null>}
 */
async function readRequestData(request) {
  let result = null;
  try {
    if (request.method.toUpperCase() == 'GET') {
      const uri = new URL(request.url, `http://${request.headers.host}`);
      const proxyUrl = uri.searchParams.get('url');
      result = proxyUrl
        ? {
            url: proxyUrl,
            method: 'GET',
            data: null,
            headers: {},
            allowAutoRedirect: true,
            setCookieRename: false
          }
        : null;
    } else {
      const reader = await request.body.getReader().read();
      if (!reader.done || !reader.value) return null;
      const body = new TextDecoder().decode(reader.value);
      result = JSON.parse(body);
    }
  } catch {}
  if (!result) return null;
  if (!result.url) return null;
  if (typeof result.method !== 'string' || !result.method)
    result.method = 'GET';
  if (typeof result.allowAutoRedirect !== 'boolean')
    result.allowAutoRedirect = true;
  if (typeof result.setCookieRename !== 'boolean')
    result.setCookieRename = false;
  if (typeof result.headers !== 'object' || !result.headers)
    result.headers = {};
  /** @type {http.OutgoingHttpHeaders} */
  const headers = {};
  Object.keys(result.headers).forEach(k => {
    let key = k.toLowerCase();
    switch (k.toLowerCase()) {
      case 'useragent':
        key = 'user-agent';
        break;
      case 'contenttype':
        key = 'content-type';
        break;
      case 'host':
        key = null;
    }
    if (key) headers[key] = result.headers[k];
  });
  result.headers = headers;
  return result;
}
/**
 * GET Response
 * @param {{
 * url: string;
 * method: string;
 * data?: string;
 * headers: http.OutgoingHttpHeaders;
 * allowAutoRedirect?: boolean;
 * setCookieRename?: boolean;
 * }} requestData
 * @return {Promise<{
 * code: number;
 * headers: Record<string, string>;
 * data: string
 * }>}
 */
async function getProxyResponse(requestData) {
  return new Promise(resolve => {
    /** @type {http.ClientRequest} */
    const request = (
      requestData.url.startsWith('https') ? https : http
    ).request(
      requestData.url,
      {
        method: requestData.method,
        timeout: 5000,
        headers: Object.assign(
          {
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          },
          requestData.headers
        )
      },
      res => {
        // resolve(res.setEncoding('base64'));
        const resHeaders = {};
        Object.keys(res.headers).forEach(k => {
          const key = k.toLowerCase();
          if (ignoreResponseHeaders.includes(key)) return;
          resHeaders[key] = Array.isArray(res.headers[k])
            ? res.headers[k].join()
            : res.headers[k];
        });
        res.setEncoding('base64');
        const _buf = [];
        res.on('data', chunk => _buf.push(chunk));
        res.on('end', () => {
          resolve({
            code: res.statusCode || 500,
            headers: resHeaders,
            data: _buf.join('')
          });
        });
      }
    );
    request.on('error', e => {
      console.log(e);
      resolve(null);
    });
    requestData.data && request.write(requestData.data);
    request.end();
  });
}
const ignoreResponseHeaders = [
  'access-control-allow-credentials',
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-origin',
  'access-control-expose-headers'
];
/**
 * Send Request
 * @param {{
 * url: string;
 * method: string;
 * data?: string;
 * headers: http.OutgoingHttpHeaders;
 * allowAutoRedirect?: boolean;
 * setCookieRename?: boolean;
 * }} requestData
 * @return {Promise<{
 * code: number;
 * headers: http.OutgoingHttpHeaders;
 * stream?: stream.Readable;
 * data?: string|null
 * }>}
 */
async function httpRequest(requestData) {
  const response = await getProxyResponse(requestData);
  let headers = {};
  let data = null;
  if (!requestData.allowAutoRedirect && code > 300 && code < 310) {
    headers = { 'content-type': 'application/json;charset=UTF-8' };
    data = Buffer.from(JSON.stringify(response.headers), 'utf-8').toString(
      'base64'
    );
    code = 200;
  } else {
    headers = response.headers;
    data = response.data;
  }
  if (requestData.setCookieRename && headers['set-cookie']) {
    headers['Set-Cookie-Rename'] = headers['set-cookie'];
  }
  return {
    code: response.code,
    headers,
    data
    // stream: response,
  };
}

var server = http.createServer(async function (req, res) {
  setHeader(res);
  if (filterRequest(req, res)) {
    res.end();
    return;
  }
  const requestData = await readRequestData(req);
  if (!requestData) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.write('{"error": "request params error"}');
    res.end();
    return;
  }
  const proxyRes = await httpRequest(requestData);
  // res.writeHead(proxyRes.code, proxyRes.headers);
  res.writeHead(200);
  res.write(
    JSON.stringify({
      statusCode: proxyRes.code,
      isBase64Encoded: false,
      headers: proxyRes.heades,
      body: proxyRes.data
    })
  );
  res.end();
  // if (!proxyRes.stream?.readable || proxyRes.data) {
  //   proxyRes.data && res.write(proxyRes.data);
  //   res.end();
  //   return;
  // }
  // proxyRes?.stream.once('end', () => res.end());
  // proxyRes?.stream.pipe(res);
});

server.listen(8000, '127.0.0.1');
console.log('Node.js web server at port 8000 is running..');
// bootstrap
// /opt/function/runtime/nodejs16.17/rtsp/nodejs/bin/node $RUNTIME_CODE_ROOT/index.js
