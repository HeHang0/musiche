package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type proxyRequestData struct {
	URL               string            `json:"url"`
	Method            string            `json:"method"`
	Data              string            `json:"data"`
	AllowAutoRedirect bool              `json:"allowAutoRedirect"`
	SetCookieRename   bool              `json:"setCookieRename"`
	Headers           map[string]string `json:"headers"`
}

func (data *proxyRequestData) httpMethod() string {
	if data.Method == "" {
		return http.MethodGet
	}
	return data.Method
}

func (data *proxyRequestData) bodyReader() io.Reader {
	if data.Data == "" {
		return nil
	}
	return strings.NewReader(data.Data)
}

func (data *proxyRequestData) checkRedirect(request *http.Request, _ []*http.Request) error {
	if data.AllowAutoRedirect {
		return nil
	}
	return http.ErrUseLastResponse
}

func parseSetCookie(values []string) string {
	for i := 0; i < len(values); i++ {
		values[i] = strings.ReplaceAll(values[i], ",", "")
	}
	return strings.Join(values, ",")
}

func (s *server) proxy(writer http.ResponseWriter, request *http.Request) {
	if request.Method == http.MethodOptions {
		return
	}

	queryURL := strings.TrimSpace(request.URL.Query().Get("url"))
	data := &proxyRequestData{}
	if strings.HasPrefix(queryURL, "http") {
		data.URL = queryURL
		data.Headers = map[string]string{}
		for key, values := range request.Header {
			data.Headers[key] = strings.Join(values, ",")
		}
	} else {
		body, err := io.ReadAll(io.LimitReader(request.Body, 10*1024*1024))
		if err != nil {
			writeError(writer, http.StatusBadRequest, "代理请求读取失败")
			return
		}
		if err := json.Unmarshal(body, data); err != nil || data.URL == "" {
			writeError(writer, http.StatusBadRequest, "代理请求格式错误")
			return
		}
	}

	statusCode, responseBody, headers := sendProxyRequest(data)
	if responseBody != nil {
		defer responseBody.Close()
	}
	if !data.AllowAutoRedirect && statusCode > 300 && statusCode < 310 {
		responseHeaders := make(map[string]string)
		for key, values := range headers {
			if len(values) > 0 {
				responseHeaders[key] = strings.Join(values, "; ")

			}
		}
		if data.SetCookieRename && headers != nil {
			if setCookie := headers.Values("Set-Cookie"); len(setCookie) > 0 {
				responseHeaders["Set-Cookie-Renamed"] = parseSetCookie(setCookie)
			}
		}
		headerBytes, _ := json.Marshal(responseHeaders)
		statusCode = http.StatusOK
		responseBody = io.NopCloser(bytes.NewReader(headerBytes))
		headers = http.Header{"Content-Type": []string{"application/json;charset=UTF-8"}}
	}

	setProxyResponseHeaders(writer, headers)
	if data.SetCookieRename && headers != nil {
		if setCookie := headers.Values("Set-Cookie"); len(setCookie) > 0 {
			writer.Header().Set("Set-Cookie-Renamed", parseSetCookie(setCookie))
		}
	}
	writer.WriteHeader(statusCode)
	if responseBody != nil {
		_, _ = io.Copy(writer, responseBody)
	}
}

func sendProxyRequest(data *proxyRequestData) (int, io.ReadCloser, http.Header) {
	request, err := http.NewRequest(data.httpMethod(), data.URL, data.bodyReader())
	if err != nil {
		return http.StatusBadRequest, nil, nil
	}
	setProxyRequestHeaders(request, data.Headers)
	response, err := (&http.Client{CheckRedirect: data.checkRedirect}).Do(request)
	if err != nil {
		return http.StatusBadRequest, nil, nil
	}
	return response.StatusCode, response.Body, response.Header
}

func setProxyRequestHeaders(request *http.Request, headers map[string]string) {
	for key, value := range headers {
		switch strings.ReplaceAll(strings.ToLower(key), "-", "") {
		case "referer":
			request.Header.Set("Referer", value)
		case "useragent":
			request.Header.Set("User-Agent", value)
		case "contenttype":
			request.Header.Set("Content-Type", value)
		case "accept":
			request.Header.Set("Accept", value)
		case "host":
		default:
			request.Header.Set(key, value)
		}
	}
}

func setProxyResponseHeaders(response http.ResponseWriter, headers http.Header) {
	for key, values := range headers {
		switch strings.ReplaceAll(strings.ToLower(key), "-", "") {
		case "connection", "contentlength", "transferencoding",
			"accesscontrolalloworigin", "accesscontrolallowheaders",
			"accesscontrolallowmethods", "accesscontrolexposeheaders",
			"accesscontrolallowcredentials":
		default:
			response.Header().Set(key, strings.Join(values, ", "))
		}
	}
}
