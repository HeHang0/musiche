import polka, { IncomingMessage, ServerResponse, statik, Request, RequestHandler, Polka } from '@ohos/polka';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ConfigurationConstant, Context } from '@kit.AbilityKit';
import { buffer } from '@kit.ArkTS';
import { PolkaResponse } from './PolkaResponse';
import { PolkaRequest } from './PolkaRequest';
import { preferences } from '@kit.ArkData';
import { parseProxyRequest } from './ProxyRequest';
import { HttpProxy } from './HttpProxy';
import { PolkaWebSocket } from './PolkaWebSocket';
import { AudioPlayer } from '../audio/AudioPlayer'
import { LoopType } from '../audio/LoopType';
import { http } from '@kit.NetworkKit';
import { Callback } from '@kit.BasicServicesKit';
import PolkaServer from './PolkaServer';
import { Quality } from '../audio/Quality';

type HttpRequestHandler = (request: Request, res: PolkaResponse) => Promise<void>

function HttpRouter(route: string | string[]) {
  const routes = typeof route === 'string' ? [route] : route;
  return (target: Object, propertyKey: string, descriptor: PropertyDescriptor) => {
    routes.forEach(m => HttpServer.httpRouters.set(m, target.constructor.prototype[propertyKey]))
  };
}

export class HttpServer {
  public static httpPort = 8888
  public static httpRouters: Map<string, HttpRequestHandler> = new Map()
  private app: Polka<Request>;
  private context: Context;
  private dataPreferences: preferences.Preferences
  private websockets: Set<PolkaWebSocket>;
  private audioPlayer: AudioPlayer;
  private themeChange?: Callback<ConfigurationConstant.ColorMode>;

  constructor(context: Context, audioPlayer: AudioPlayer) {
    this.context = context
    this.audioPlayer = audioPlayer
    this.dataPreferences = preferences.getPreferencesSync(this.context, { name: 'Musiche' });
    this.websockets = new Set();
    this.app = polka({
      server: new PolkaServer()
    })
    this.app.all("*", this.initRouter.bind(this))
    this.app.listen(HttpServer.httpPort)
    hilog.info(0x0000, HttpServer.name, 'httpserver start at ' + HttpServer.httpPort);
  }

  public setOnThemeChanged(themeChange: Callback<ConfigurationConstant.ColorMode>){
    this.themeChange = themeChange
  }

