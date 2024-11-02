import { ServerResponse, Request } from "@ohos/polka";
import { PolkaResponse } from "./PolkaResponse";
import { util } from '@kit.ArkTS';
import { cryptoFramework } from "@kit.CryptoArchitectureKit";
import { socket } from "@kit.NetworkKit";
import { Callback } from "@kit.BasicServicesKit";
import { buffer } from "@kit.ArkTS";
import { stringToUint8Array } from "../utils/utils";

export class PolkaWebSocket {
  private response: ServerResponse
  private request: Request
  private sending = false;
  private sendQueue:{resolve: (value: unknown) => void,data: string|ArrayBuffer}[] = [];
  private onMessage: Callback<string|buffer.Buffer>;
  constructor(request: Request, response: ServerResponse, onMessage: Callback<string|buffer.Buffer>) {
    this.request = request
    this.response = response
    this.onMessage = onMessage
  }

  public static isWebSocket(request: Request): boolean{
    const headers = request.getHeaders()
    if (headers['upgrade']?.toLowerCase() !== 'websocket' || headers['connection']?.toLowerCase() !== 'upgrade') {
      return false;
    }
    return true
  }

  public start(){
    this.response.client.on('message', this.onClientMessage.bind(this))
    this.response.client.on('close', this.onClientClose.bind(this))
    this.sendShakeHands()
  }

  private tmpData = buffer.alloc(0)
  private onClientMessage(msg: socket.SocketMessageInfo){
    const {isFinal, opcode, payload} = this.parseWebSocketFrame(buffer.from(new Uint8Array(msg.message)));

    if (opcode === 0x8) { // 关闭连接帧
      this.destroy()
      return;
    }
    if (opcode === 0x9) { // PING帧
      this.sendSocket(this.createWebSocketFrame(buffer.from([]), 0xA))
      return;
    }

    if(!isFinal) {
      this.tmpData = buffer.concat([this.tmpData, payload])
      return
    }

    if (opcode === 0x1 && isFinal) { // 文本帧
      this.onMessage(payload.toString('utf-8'))
    }else if (opcode === 0x2 && isFinal) { // 二进制帧
      this.onMessage(buffer.concat([this.tmpData, payload]))
    }

    if(isFinal) {
      this.tmpData = buffer.alloc(0)
    }
  }

  private onStatusChangeSet: Set<Callback<void>> = new Set()
  public onClose(callback: Callback<void>){
    this.onStatusChangeSet.add(callback)
  }
  public offClose(callback: Callback<void>){
    this.onStatusChangeSet.delete(callback)
  }
  private onClientClose(){
    this.onStatusChangeSet.forEach(m => m())
    this.onStatusChangeSet.clear()
  }

  public sendMessage(message: string|buffer.Buffer){
    if(typeof message === 'string') {
      this.sendSocket(this.createWebSocketFrame(buffer.from(message, 'utf8'), 0x1))
    }else {
      this.sendSocket(this.createWebSocketFrame(message, 0x2))
    }
  }

  public sendJson = (data: object) => {
    this.sendMessage(JSON.stringify(data))
  }

  private async sendShakeHands(){
    const headers = this.request.getHeaders()
    const acceptKey = headers['sec-websocket-key'];
    const md = cryptoFramework.createMd('SHA1')
    await new Promise(resolve => {
      md.update({
        data: stringToUint8Array(acceptKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      }, resolve)
    })
    let base64 = new util.Base64Helper();
    const acceptValue = await base64.encodeToString((await md.digest()).data)

    // 3. 发送握手响应
    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Access-Control-Allow-Origin: *',
      'Access-Control-Allow-Headers: *',
      'Access-Control-Allow-Methods: *',
      'Access-Control-Expose-Headers: *',
      'Access-Control-Allow-Credentials: true',
      `Sec-WebSocket-Accept: ${acceptValue}`
    ];
    await this.sendSocket(responseHeaders.join('\r\n') + '\r\n\r\n');
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
    await this.response.client.send(tcpSendOption)
    while (true){
      const result = this.sendQueue.shift()
      if(!result) {
        break
      }
      await this.response.client.send({
        data: result.data,
      })
      result.resolve(void 0)
    }
    this.sending = false
  }

  // 解析 WebSocket 帧
  private parseWebSocketFrame(data: buffer.Buffer) {
    const isFinal = (data[0] & 0x80) !== 0;
    const opcode = data[0] & 0x0f;
    const isMasked = (data[1] & 0x80) !== 0;
    let payloadLength = data[1] & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      payloadLength = data.readUInt16BE(2);
      offset += 2;
    } else if (payloadLength === 127) {
      payloadLength = Number(data.readBigUInt64BE(2));
      offset += 8;
    }

    let maskingKey:Uint8Array;
    if (isMasked) {
      maskingKey = new Uint8Array(data.subarray(offset, offset + 4).buffer);
      offset += 4;
    }

    let payload = new Uint8Array(data.subarray(offset, offset + payloadLength).buffer);
    if (isMasked && maskingKey) {
      payload = payload.map((byte, i) => byte ^ maskingKey[i % 4]);
    }

    return {isFinal, opcode, payload: buffer.from(payload)};
  }

  // 创建 WebSocket 帧
  private createWebSocketFrame(payload: buffer.Buffer, opcode): ArrayBuffer {
    const isFinal = 0x80;
    let frame = buffer.alloc(2);
    frame[0] = isFinal | opcode;

    if (payload.length < 126) {
      frame[1] = payload.length;
    } else if (payload.length < 65536) {
      frame = buffer.concat([frame, buffer.alloc(2)]);
      frame[1] = 126;
      frame.writeUInt16BE(payload.length, 2);
    } else {
      frame = buffer.concat([frame, buffer.alloc(8)]);
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(payload.length), 2);
    }

    return buffer.concat([frame, payload]).buffer;
  }

  public destroy(){
    this.sendSocket(this.createWebSocketFrame(buffer.from([]), 0x8))
    this.response.client.close()
  }
}