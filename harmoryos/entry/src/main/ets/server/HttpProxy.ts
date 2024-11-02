import { http } from '@kit.NetworkKit';
import { ProxyRequest } from "./ProxyRequest";
import { parseProxyResponse, ProxyResponse } from './ProxyResponse';
import { Callback } from '@kit.BasicServicesKit';
import { rcp } from '@kit.RemoteCommunicationKit';
import { hilog } from '@kit.PerformanceAnalysisKit';

export class HttpProxy {
  static async request(requestData: ProxyRequest, onHeader: Callback<Object>,
    onData: Callback<ArrayBuffer>): Promise<number> {
    if (!requestData.url || !requestData.url.startsWith('http')) {
      return 200
    }
    const httpRequest = http.createHttp();
    httpRequest.once("headersReceive", onHeader);
    httpRequest.on('dataReceive', onData)
    const code = await new Promise<number>(async resolve => {
      let code = 200
      httpRequest.on('dataEnd', () => resolve(code))
      code = await httpRequest.requestInStream(requestData.url,
        {
          method: requestData.method,
          extraData: requestData.data,
          expectDataType: http.HttpDataType.ARRAY_BUFFER,
          header: requestData.headers,
        })
    })
    httpRequest.off('dataEnd')
    httpRequest.off('dataReceive', onData)
    httpRequest.destroy()
    return code
  }

  static async requestFetch(requestData: ProxyRequest, onStatus: Callback<number>, onHeader: Callback<Object>,
    onData: Callback<ArrayBuffer>, onEnd?: Callback<void>): Promise<{
    response: rcp.Response,
    session: rcp.Session
  } | null> {
    if (!requestData.url || !requestData.url.startsWith('http')) {
      return null
    }
    const session = rcp.createSession();
    const cookie: {
      [name: string]: string;
    } = {}
    if (!requestData.headers) {
      requestData.headers = {}
    }
    const cookies = requestData.headers['cookie']?.split(';')
    cookies?.forEach(text => {
      const values = text.split('=')
      const key = values[0]?.trim()
      if (key) {
        cookie[key] = values[1]?.trim() || ''
      }
    })
    const req =
      new rcp.Request(requestData.url, requestData.method, requestData.headers, requestData.data, cookie, [], {
        transfer: {
          autoRedirect: requestData.allowAutoRedirect,
          maxAutoRedirects: 5
        },
        tracing: {
          httpEventsHandler: {
            onDataReceive: onData,
            onHeaderReceive: onHeader,
            onDataEnd: onEnd
          }
        },
        processing: {
          validateResponse: response => {
            onStatus(response.statusCode)
            return true
          }
        },
        security: {
          remoteValidation: 'skip'
        }
      });
    try {
      const response = await session.fetch(req)
      hilog.info(0x0000, HttpProxy.name, 'http proxy inner header: ' + JSON.stringify(response.headers));
      hilog.info(0x0000, HttpProxy.name, 'http proxy inner end: ' + response.body?.byteLength);
      return { response, session }
    } catch (err) {
      hilog.error(0x0000, HttpProxy.name, 'http proxy err2: ' + JSON.stringify(err));
      session.close()
      return null
    }
  }
}