  async initRouter(request: Request, response: ServerResponse) {
    const routerPath = request.path.replace(/^\//, '')
    if (PolkaWebSocket.isWebSocket(request)) {
      HttpServer.httpRouters.get(routerPath)?.call(this, new PolkaRequest(request), new PolkaResponse(response))
      return
    }
    try {
      hilog.info(0x0000, HttpServer.name, 'http request: ' + request.path);
      if(request.method?.toUpperCase() === http.RequestMethod.OPTIONS) {
        await new PolkaResponse(response).end()
      }else if (HttpServer.httpRouters.has(routerPath)) {
        await HttpServer.httpRouters.get(routerPath)?.call(this, new PolkaRequest(request), new PolkaResponse(response))
      } else {
        await HttpServer.httpRouters.get('*')?.call(this, new PolkaRequest(request), new PolkaResponse(response))
      }
    } catch (err) {
      hilog.error(0x0000, HttpServer.name, 'http response err: ' + JSON.stringify(err));
    } finally {
      response.client.close()
    }
  }

  private getRawFileWeb(filePath: string, ignoreError = true): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      this.context.resourceManager.getRawFileContent('web/' + filePath, (err, data) => {
        if (err) {
          if (ignoreError) {
            resolve(new Uint8Array())
          } else {
            reject()
          }
        } else {
          resolve(data)
        }
      })
    })
  }

  @HttpRouter('*')
  async handleIndex(request: PolkaRequest, response: PolkaResponse) {
    if(request.method?.toUpperCase() !== 'GET') {
      response.writeHead(404)
      response.end()
      return
    }
    let realPath = request.path.replace(/^\//, '')
    if (!realPath) {
      realPath = 'index.html';
    }
    let data: Uint8Array
    try {
      data = await this.getRawFileWeb(realPath, false)
    } catch {
      data = await this.getRawFileWeb('index.html')
    }
    response.setContentType(response.getMimeType(realPath))
    await response.writeBody(data)
  }

  @HttpRouter('config')
  async handleConfig(request: PolkaRequest, response: PolkaResponse) {
    await response.writeJson({
      remote: true,
      storage: true,
      file: false,
      list: true,
      client: true,
      lyric: false,
      shortcut: false,
      gpu: false
    })
  }

  @HttpRouter('version')
  async getVersion(request: PolkaRequest, response: PolkaResponse) {
    const data = await this.getRawFileWeb('version')
    await response.writeBody(data)
  }

  @HttpRouter(['title', 'media', 'fadein', 'window', 'hotkey', 'gpu', 'fonts'])
  async emptyResponse(request: PolkaRequest, response: PolkaResponse) {
    await response.end()
  }

  private _delayExit: any = null

  @HttpRouter('delayexit')
  async setDelayExit(request: PolkaRequest, response: PolkaResponse) {
    clearTimeout(this._delayExit)
    const text = await request.readBody()
    const delay = parseInt(text) ?? 0;
    if (delay > 0) {
      this._delayExit = setTimeout(this.context.getApplicationContext()?.killAllProcesses, delay * 60 * 1000)
    }
    await response.end()
  }

  @HttpRouter('updatelist')
  async updateList(request: PolkaRequest, response: PolkaResponse) {
    this.audioPlayer.setMusicPlayRequest(await request.readJson())
    await response.end()
  }

  @HttpRouter('media')
  async setMediaMeta(request: PolkaRequest, response: PolkaResponse) {
    this.audioPlayer.setMediaMeta(await request.readJson())
    await response.end()
  }

  @HttpRouter('play')
  async play(request: PolkaRequest, response: PolkaResponse) {
    await this.audioPlayer.playCurrent();
    await this.getStatus(request, response);
  }

  @HttpRouter('quality')
  async setQuality(request: PolkaRequest, response: PolkaResponse) {
    const quality = await request.readBody()
    this.audioPlayer.setQuality(quality as Quality)
    response.end()
  }

  @HttpRouter('pause')
  async pause(request: PolkaRequest, response: PolkaResponse) {
    this.audioPlayer.pause();
    await this.getStatus(request, response);
  }

  @HttpRouter('progress')
  async setProgress(request: PolkaRequest, response: PolkaResponse) {
    const progress = parseInt(await request.readBody());
    !isNaN(progress) && this.audioPlayer.setProgress(progress)
    await this.getStatus(request, response);
  }

  @HttpRouter('volume')
  async setVolume(request: PolkaRequest, response: PolkaResponse) {
    await this.getStatus(request, response);
  }

  @HttpRouter('status')
  async getStatus(request: PolkaRequest, response: PolkaResponse) {
    await response.writeJson(this.audioPlayer.getStatus())
  }

  @HttpRouter('loop')
  async setLoopMode(request: PolkaRequest, response: PolkaResponse) {
    const loopType = await request.readBody()
    if(loopType) {
      this.audioPlayer.setLoopType(loopType as LoopType)
    }
    await this.getStatus(request, response)
  }

  @HttpRouter('image')
  async getImage(request: PolkaRequest, response: PolkaResponse) {

  }

  @HttpRouter('lyric')
  async setLyric(request: PolkaRequest, response: PolkaResponse) {

  }

  @HttpRouter('lyricline')
  async setLyricLine(request: PolkaRequest, response: PolkaResponse) {

  }

  @HttpRouter('storages')
  async getAllStorages(request: PolkaRequest, response: PolkaResponse) {
    const result: object = await new Promise(resolve => {
      this.dataPreferences.getAll((_, data: object) => {
        resolve(data || {})
      })
    })
    await response.writeJson(result)
  }

  @HttpRouter('storage')
  async setStorage(request: PolkaRequest, response: PolkaResponse) {
    const key = request.query['key']?.toString().trim() || '';
    if (!key) {
      await response.end()
      return
    }
    let result = "";
    switch (request.method.toUpperCase()) {
      case "GET":
        result = this.dataPreferences.getSync(key, '')?.toString();
        break;
      case "POST":
        const text = await request.readBody();
        this.dataPreferences.putSync(key, text);
        await this.dataPreferences.flush()
        break;
      case "DELETE":
        this.dataPreferences.deleteSync(key)
        await this.dataPreferences.flush()
        break;
    }
    await response.writeBody(result)
  }

  @HttpRouter('theme')
  async setTheme(request: PolkaRequest, response: PolkaResponse) {
    const themeString = request.query["theme"]?.toString().trim() || '';
    const saved = request.query["saved"]?.toString().trim() == '1';
    const auto = request.query["auto"]?.toString().trim() == '1';
    let colorMode = ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET;
    switch (themeString) {
      case "1":
        colorMode = ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT;
        break;
      case "2":
        colorMode = ConfigurationConstant.ColorMode.COLOR_MODE_DARK;
        break;
    }
    this.themeChange && this.themeChange(colorMode)
    if (saved) {
      this.context.getApplicationContext().setColorMode(auto ? ConfigurationConstant.ColorMode.COLOR_MODE_NOT_SET : colorMode);
      this.dataPreferences.putSync('dark', themeString != "1")
      this.dataPreferences.putSync('auto', auto)
      await this.dataPreferences.flush()
    }
    await response.end()
  }

  @HttpRouter('proxy')
  async proxy(request: PolkaRequest, response: PolkaResponse) {
    const queryUrl = request.query["url"]?.toString().trim()
    const requestData = parseProxyRequest(queryUrl || await request.readBody())
    const date = Math.ceil(new Date().valueOf() / 1000)
    const promiseAll: Promise<void>[] = []
    const fetchResult = await HttpProxy.requestFetch(requestData, statusCode => {
      response.writeHead(statusCode)
    }, headers => {
      Object.keys(headers).forEach(key => {
        // if(key.toLowerCase() === 'content-length') {
        //   // response.setContentLength(parseInt(headers[key]))
        //   hilog.info(0x0000, HttpServer.name, date + ' http proxy content-length: ' + headers[key]);
        // }
        if (requestData.setCookieRename && key.toLowerCase() === "set-cookie"){
          response.setHeader("Set-Cookie-Renamed", headers[key])
        }
        if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() === 'content-length') {
          response.setHeader(key, headers[key])
        }
      })
    }, data => {
      data && promiseAll.push(response.writeBlock(buffer.from(data)))
    }, () => {
    })
    if (promiseAll.length > 0) {
      await Promise.all(promiseAll)
    } else if (fetchResult) {
      response.writeHead(fetchResult.response.statusCode)
      Object.keys(fetchResult.response.headers).forEach(key => {
        if (key.toLowerCase() === 'content-length') {
          // response.setContentLength(parseInt(headers[key]))
        }
        if (requestData.setCookieRename && key.toLowerCase() === "set-cookie"){
          response.setHeader("Set-Cookie-Renamed", fetchResult.response.headers[key])
        }
        if (key.toLowerCase() !== 'content-encoding' && key.toLowerCase() !== 'content-length') {
          response.setHeader(key, fetchResult.response.headers[key])
        }
      })
      fetchResult.response.body && await response.writeBody(buffer.from(fetchResult.response.body))
    }
    hilog.info(0x0000, HttpServer.name, date + `http proxy ${fetchResult.response.statusCode} on [${requestData.url}]`);
    if (fetchResult) {
      fetchResult.session.close()
    }
    await response.end()
  }

  @HttpRouter('ws')
  async setWS(request: PolkaRequest, response: PolkaResponse) {
    const websocket = new PolkaWebSocket(request.getPolka(), response.getPolka(), msg => {
      hilog.info(0x0000, HttpServer.name, ' http ws msg: ' + msg);
    })
    this.websockets.add(websocket)
    websocket.start()
    this.audioPlayer.onStatusChange(websocket.sendJson)
    websocket.onClose(() => this.audioPlayer.offStatusChange(websocket.sendJson))
  }
}