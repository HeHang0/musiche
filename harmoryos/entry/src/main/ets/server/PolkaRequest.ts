import { Request } from '@ohos/polka';
import CookieHandler from '@ohos/polka/src/main/ets/http/core/content/CookieHandler';
import { BufferPool } from '@ohos/polka/src/main/ets/http/core/request/BufferPool';
import socket from '@ohos.net.socket';
import { buffer, util } from '@kit.ArkTS';
import { Callback } from '@kit.BasicServicesKit';

export class PolkaRequest {
  private root: Request;
  originalUrl: string;
  path: string;
  params: { [key: string]: string; };
  search: string | null;
  query: { [key: string]: string | string[]; };
  public socket: string;
  public uri: string;
  public method: string | undefined;
  public headers: Record<string, string>;
  public cookies: CookieHandler;
  public url: string;
  public parameters: Map<string, string[]>;
  public queryParameterString: string;
  public files: Map<string, buffer.Buffer>;

  constructor(req: Request) {
    this.root = req
    this.originalUrl = req.originalUrl
    this.path = req.path
    this.params = req.params
    this.search = req.search
    this.query = req.query
    this.socket = req.socket
    this.uri = req.uri
    this.method = req.method
    this.headers = req.headers
    this.cookies = req.cookies
    this.url = req.url
    this.parameters = req.parameters
    this.queryParameterString = req.queryParameterString
    this.files = new Map<string, buffer.Buffer>()
  }

  public getPolka(){
    return this.root
  }

  public async readBody(): Promise<string> {
    await new Promise(resolve => {
      this.root.parseBody(this.files, resolve)
    })
    if (!this.files.has('postData')) {
      return ''
    }
    const buf = this.files.get('postData')
    const decoder = util.TextDecoder.create('utf-8');
    const text = decoder.decodeToString(new Uint8Array(buf!.buffer));
    return text;
  }

  public async readJson(): Promise<Record<string, any>> {
    const text = await this.readBody()
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }

  getParameters(): Map<string, string[]> {
    return this.root.getParameters()
  }

  getQueryParameterString(): string {
    return this.root.getQueryParameterString()
  }

  getRemoteIpAddress(): string {
    return this.root.getRemoteIpAddress()
  }

  public decodeParms(params: string, parseParameters: Map<string, string[]>): void {
    this.root.decodeParms(params, parseParameters)
  }

  public getCookies(): CookieHandler {
    return this.root.getCookies()
  }

  public getUri(): string {
    return this.root.getUri()
  }

  public getHeaders(): object {
    return this.root.getHeaders()
  }

  public getParms(): Map<string, string> {
    return this.root.getParms()
  }

  public getMethod(): string | undefined {
    return this.root.getMethod()
  }

  public getInputStream(): string {
    return this.root.getInputStream()
  }

  public execute(client: socket.TCPSocketConnection, bufferPool: BufferPool): void {
    this.root.execute(client, bufferPool)
  }

  public parseBody(files: Map<string, buffer.Buffer>, callback: Callback<void>): void {
    this.root.parseBody(files, callback)
  }

  public getBodySize(): number {
    return this.root.getBodySize()
  }
}