package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type RequestData struct {
	Url               string            `json:"url"`
	Method            string            `json:"method"`
	Data              string            `json:"data"`
	AllowAutoRedirect bool              `json:"allowAutoRedirect"`
	SetCookieRename   bool              `json:"setCookieRename"`
	Headers           map[string]string `json:"headers"`
}

func (requestData *RequestData) HttpMethod() string {
	if requestData.Method == "" {
		return "GET"
	}
	return requestData.Method
}

func (requestData *RequestData) BodyReader() io.Reader {
	if requestData.Data == "" {
		return nil
	}
	return strings.NewReader(requestData.Data)
}

func (requestData *RequestData) HasBody() bool {
	return len(requestData.Data) > 0
}

func (requestData *RequestData) CheckRedirect(req *http.Request, via []*http.Request) error {
	if requestData.AllowAutoRedirect {
		return nil
	}
	return http.ErrUseLastResponse
}

func ParseRequestData(data []byte) *RequestData {
	requestData := &RequestData{
		AllowAutoRedirect: true,
		Method:            "GET",
	}
	_ = json.Unmarshal(data, requestData)
	return requestData
}
