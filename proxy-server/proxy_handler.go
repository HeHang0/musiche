package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

func ProxyHandler(writer http.ResponseWriter, request *http.Request) {
	queryParams := request.URL.Query()
	queryUrl := strings.Trim(queryParams.Get("url"), " ")
	var requestData *RequestData
	setCors(writer)
	if request.Method == "options" {
		return
	}
	if strings.HasPrefix(queryUrl, "http") {
		requestData = &RequestData{Url: queryUrl}
		requestData.Headers = map[string]string{}
		for key, value := range request.Header {
			requestData.Headers[key] = strings.Join(value, ",")
		}
	} else {
		body := make([]byte, request.ContentLength)
		_, _ = request.Body.Read(body)
		requestData = ParseRequestData(body)
	}
	statusCode, reader, headers := sendRequest(requestData)

	if !requestData.AllowAutoRedirect && statusCode > 300 && statusCode < 310 {
		resHeaders := make(map[string]string)
		for key, value := range headers {
			if len(value) > 0 {
				resHeaders[key] = value[0]
			}
		}
		headerBytes, _ := json.Marshal(resHeaders)
		statusCode = http.StatusOK
		reader = bytes.NewReader(headerBytes)
		headers = map[string][]string{
			"Content-Type": {"application/json;charset=UTF-8"},
		}
	}

	setResponseHeaders(writer, headers)
	if requestData.SetCookieRename {
		setCookie := headers["Set-Cookie"]
		if setCookie != nil {
			writer.Header().Set("Set-Cookie-Renamed", strings.Join(setCookie, "; "))
		}
	}
	writer.WriteHeader(statusCode)
	if reader != nil {
		_, _ = io.Copy(writer, reader)
	}
}

func sendRequest(requestData *RequestData) (int, io.Reader, http.Header) {
	request, err := http.NewRequest(requestData.HttpMethod(), requestData.Url, requestData.BodyReader())
	if err != nil {
		return http.StatusBadRequest, nil, nil
	}
	setRequestHeaders(request, requestData.Headers)
	client := &http.Client{
		CheckRedirect: requestData.CheckRedirect,
	}
	response, err := client.Do(request)
	if err != nil {
		return http.StatusBadRequest, nil, nil
	}
	return response.StatusCode, response.Body, response.Header
}

func setRequestHeaders(request *http.Request, headers map[string]string) {
	if headers == nil {
		return
	}
	for key, value := range headers {
		switch strings.Replace(strings.ToLower(key), "-", "", -1) {
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

func setResponseHeaders(response http.ResponseWriter, headers http.Header) {
	if headers == nil {
		return
	}
	for key, value := range headers {
		switch strings.Replace(strings.ToLower(key), "-", "", -1) {
		case "cookies":
		case "connection":
		case "contentlength":
		case "transferencoding":
		case "accesscontrolalloworigin":
		case "accesscontrolallowheaders":
		case "accesscontrolallowmethods":
		case "accesscontrolexposeheaders":
		case "accesscontrolallowcredentials":
		default:
			response.Header().Set(key, strings.Join(value, ", "))
		}
	}
}

func setCors(response http.ResponseWriter) {
	response.Header().Set("Access-Control-Allow-Origin", "*")
	response.Header().Set("Access-Control-Allow-Headers", "*")
	response.Header().Set("Access-Control-Allow-Methods", "*")
	response.Header().Set("Access-Control-Expose-Headers", "*")
	response.Header().Set("Access-Control-Allow-Credentials", "true")
}
