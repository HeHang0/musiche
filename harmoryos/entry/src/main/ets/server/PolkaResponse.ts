import { ServerResponse } from '@ohos/polka';
import { http } from '@ohos/polka/src/main/ets/http/index';
import Cookie from '@ohos/polka/src/main/ets/http/core/content/Cookie';
import { buffer } from '@kit.ArkTS';
import { socket } from '@kit.NetworkKit';
import { ProxyResponse } from './ProxyResponse';


export class PolkaResponse {
  private root: ServerResponse;
  private cookieHeaders: string[];
  private headersOptions: string[];
  private contentLength = 0;
  private sending = false;
  private sendQueue:{resolve: (value: unknown) => void,data: string|ArrayBuffer}[] = [];

  constructor(res: ServerResponse, cors = true) {
    this.root = res
    this.cookieHeaders = [];
    this.headersOptions = ['content-type', 'content-length', 'set-cookie', 'connection', 'date'];
    if (cors) {
      this.processCors()
    }
  }

  private processCors() {
    this.root.setHeader("Access-Control-Allow-Origin", "*");
    this.root.setHeader("Access-Control-Allow-Headers", "*");
    this.root.setHeader("Access-Control-Allow-Methods", "*");
    this.root.setHeader("Access-Control-Expose-Headers", "*");
    this.root.setHeader("Access-Control-Allow-Credentials", "true");
  }

  public getPolka() {
    return this.root
  }

  public async writeBlock(data: string | buffer.Buffer | Uint8Array) {
    this.root.writableEnded = true;
    if (!this.root.headersSent) {
      await this.writeHeaders()
    }
    if(!data || data.length < 0) {
      return
    }
    let body: buffer.Buffer = typeof data === 'string' ? buffer.from(data, 'utf8') : buffer.from(data);
    await this.sendSocket(body.buffer)
  }

  public async writeBody(data: string | buffer.Buffer | Uint8Array) {
    this.root.finished = true;
    this.contentLength = data.length
    await this.writeBlock(data)
    this.root.writableFinished = true;
  }

  public async writeJson(data: object) {
    this.root.finished = true;
    const buf = buffer.from(JSON.stringify(data), 'utf8')
    this.contentLength = buf.length
    this.setContentType("application/json; charset=utf-8")
    await this.writeBlock(buf)
    this.root.writableFinished = true;
  }

  public async writeProxy(proxyData: ProxyResponse) {
    this.writeHead(proxyData.statusCode)
    const headerKeys = proxyData.headers ? Object.keys(proxyData.headers) : []
    headerKeys.forEach(key => {
      this.root.setHeader(key, proxyData.headers[key])
    })
    this.contentLength = proxyData.contentLength
    proxyData.contentType && this.setContentType(proxyData.contentType)
    if(proxyData.stream){
      const dataReceive = data => {
        this.writeBlock(data)
      }
      proxyData.stream.on('dataReceive', dataReceive)
      await new Promise(resolve => proxyData.stream.on('dataEnd', resolve))
      proxyData.stream.off('dataReceive', dataReceive)
      proxyData.stream.off('dataEnd')
      proxyData.stream.destroy()
      this.root.writableFinished = true;
    }else if(proxyData.data) {
      this.writeBody(proxyData.data)
      return
    }
    this.writeBody('')
  }

  public setContentType(contentType: string) {
    this.root.setHeader('content-type', contentType)
  }

  public setContentLength(length: number) {
    this.contentLength = length
  }

  public getMimeType(ext: string) {
    const parts = ext.trim().split('.');
    switch (parts && parts.length > 0 ? parts[parts.length - 1] : 'html') {
      case "html":
        return "text/html";
      case "js":
        return "application/javascript; charset=utf-8";
      case "json":
        return "application/json; charset=utf-8";
      case "css":
        return "text/css; charset=utf-8";
      case "woff":
        return "font/woff";
      case "woff2":
        return "font/woff2";
      case "otf":
        return "font/otf";
      case "png":
        return "image/png";
      case "jpg":
        return "image/jpeg";
      case "svg":
        return "image/svg+xml";
      case "webp":
        return "image/webp";
      case "webm":
        return "video/webm";
    }
    return "text/html";
  }

