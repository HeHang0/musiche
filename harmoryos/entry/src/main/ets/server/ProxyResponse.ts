import { http } from "@kit.NetworkKit";

export interface ProxyResponse {
  data: string;
  contentType: string;
  statusCode: number;
  contentLength: number;
  headers?: Record<string, string[]>;
  stream?: http.HttpRequest
}

function getDefaultProxyRequest(){
  return {
    data: '',
    contentType: '',
    statusCode: 200,
    contentLength: 0,
  }
}

export function parseProxyResponse(res?: Partial<ProxyResponse>): ProxyResponse {
  const result = getDefaultProxyRequest();
  return {
    ...result,
    ...res
  }
}