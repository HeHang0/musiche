package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"golang.org/x/net/websocket"
)

func TestRoomHTTPFlow(t *testing.T) {
	store, err := newRoomStore(Config{
		DataDir: t.TempDir(), MaxRooms: 50, MaxMembersPerRoom: 30,
		EmptyTTL: 30 * time.Minute, MaxChatMessages: 500,
		TokenSecret:        []byte("test-token-secret-test-token-secret"),
		SuperAdminPassword: "super-room-password",
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
		Snapshot    Snapshot `json:"snapshot"`
		AdminToken  string   `json:"adminToken"`
		MemberToken string   `json:"memberToken"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Snapshot.Room.Name != "接口测试" || created.AdminToken == "" || created.MemberToken == "" {
		t.Fatal("unexpected create response")
	}

	list := httptest.NewRecorder()
	handler.ServeHTTP(list, httptest.NewRequest(http.MethodGet, "/api/v1/rooms?keyword=接口", nil))
	if list.Code != http.StatusOK || !bytes.Contains(list.Body.Bytes(), []byte("接口测试")) {
		t.Fatalf("list response: %s", list.Body.String())
	}

	missingBody, _ := json.Marshal(MissingRoomsRequest{IDs: []string{
		created.Snapshot.Room.ID,
		strings.ToLower(created.Snapshot.Room.ID),
		"MISSING",
	}})
	missing := httptest.NewRecorder()
	handler.ServeHTTP(missing, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/missing", bytes.NewReader(missingBody)))
	if missing.Code != http.StatusOK {
		t.Fatalf("missing rooms status: %d, body: %s", missing.Code, missing.Body.String())
	}
	var missingResult struct {
		MissingIDs []string `json:"missingIds"`
	}
	if err := json.Unmarshal(missing.Body.Bytes(), &missingResult); err != nil || len(missingResult.MissingIDs) != 1 || missingResult.MissingIDs[0] != "MISSING" {
		t.Fatalf("unexpected missing rooms response: %s", missing.Body.String())
	}

	joinBody, _ := json.Marshal(JoinRequest{Nickname: "小红", VisitorID: "visitor-two", Fingerprint: "fingerprint-two"})
	join := httptest.NewRecorder()
	handler.ServeHTTP(join, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/join", bytes.NewReader(joinBody)))
	if join.Code != http.StatusOK {
		t.Fatalf("join status: %d, body: %s", join.Code, join.Body.String())
	}
	var joined struct {
		MemberToken string `json:"memberToken"`
	}
	if err := json.Unmarshal(join.Body.Bytes(), &joined); err != nil || joined.MemberToken == "" {
		t.Fatalf("join response did not return a member token: %s", join.Body.String())
	}

	adminBody, _ := json.Marshal(AdminRequest{AdminPassword: "administrator-password", VisitorID: "visitor-two", Fingerprint: "fingerprint-two"})
	admin := httptest.NewRecorder()
	handler.ServeHTTP(admin, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/admin", bytes.NewReader(adminBody)))
	if admin.Code != http.StatusOK {
		t.Fatalf("admin status: %d, body: %s", admin.Code, admin.Body.String())
	}
	var granted struct {
		AdminToken string `json:"adminToken"`
	}
	if err := json.Unmarshal(admin.Body.Bytes(), &granted); err != nil || granted.AdminToken != created.AdminToken {
		t.Fatalf("room members did not receive the same administrator token: %s", admin.Body.String())
	}
	superAdminBody, _ := json.Marshal(AdminRequest{AdminPassword: "super-room-password", VisitorID: "visitor-one", Fingerprint: "fingerprint-one"})
	superAdmin := httptest.NewRecorder()
	handler.ServeHTTP(superAdmin, httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/admin", bytes.NewReader(superAdminBody)))
	if superAdmin.Code != http.StatusOK {
		t.Fatalf("super admin status: %d, body: %s", superAdmin.Code, superAdmin.Body.String())
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

	newAdminPassword := "new-administrator-password"
	settingsBody, _ := json.Marshal(SettingRequest{
		AdminPassword: &newAdminPassword,
		VisitorID:     "visitor-one",
		Fingerprint:   "fingerprint-one",
		AdminToken:    created.AdminToken,
	})
	settings := httptest.NewRecorder()
	handler.ServeHTTP(settings, httptest.NewRequest(http.MethodPut, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/settings", bytes.NewReader(settingsBody)))
	if settings.Code != http.StatusOK {
		t.Fatalf("settings status: %d, body: %s", settings.Code, settings.Body.String())
	}
	var updated struct {
		AdminToken string `json:"adminToken"`
	}
	if err := json.Unmarshal(settings.Body.Bytes(), &updated); err != nil || updated.AdminToken == "" || updated.AdminToken == created.AdminToken {
		t.Fatalf("administrator password change did not rotate the token: %s", settings.Body.String())
	}
	oldTokenBody, _ := json.Marshal(SettingRequest{
		VisitorID:   "visitor-one",
		Fingerprint: "fingerprint-one",
		AdminToken:  created.AdminToken,
	})
	oldTokenRequest := httptest.NewRecorder()
	handler.ServeHTTP(oldTokenRequest, httptest.NewRequest(http.MethodPut, "/api/v1/rooms/"+created.Snapshot.Room.ID+"/settings", bytes.NewReader(oldTokenBody)))
	if oldTokenRequest.Code != http.StatusForbidden {
		t.Fatalf("old administrator token remained valid after password change: %d %s", oldTokenRequest.Code, oldTokenRequest.Body.String())
	}
}

func TestProxyRoute(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("proxy-ok"))
	}))
	defer upstream.Close()
	store, err := newRoomStore(Config{DataDir: t.TempDir(), TokenSecret: []byte("proxy-test-secret")})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	handler := (&server{store: store}).routes()
	request := httptest.NewRequest(http.MethodGet, "/api/v1/proxy?url="+url.QueryEscape(upstream.URL), nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != "proxy-ok" {
		t.Fatalf("proxy response: %d %q", recorder.Code, recorder.Body.String())
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
	room, adminToken, err := store.createRoom(CreateRoomRequest{Name: "WebSocket 测试", Nickname: "小明", VisitorID: "visitor", Fingerprint: "fingerprint", AdminPassword: "administrator-password"})
	if err != nil {
		t.Fatal(err)
	}
	httpServer := httptest.NewServer((&server{store: store}).routes())
	defer httpServer.Close()
	invalidConfig, err := websocket.NewConfig(
		"ws"+strings.TrimPrefix(httpServer.URL, "http")+"/ws?roomId="+room.config.ID+"&memberToken=invalid",
		httpServer.URL,
	)
	if err != nil {
		t.Fatal(err)
	}
	invalidConnection, err := websocket.DialConfig(invalidConfig)
	if err != nil {
		t.Fatalf("application authentication errors must be sent after the WebSocket upgrade: %v", err)
	}
	_ = invalidConnection.SetDeadline(time.Now().Add(3 * time.Second))
	var invalidEvent Event
	if err := websocket.JSON.Receive(invalidConnection, &invalidEvent); err != nil {
		t.Fatalf("invalid member token response: %v", err)
	}
	if invalidEvent.Type != "error" || invalidEvent.Code != "invalid_member_token" || invalidEvent.Data != "成员连接凭证无效或已过期" {
		t.Fatalf("unexpected invalid member token response: %#v", invalidEvent)
	}
	if err := websocket.JSON.Receive(invalidConnection, &Event{}); !errors.Is(err, io.EOF) {
		t.Fatalf("the server must close a rejected WebSocket after sending the error, got: %v", err)
	}
	_ = invalidConnection.Close()
	memberToken := issueMemberToken(store.config.TokenSecret, room.config.ID, fingerprintHash("visitor", "fingerprint"))
	url := "ws" + strings.TrimPrefix(httpServer.URL, "http") + "/ws?roomId=" + room.config.ID + "&memberToken=" + memberToken
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
	if err := websocket.Message.Send(connection, `{"action":"auth_admin","adminToken":"`+adminToken+`"}`); err != nil {
		t.Fatal(err)
	}
	var authEvent Event
	if err := websocket.JSON.Receive(connection, &authEvent); err != nil {
		t.Fatalf("admin auth response: %v", err)
	}
	if authEvent.Type != "snapshot" {
		t.Fatalf("expected snapshot after admin auth, got %s", authEvent.Type)
	}
	if data, ok := authEvent.Data.(map[string]interface{}); !ok || data["isAdmin"] != true {
		t.Fatalf("admin auth did not update websocket privileges: %#v", authEvent.Data)
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
	var queueChat Event
	if err := websocket.JSON.Receive(connection, &queueChat); err != nil {
		t.Fatalf("queue chat response: %v", err)
	}
	if queueChat.Type != "chat" {
		t.Fatalf("expected chat after queue command, got %s", queueChat.Type)
	}
	room.mu.RLock()
	if len(room.state.Queue) != 0 || room.state.Current == nil || room.state.Current.Music.ID != "123456" || !room.state.Playback.Playing {
		room.mu.RUnlock()
		t.Fatal("first queue command did not start playback")
	}
	currentQueueID := room.state.Current.ID
	room.mu.RUnlock()
	if err := websocket.JSON.Send(connection, ClientCommand{Action: "track_ended", QueueID: currentQueueID}); err != nil {
		t.Fatal(err)
	}
	var unauthorizedEnded Event
	if err := websocket.JSON.Receive(connection, &unauthorizedEnded); err != nil {
		t.Fatalf("unauthorized track-ended response: %v", err)
	}
	if unauthorizedEnded.Type != "error" {
		t.Fatalf("track-ended without an administrator token was not rejected: %#v", unauthorizedEnded)
	}
	if err := websocket.JSON.Send(connection, ClientCommand{Action: "track_ended", QueueID: currentQueueID, AdminToken: adminToken}); err != nil {
		t.Fatal(err)
	}
	var authorizedEnded Event
	if err := websocket.JSON.Receive(connection, &authorizedEnded); err != nil {
		t.Fatalf("authorized track-ended response: %v", err)
	}
	if authorizedEnded.Type != "snapshot" {
		t.Fatalf("track-ended with the administrator token did not update playback: %#v", authorizedEnded)
	}
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
