import { IncomingMessage, ServerResponse } from "@ohos/polka";
import { NanoHTTPD } from "@ohos/polka/src/main/ets/http/core/NanoHTTPD";

export default class Server extends NanoHTTPD {
  constructor(options = {}) {
    super(options);
  }

  public serve(req: IncomingMessage, res: ServerResponse){
    // if (('PUT' === req.method) || ('POST' === req.method)) {
    //   req.files = new Map();
    //   req.parseBody(req.files, () => {
    //     this.emit('request', req, res);
    //   })
    // } else {
    //   this.emit('request', req, res);
    // }
    this.emit('request', req, res);
  }

  public listen(port?: number, ...rest): void {
    if(port !== undefined) {
      this.myPort = port;
    }
    if(rest.length === 1) {
      if(typeof rest[0] === 'string') {
        this.hostname = rest[1];
      }
      if(typeof rest[0] === 'function') {
        this.listeningListener = rest[0];
      }
    } else if(rest.length === 2) {
      this.hostname = rest[0];
      this.listeningListener = rest[1];
    }
    this.start();
  }
}