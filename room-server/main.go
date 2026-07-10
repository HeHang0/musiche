package main

import (
	"log"
	"net/http"
	"time"
)

func main() {
	config := loadConfig()
	store, err := newRoomStore(config)
	if err != nil {
		log.Fatal(err)
	}
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			store.removeExpiredRooms()
		}
	}()
	log.Printf("Musiche room service listening on %s (data: %s)", config.Address, config.DataDir)
	if err := http.ListenAndServe(config.Address, (&server{store: store}).routes()); err != nil {
		log.Fatal(err)
	}
}