  private async sendSocket(data: string | ArrayBuffer){
    let tcpSendOption: socket.TCPSendOptions = {
      data: data,
    };
    if(this.sending) {
      return new Promise(resolve => {
        this.sendQueue.push({
          resolve,data
        })
      })
    }
    this.sending = true
    await this.root.client.send(tcpSendOption)
    while (true){
      const result = this.sendQueue.shift()
      if(!result) {
        break
      }
      await this.root.client.send({
        data: result.data,
      })
      result.resolve(void 0)
    }
    this.sending = false
  }

  private async writeHeaders() {
    this.root.headersSent = true
    let header: buffer.Buffer = buffer.from(this.outHeader(), 'utf8');
    await this.sendSocket(header.buffer)
  }

  private outHeader(): string {
    if (this.root.statusCode == null) {
      throw new Error("response Status can't be null.");
    }
    let resData: string = `HTTP/1.1 ${this.root.statusCode} ${this.root.statusMessage}\r\n`;
    if (this.root.hasHeader('content-type')) {
      const mimeType = this.root.getHeader('content-type');
      resData = this.printHeader(resData, 'Content-Type', mimeType);
    }else if(this.root.hasHeader('content-type')) {
      resData = this.printHeader(resData, 'Content-Type', this.root.getHeader('content-type'));
    }
    if (this.contentLength > 0) {
      resData = this.printHeader(resData, 'Content-Length', this.contentLength);
    }else if(this.root.hasHeader('content-length')) {
      resData = this.printHeader(resData, 'Content-Length', this.root.getHeader('content-length'));
    }
    if (!this.root.hasHeader('connection')) {
      resData = this.printHeader(resData, 'Connection', this.root.keepAlive ? 'keep-alive' : 'close');
    }else {
      resData = this.printHeader(resData, 'Connection', 'close');//this.root.getHeader('connection'));
    }
    if (this.root.sendDate) {
      resData = this.printHeader(resData, 'Date', new Date().toUTCString());
    }
    if(this.cookieHeaders.length > 0) {
      for (let cookieHeader of this.cookieHeaders) {
        resData = this.printHeader(resData, 'Set-Cookie', cookieHeader);
      }
    }else if(this.root.hasHeader('set-cookie')) {
      let cookieHeaders:string|string[] = this.root.getHeader('set-cookie')
      cookieHeaders = Array.isArray(cookieHeaders) ? cookieHeaders : [cookieHeaders]
      for (let cookieHeader of cookieHeaders) {
        resData = this.printHeader(resData, 'Set-Cookie', cookieHeader);
      }
    }

    this.root.getHeaderNames().forEach(key => {
      if (!this.headersOptions.includes(key)) {
        resData = this.printHeader(resData, key, this.root.getHeader(key));
      }
    });
    resData += '\r\n';
    return resData;
  }

  private printHeader(originHeader: string, headerKey: string, headerValue: string | number | boolean): string {
    let tempOriginHeader: string = originHeader;
    let arr: string[] = headerKey.split('-');
    arr.forEach((i) => {
      i.toLowerCase().replace(/( |^)[a-z]/g, (l) => l.toUpperCase());
    });
    tempOriginHeader += `${arr.join('-')}: ${headerValue}\r\n`;
    if (!['set-cookie'].includes(headerKey)) {
      this.root.setHeader(headerKey, headerValue);
    }
    return tempOriginHeader;
  }

  public writeHead(code: number, ...rest): void {
    this.root.statusMessage = http.STATUS_CODES[code] as string;
    this.root.writeHead(code, rest)
  }

  public addCookieHeader(cookie: string): void {
    this.cookieHeaders.push(cookie);
    this.setHeader('set-cookie', this.cookieHeaders.join(''));
  }

  public setHeader(name: string, value: string | number | boolean | string[] | Cookie): void {
    this.root.setHeader(name, value);
  }

  public setHeaders(headers: Map<string, string>): void {
    this.root.setHeaders(headers);
  }

  public getHeader(name: string): string {
    return this.root.getHeader(name);
  }

  public hasHeader(name: string): boolean {
    return this.root.hasHeader(name);
  }

  public getHeaderNames(): string[] {
    return this.root.getHeaderNames()
  }

  public removeHeader(name: string): void {
    this.root.removeHeader(name);
  }

  public getHeaders(): object {
    return this.root.getHeaders();
  }

  public isCloseConnection(): boolean {
    return this.root.isCloseConnection();
  }

  public async end(data?: string | ArrayBuffer, totalBytes?: number): Promise<void> {
    if(!data) {
      await this.writeBody('')
      return
    }
    this.root.end(data, totalBytes)
  }
}