package main

import (
	"flag"
	"fmt"
	"net/http"
)

var HttpProxyUrl string

func main() {
	flag.StringVar(&HttpProxyUrl, "proxy", "", "HTTP Proxy URL (e.g., http://127.0.0.1:1080)")
	flag.Parse()

	http.HandleFunc("/", ProxyHandler)
	fmt.Println("server start at :8737")
	_ = http.ListenAndServe(":8737", nil)
}
