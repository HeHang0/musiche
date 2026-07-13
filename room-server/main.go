package main

import (
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	config := loadConfig()
	logger, err := newAppLogger(config)
	if err != nil {
		log.Fatal(err)
	}
	defer logger.Close()
	store, err := newRoomStore(config)
	if err != nil {
		logger.Printf("fatal component=store error=%q", err)
		_ = logger.Close()
		os.Exit(1)
	}
	store.logger = logger
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			store.removeExpiredRooms()
		}
	}()
	logger.Printf("service_started address=%q data_dir=%q log_file=%q log_api_enabled=%t", config.Address, config.DataDir, config.LogFile, config.LogViewToken != "")
	if err := http.ListenAndServe(config.Address, (&server{store: store, logger: logger}).routes()); err != nil {
		logger.Printf("fatal component=http error=%q", err)
		_ = logger.Close()
		os.Exit(1)
	}
}
