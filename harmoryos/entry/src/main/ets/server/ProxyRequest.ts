import { http } from "@kit.NetworkKit";

export interface ProxyRequest {
  url: string;
  setCookieRename: boolean;
  allowAutoRedirect: boolean;
  headers?: Record<string, string>;
  method: http.RequestMethod;
  data: string
}

export function getDefaultProxyRequest(): ProxyRequest {
	return {
    url: '',
    setCookieRename: false,
    allowAutoRedirect: true,
    headers: void 0,
    method: http.RequestMethod.GET,
    data: ''
  };
}

const defaultUserAgent = 'Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'

export function parseProxyRequest(text: string): ProxyRequest {
  let result = getDefaultProxyRequest();
  if(text.startsWith('http')) {
    result.url = text
    return result
  }
  try {
    result = {
      ...result,
      ...JSON.parse(text)
    }
  }catch {
  }
  if(result.headers) {
    const keys = Object.keys(result.headers)
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i]
      if(key.toLowerCase() === 'contenttype') {
        key = 'content-type'
      }else if(key.toLowerCase() === 'useragent') {
        key = 'user-agent'
      }
      const value = result.headers[keys[i]]
      delete result.headers[keys[i]]
      result.headers[key.toLowerCase()] = value
    }
    if(!result.headers['user-agent']) {
      result.headers['user-agent'] = defaultUserAgent
    }
  }
  return result
}