package main

import (
	"bytes"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/websocket"
)

func TestLogEndpointRequiresTokenAndReturnsTail(t *testing.T) {
	dataDir := t.TempDir()
	logFile := filepath.Join(dataDir, "logs", "room-server.log")
	if err := os.MkdirAll(filepath.Dir(logFile), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(logFile, []byte("first line\nsecond line\n"), 0600); err != nil {
		t.Fatal(err)
	}
	store, err := newRoomStore(Config{
		DataDir: dataDir, TokenSecret: []byte("log-endpoint-test-secret"),
		LogFile: logFile, LogViewToken: "view-secret",
	})
	if err != nil {
		t.Fatal(err)
	}
	handler := (&server{store: store}).routes()

	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/v1/logs?token=wrong", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized log response: %d %s", unauthorized.Code, unauthorized.Body.String())
	}

	authorized := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/logs?bytes=12", nil)
	request.Header.Set("Authorization", "Bearer view-secret")
	handler.ServeHTTP(authorized, request)
	if authorized.Code != http.StatusOK || !bytes.Contains(authorized.Body.Bytes(), []byte("second line")) || bytes.Contains(authorized.Body.Bytes(), []byte("first line")) {
		t.Fatalf("authorized log response: %d %q", authorized.Code, authorized.Body.String())
	}
	if authorized.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("log responses must not be cached")
	}
}

func TestRotatingLogWriter(t *testing.T) {
	path := filepath.Join(t.TempDir(), "server.log")
	writer, err := newRotatingLogWriter(path, 12, 2)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := writer.Write([]byte("first-line\n")); err != nil {
		t.Fatal(err)
	}
	if _, err := writer.Write([]byte("second-line\n")); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	current, err := os.ReadFile(path)
	if err != nil || string(current) != "second-line\n" {
		t.Fatalf("current log: %q, error: %v", current, err)
	}
	backup, err := os.ReadFile(path + ".1")
	if err != nil || string(backup) != "first-line\n" {
		t.Fatalf("rotated log: %q, error: %v", backup, err)
	}
}

func TestRequestLoggerSupportsWebSocketAndOmitsQuerySecrets(t *testing.T) {
	dataDir := t.TempDir()
	logFile := filepath.Join(dataDir, "server.log")
	writer, err := newRotatingLogWriter(logFile, 1024*1024, 1)
	if err != nil {
		t.Fatal(err)
	}
	logger := &appLogger{logger: log.New(writer, "", 0), file: writer}
	store, err := newRoomStore(Config{
		DataDir: dataDir, MaxRooms: 50, MaxMembersPerRoom: 30,
		TokenSecret: []byte("websocket-logger-test-secret"),
	})
	if err != nil {
		t.Fatal(err)
	}
	room, _, err := store.createRoom(CreateRoomRequest{
		Name: "日志测试", Nickname: "测试用户", VisitorID: "visitor", Fingerprint: "fingerprint", AdminPassword: "administrator-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer((&server{store: store, logger: logger}).routes())
	secretToken := "must-not-appear-in-logs"
	config, err := websocket.NewConfig(
		"ws"+strings.TrimPrefix(httpServer.URL, "http")+"/ws?roomId="+room.config.ID+"&memberToken="+secretToken,
		httpServer.URL,
	)
	if err != nil {
		t.Fatal(err)
	}
	connection, err := websocket.DialConfig(config)
	if err != nil {
		t.Fatal(err)
	}
	_ = connection.SetDeadline(time.Now().Add(3 * time.Second))
	var event Event
	if err := websocket.JSON.Receive(connection, &event); err != nil || event.Code != "invalid_member_token" {
		t.Fatalf("unexpected rejection: %#v, error: %v", event, err)
	}
	if err := websocket.JSON.Receive(connection, &Event{}); err != io.EOF {
		t.Fatalf("expected rejected connection to close, got: %v", err)
	}
	_ = connection.Close()
	httpServer.Close()
	if err := logger.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(data, []byte("ws_rejected")) || !bytes.Contains(data, []byte(`path="/ws"`)) {
		t.Fatalf("WebSocket diagnostics were not written: %s", data)
	}
	if bytes.Contains(data, []byte(secretToken)) {
		t.Fatal("memberToken leaked into the log file")
	}
}
