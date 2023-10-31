package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", ProxyHandler)
	fmt.Println("server start at :8737")
	_ = http.ListenAndServe(":8737", nil)
}
