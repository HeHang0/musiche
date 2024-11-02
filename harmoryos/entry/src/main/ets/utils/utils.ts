import { buffer, util } from "@kit.ArkTS";
import { cryptoFramework } from "@kit.CryptoArchitectureKit";
import { rcp } from "@kit.RemoteCommunicationKit";

export async function aesEncrypt(text: string, keyText: string) {
  if (!text || !keyText) {
    return "";
  }
  const ivText = {
    algName: "IvParamsSpec",
    iv: { data: new Uint8Array(buffer.from('0102030405060708', 'utf-8').buffer) }
  };
  let plainText: cryptoFramework.DataBlob = { data: new Uint8Array(buffer.from(text, 'utf-8').buffer) }
  const symKey = genSymKeyByData(new Uint8Array(buffer.from(keyText, 'utf-8').buffer))
  let cipher = cryptoFramework.createCipher('AES128|CBC|PKCS7');
  await cipher.init(cryptoFramework.CryptoMode.ENCRYPT_MODE, symKey, ivText);
  let cipherData = await cipher.doFinal(plainText);
  return uint8ArrayToBase64(cipherData.data);
}

function genSymKeyByData(symKeyData: Uint8Array) {
  let symKeyBlob: cryptoFramework.DataBlob = { data: symKeyData };
  let aesGenerator = cryptoFramework.createSymKeyGenerator('AES128');
  let symKey = aesGenerator.convertKeySync(symKeyBlob);
  console.info('convertKeySync success');
  return symKey;
}

export function stringToUint8Array(str) {
  var arr = [];
  for (var i = 0, j = str.length; i < j; ++i) {
    arr.push(str.charCodeAt(i));
  }

  var tmpUint8Array = new Uint8Array(arr);
  return tmpUint8Array
}

export function uint8ArrayToString(data: Uint8Array) {
  return buffer.from(data).toString('utf8')
}

export async function uint8ArrayToBase64(data: Uint8Array) {
  let base64 = new util.Base64Helper();
  return await base64.encodeToString(data)
}

export async function httpRequest(url: string, method: rcp.HttpMethod, headers: rcp.RequestHeaders, data?: string,
  cookies?: rcp.RequestCookies) {
  const session = rcp.createSession();
  const request = new rcp.Request(url, method, headers, data, cookies, [], {
    transfer: {
      autoRedirect: true,
      maxAutoRedirects: 5
    }
  });
  const response = await session.fetch(request)
  return response.body ? buffer.from(new Uint8Array(response.body)).toString() : ''
}

export function jsonParse(text: string): Record<string, string> {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export function getRandomInt(min: number, max?: number) {
  if(isNaN(max)) {
    max = min
    min = 0
  }
  const minCeil = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeil) + minCeil); // 包含最大值，最小值
}

export function formatDuration(duration?: number){
  if(isNaN(duration) || duration <= 0) {
    return '00:00'
  }
  const totalSecond = Math.ceil(duration / 1000)
  const minute = Math.floor(totalSecond / 60)
  const second = Math.floor(totalSecond % 60)
  return `${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
}

export function formatTime(duration?: string): number {
  if(typeof duration !== 'string') {
    return 0
  }
  const durations = duration?.split(':') || []
  let result = 0
  for (let i = durations.length - 1; i >= 0; i--) {
    const num = parseInt(durations[i])
    if(isNaN(num)) {
      break
    }
    result += parseInt(durations[i]) * Math.pow(60, durations.length - i)
  }
  return result
}