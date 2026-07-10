package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/websocket"
)

func TestRoomHTTPFlow(t *testing.T) {
	store, err := newRoomStore(Config{
		DataDir: t.TempDir(), MaxRooms: 50, MaxMembersPerRoom: 30,
		EmptyTTL: 30 * time.Minute, MaxChatMessages: 500,
		TokenSecret: []byte("test-token-secret-test-token-secret"),
	})
	if err != nil {
		t.Fatal(err)
	}
	handler := (&server{store: store}).routes()
	body, _ := json.Marshal(CreateRoomRequest{
		Name: "接口测试", Nickname: "小明", VisitorID: "visitor-one", Fingerprint: "fingerprint-one", AdminPassword: "administrator-password",
	})
	create := httptest.NewRecorder()
	handler.ServeHTTP(create, httptest.NewRequest(http.MethodPost, "/api/v1/rooms", bytes.NewReader(body)))
	if create.Code != http.StatusCreated {
		t.Fatalf("create status: %d, body: %s", create.Code, create.Body.String())
	}
	var created struct {
		Snapshot   Snapshot `json:"snapshot"`
		AdminToken string   `json:"adminToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Snapshot.Room.Name != "接口测试" || created.AdminToken == "" {
		t.Fatal("unexpected create response")
	}

	list := httptest.NewRecorder()
	handler.ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/v1/rooms?keyword=接口", nil))
	if list.Code != http.StatusOK || !bytes.Contains(list.Body.Bytes(), []byte("接口测试")) {
		t.Fatalf("list response: %s", list.Body.String())
	}

	joinBody, _ := json.Marshal(JoinRequest{Nickname: "小红", VisitorID: "visitor-two", Fingerprint: "fingerprint-two"})
	join := httptest.NewRecorder()
	handler.ServeHTTP(join, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/join", bytes.NewReader(joinBody)))
	if join.Code != http.StatusOK {
		t.Fatalf("join status: %d, body: %s", join.Code, join.Body.String())
	}

	adminBody, _ := json.Marshal(AdminRequest{AdminPassword: "administrator-password", VisitorID: "visitor-two", Fingerprint: "fingerprint-two"})
	admin := httptest.NewRecorder()
	handler.ServeHTTP(admin, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/admin", bytes.NewReader(adminBody)))
	if admin.Code != http.StatusOK {
		t.Fatalf("admin status: %d, body: %s", admin.Code, admin.Body.String())
	}

	resolvedBody, _ := json.Marshal(ResolvedCacheRequest{
		Music:     Music{ID: "track-id", Name: "缓存歌曲", Singer: "歌手", Type: "qq", URL: "https://example.com/music.mp3"},
		VisitorID: "visitor-one", Fingerprint: "fingerprint-one", AdminToken: created.AdminToken,
	})
	resolved := httptest.NewRecorder()
	handler.ServeHTTP(resolved, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/resolved", bytes.NewReader(resolvedBody)))
	if resolved.Code != http.StatusOK {
		t.Fatalf("resolved cache status: %d, body: %s", resolved.Code, resolved.Body.String())
	}
	resolveBody, _ := json.Marshal(ResolveRequest{Music: Music{ID: "track-id", Name: "缓存歌曲", Singer: "歌手", Type: "qq"}, VisitorID: "visitor-two", Fingerprint: "fingerprint-two"})
	resolve := httptest.NewRecorder()
	handler.ServeHTTP(resolve, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/resolve", bytes.NewReader(resolveBody)))
	if resolve.Code != http.StatusOK || !bytes.Contains(resolve.Body.Bytes(), []byte("https://example.com/music.mp3")) {
		t.Fatalf("resolve cache response: %s", resolve.Body.String())
	}
}

func TestWebSocketQueueCommand(t *testing.T) {
	store, err := newRoomStore(Config{
		DataDir: t.TempDir(), MaxRooms: 50, MaxMembersPerRoom: 30,
		EmptyTTL: 30 * time.Minute, MaxChatMessages: 500,
		TokenSecret: []byte("test-token-secret-test-token-secret"),
	})
	if err != nil {
		t.Fatal(err)
	}
	room, _, err := store.createRoom(CreateRoomRequest{Name: "WebSocket 测试", Nickname: "小明", VisitorID: "visitor", Fingerprint: "fingerprint", AdminPassword: "administrator-password"})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer((&server{store: store}).routes())
	defer httpServer.Close()
	url := "ws" + strings.TrimPrefix(httpServer.URL, "http") + "/ws?roomId=" + room.config.ID + "&visitorId=visitor&fingerprint=fingerprint"
	config, err := websocket.NewConfig(url, httpServer.URL)
	if err != nil {
		t.Fatal(err)
	}
	connection, err := websocket.DialConfig(config)
	if err != nil {
		t.Fatal(err)
	}
	_ = connection.SetDeadline(time.Now().Add(3 * time.Second))
	for i := 0; i < 2; i++ { // initial snapshot and presence
		var event Event
		if err := websocket.JSON.Receive(connection, &event); err != nil {
			t.Fatalf("initial event: %v", err)
		}
	}
	// 网易云 search results carry numeric song and album IDs. The browser sends
	// those values as JSON numbers, so this uses a raw browser-equivalent frame.
	if err := websocket.Message.Send(connection, `{"action":"queue_add","music":{"id":123456,"albumId":654321,"name":"测试歌曲","singer":"测试歌手","type":"cloud"}}`); err != nil {
		t.Fatal(err)
	}
	var event Event
	if err := websocket.JSON.Receive(connection, &event); err != nil {
		t.Fatalf("queue response: %v", err)
	}
	if event.Type != "snapshot" {
		t.Fatalf("expected snapshot after queue command, got %s", event.Type)
	}
	room.mu.RLock()
	if len(room.state.Queue) != 1 || room.state.Queue[0].Music.ID != "123456" {
		room.mu.RUnlock()
		t.Fatal("queue command did not persist")
	}
	room.mu.RUnlock()
	_ = connection.Close()
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
	t.Fatal("websocket connection did not close")
}
