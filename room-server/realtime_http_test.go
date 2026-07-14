package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/websocket"
)

func TestHTTPRealtimeStreamAndCommands(t *testing.T) {
	store, err := newRoomStore(Config{
		DataDir: t.TempDir(), MaxRooms: 50, MaxMembersPerRoom: 30,
		EmptyTTL: 30 * time.Minute, MaxChatMessages: 500,
		TokenSecret: []byte("http-realtime-test-token-secret"),
	})
	if err != nil {
		t.Fatal(err)
	}
	room, adminToken, err := store.createRoom(CreateRoomRequest{
		Name: "HTTP 流测试", Nickname: "小明", VisitorID: "visitor", Fingerprint: "fingerprint", AdminPassword: "administrator-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	memberToken := issueMemberToken(store.config.TokenSecret, room.config.ID, fingerprintHash("visitor", "fingerprint"))
	httpServer := httptest.NewServer((&server{store: store}).routes())
	defer httpServer.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	connectionID := "http-test-connection"
	streamRequest, err := http.NewRequestWithContext(ctx, http.MethodGet, httpServer.URL+"/api/v1/realtime/stream?roomId="+room.config.ID+"&connectionId="+connectionID, nil)
	if err != nil {
		t.Fatal(err)
	}
	streamRequest.Header.Set("Authorization", "Bearer "+memberToken)
	if strings.Contains(streamRequest.URL.String(), memberToken) {
		t.Fatal("HTTP realtime stream leaked memberToken into the URL")
	}
	streamResponse, err := http.DefaultClient.Do(streamRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer streamResponse.Body.Close()
	if streamResponse.StatusCode != http.StatusOK || !strings.HasPrefix(streamResponse.Header.Get("Content-Type"), "application/x-ndjson") {
		t.Fatalf("stream response: %d %s", streamResponse.StatusCode, streamResponse.Header.Get("Content-Type"))
	}
	decoder := json.NewDecoder(streamResponse.Body)
	var initial Event
	if err := decoder.Decode(&initial); err != nil || initial.Type != "snapshot" {
		t.Fatalf("initial stream event: %#v, error: %v", initial, err)
	}
	var presence Event
	if err := decoder.Decode(&presence); err != nil || presence.Type != "presence" {
		t.Fatalf("presence stream event: %#v, error: %v", presence, err)
	}

	postCommand := func(command ClientCommand) *http.Response {
		t.Helper()
		body, _ := json.Marshal(realtimeCommandRequest{RoomID: room.config.ID, ConnectionID: connectionID, Command: command})
		request, err := http.NewRequest(http.MethodPost, httpServer.URL+"/api/v1/realtime/command", bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		request.Header.Set("Authorization", "Bearer "+memberToken)
		request.Header.Set("Content-Type", "application/json")
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		return response
	}

	authResponse := postCommand(ClientCommand{Action: "auth_admin", AdminToken: adminToken})
	if authResponse.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(authResponse.Body)
		_ = authResponse.Body.Close()
		t.Fatalf("admin command: %d %s", authResponse.StatusCode, data)
	}
	_ = authResponse.Body.Close()
	var adminSnapshot Event
	if err := decoder.Decode(&adminSnapshot); err != nil || adminSnapshot.Type != "snapshot" {
		t.Fatalf("admin stream event: %#v, error: %v", adminSnapshot, err)
	}
	if data, ok := adminSnapshot.Data.(map[string]interface{}); !ok || data["isAdmin"] != true {
		t.Fatalf("HTTP stream did not retain administrator state: %#v", adminSnapshot.Data)
	}

	queueResponse := postCommand(ClientCommand{Action: "queue_add", AdminToken: adminToken, Music: &Music{ID: "http-track", Name: "HTTP 歌曲", Singer: "歌手", Type: "qq"}})
	if queueResponse.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(queueResponse.Body)
		_ = queueResponse.Body.Close()
		t.Fatalf("queue command: %d %s", queueResponse.StatusCode, data)
	}
	_ = queueResponse.Body.Close()
	var queueSnapshot Event
	if err := decoder.Decode(&queueSnapshot); err != nil || queueSnapshot.Type != "snapshot" {
		t.Fatalf("queue stream event: %#v, error: %v", queueSnapshot, err)
	}
	var queueChat Event
	if err := decoder.Decode(&queueChat); err != nil || queueChat.Type != "chat" {
		t.Fatalf("queue chat event: %#v, error: %v", queueChat, err)
	}

	cancel()
	_ = streamResponse.Body.Close()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		room.mu.RLock()
		connected := len(room.connections)
		room.mu.RUnlock()
		if connected == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("HTTP realtime connection did not close")
}

func TestHTTPRealtimeCORSAllowsAuthorizationHeader(t *testing.T) {
	store, err := newRoomStore(Config{DataDir: t.TempDir(), TokenSecret: []byte("http-realtime-cors-test")})
	if err != nil {
		t.Fatal(err)
	}
	handler := (&server{store: store}).routes()
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/realtime/stream", nil)
	request.Header.Set("Origin", "https://example.com")
	request.Header.Set("Access-Control-Request-Headers", "authorization")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || !strings.Contains(strings.ToLower(response.Header().Get("Access-Control-Allow-Headers")), "authorization") {
		t.Fatalf("realtime CORS preflight: %d %q", response.Code, response.Header().Get("Access-Control-Allow-Headers"))
	}
}

func TestHTTPRealtimeRejectsInvalidMemberToken(t *testing.T) {
	store, err := newRoomStore(Config{DataDir: t.TempDir(), TokenSecret: []byte("http-realtime-invalid-token-test")})
	if err != nil {
		t.Fatal(err)
	}
	room, _, err := store.createRoom(CreateRoomRequest{
		Name: "HTTP 鉴权测试", Nickname: "小明", VisitorID: "visitor", Fingerprint: "fingerprint", AdminPassword: "administrator-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer((&server{store: store}).routes())
	defer httpServer.Close()
	request, _ := http.NewRequest(http.MethodGet, httpServer.URL+"/api/v1/realtime/stream?roomId="+room.config.ID+"&connectionId=invalid-token-test", nil)
	request.Header.Set("Authorization", "Bearer invalid")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var result map[string]string
	_ = json.NewDecoder(response.Body).Decode(&result)
	if response.StatusCode != http.StatusUnauthorized || result["code"] != "invalid_member_token" {
		t.Fatalf("invalid token response: %d %#v", response.StatusCode, result)
	}
}

func TestWebSocketProbeDoesNotJoinRoom(t *testing.T) {
	store, err := newRoomStore(Config{DataDir: t.TempDir(), TokenSecret: []byte("websocket-probe-test-secret")})
	if err != nil {
		t.Fatal(err)
	}
	room, _, err := store.createRoom(CreateRoomRequest{
		Name: "探测测试", Nickname: "小明", VisitorID: "visitor", Fingerprint: "fingerprint", AdminPassword: "administrator-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	memberToken := issueMemberToken(store.config.TokenSecret, room.config.ID, fingerprintHash("visitor", "fingerprint"))
	httpServer := httptest.NewServer((&server{store: store}).routes())
	defer httpServer.Close()
	config, _ := websocket.NewConfig(
		"ws"+strings.TrimPrefix(httpServer.URL, "http")+"/ws?probe=1&roomId="+room.config.ID+"&memberToken="+memberToken,
		httpServer.URL,
	)
	connection, err := websocket.DialConfig(config)
	if err != nil {
		t.Fatal(err)
	}
	_ = connection.SetDeadline(time.Now().Add(3 * time.Second))
	var event Event
	if err := websocket.JSON.Receive(connection, &event); err != nil || event.Type != "probe" {
		t.Fatalf("probe event: %#v, error: %v", event, err)
	}
	if err := websocket.JSON.Receive(connection, &Event{}); !errors.Is(err, io.EOF) {
		t.Fatalf("probe connection was not closed: %v", err)
	}
	room.mu.RLock()
	connected := len(room.connections)
	room.mu.RUnlock()
	if connected != 0 {
		t.Fatalf("probe changed online count: %d", connected)
	}
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		store.mu.RLock()
		totalConnections := store.connections
		store.mu.RUnlock()
		if totalConnections == 0 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("probe leaked global connection count")
}
