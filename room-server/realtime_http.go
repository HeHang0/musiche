package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"
)

var (
	errHTTPStreamClosed = errors.New("HTTP 实时流已关闭")
	errHTTPStreamFull   = errors.New("HTTP 实时流缓冲区已满")
)

type httpStreamEventSender struct {
	events chan Event
	done   chan struct{}
	once   sync.Once
}

func newHTTPStreamEventSender() *httpStreamEventSender {
	return &httpStreamEventSender{
		events: make(chan Event, 256),
		done:   make(chan struct{}),
	}
}

func (s *httpStreamEventSender) Send(event Event) error {
	select {
	case <-s.done:
		return errHTTPStreamClosed
	default:
	}
	select {
	case s.events <- event:
		return nil
	case <-s.done:
		return errHTTPStreamClosed
	default:
		_ = s.Close()
		return errHTTPStreamFull
	}
}

func (s *httpStreamEventSender) Close() error {
	s.once.Do(func() { close(s.done) })
	return nil
}

func (s *httpStreamEventSender) Kind() string { return "http-stream" }

type realtimeCommandRequest struct {
	RoomID       string        `json:"roomId"`
	ConnectionID string        `json:"connectionId"`
	Command      ClientCommand `json:"command"`
}

func (s *server) realtimeStream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeRealtimeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "不支持的请求方法")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeRealtimeError(w, http.StatusInternalServerError, "streaming_unsupported", "当前 HTTP 服务不支持流式响应")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("roomId")))
	connectionID := strings.TrimSpace(r.URL.Query().Get("connectionId"))
	if !validRealtimeConnectionID(connectionID) {
		writeRealtimeError(w, http.StatusBadRequest, "invalid_connection_id", "无效的实时连接标识")
		return
	}
	requestID := requestIDFrom(r)
	if requestID == "" {
		requestID = randomID(6)
	}
	sender := newHTTPStreamEventSender()
	connection, snapshot, failure := s.store.registerRoomConnection(roomID, bearerToken(r), connectionID, sender)
	if failure != nil {
		_ = sender.Close()
		s.store.logf("http_stream_rejected request_id=%s connection_id=%s room_id=%q code=%s message=%q", requestID, connectionID, roomID, failure.Code, failure.Message)
		writeRealtimeError(w, failure.Status, failure.Code, failure.Message)
		return
	}
	connectedAt := time.Now()
	disconnectReason := "handler_returned"
	defer func() {
		s.store.unregisterRoomConnection(connection, requestID, disconnectReason, connectedAt)
	}()

	w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Room-Transport", "http-stream")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()
	if err := connection.send(Event{Type: "snapshot", Data: snapshot}); err != nil {
		disconnectReason = "initial_snapshot_failed"
		return
	}
	connection.broadcast(Event{Type: "presence", Data: roomSummary(connection.room)})
	broadcastRoomSnapshotExcept(connection.room, connection)

	encoder := json.NewEncoder(w)
	keepalive := time.NewTicker(20 * time.Second)
	defer keepalive.Stop()
	writeEvent := func(event Event) bool {
		if err := encoder.Encode(event); err != nil {
			disconnectReason = "write_error"
			s.store.logf("http_stream_write_failed request_id=%s connection_id=%s room_id=%q member_id=%s error=%q", requestID, connectionID, roomID, shortLogID(connection.memberID), err)
			return false
		}
		flusher.Flush()
		return true
	}
	for {
		select {
		case event := <-sender.events:
			if !writeEvent(event) {
				return
			}
		case <-keepalive.C:
			if !writeEvent(Event{Type: "pong", Data: time.Now().UTC()}) {
				return
			}
		case <-sender.done:
			disconnectReason = "sender_closed"
			return
		case <-r.Context().Done():
			disconnectReason = "peer_closed"
			return
		}
	}
}

func (s *server) realtimeCommand(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeRealtimeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "不支持的请求方法")
		return
	}
	request := realtimeCommandRequest{}
	if err := decodeJSON(r, &request); err != nil {
		writeRealtimeError(w, http.StatusBadRequest, "invalid_request", "请求格式错误")
		return
	}
	roomID := strings.ToUpper(strings.TrimSpace(request.RoomID))
	connectionID := strings.TrimSpace(request.ConnectionID)
	if roomID == "" || !validRealtimeConnectionID(connectionID) {
		writeRealtimeError(w, http.StatusBadRequest, "invalid_connection", "无效的房间或实时连接标识")
		return
	}
	room, ok := s.store.get(roomID)
	if !ok {
		writeRealtimeError(w, http.StatusNotFound, "room_not_found", "房间不存在或已解散")
		return
	}
	memberToken := bearerToken(r)
	if memberToken == "" {
		writeRealtimeError(w, http.StatusUnauthorized, "missing_member_token", "缺少成员连接凭证")
		return
	}
	memberID, valid := s.store.memberIDForToken(roomID, memberToken)
	if !valid {
		writeRealtimeError(w, http.StatusUnauthorized, "invalid_member_token", "成员连接凭证无效或已过期")
		return
	}
	var connection *RoomConnection
	room.mu.RLock()
	for candidate := range room.connections {
		if candidate.id == connectionID && candidate.memberID == memberID && candidate.transportKind() == "http-stream" {
			connection = candidate
			break
		}
	}
	room.mu.RUnlock()
	if connection == nil {
		writeRealtimeError(w, http.StatusConflict, "realtime_connection_not_found", "HTTP 实时连接不存在或已断开")
		return
	}
	if err := connection.handle(request.Command); err != nil {
		s.store.logf("realtime_command_rejected transport=http-stream connection_id=%s room_id=%q member_id=%s action=%q error=%q", connectionID, roomID, shortLogID(memberID), request.Command.Action, err)
		writeRealtimeError(w, http.StatusUnprocessableEntity, "command_rejected", err.Error())
		return
	}
	writeJSONResponse(w, http.StatusOK, map[string]any{"ok": true})
}

func bearerToken(r *http.Request) string {
	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(authorization) > len("Bearer ") && strings.EqualFold(authorization[:len("Bearer ")], "Bearer ") {
		return strings.TrimSpace(authorization[len("Bearer "):])
	}
	return strings.TrimSpace(r.Header.Get("X-Room-Member"))
}

func validRealtimeConnectionID(value string) bool {
	if len(value) < 8 || len(value) > 80 {
		return false
	}
	for _, character := range value {
		if (character >= 'a' && character <= 'z') ||
			(character >= 'A' && character <= 'Z') ||
			(character >= '0' && character <= '9') || character == '-' || character == '_' {
			continue
		}
		return false
	}
	return true
}

func writeRealtimeError(w http.ResponseWriter, status int, code, message string) {
	writeJSONResponse(w, status, map[string]string{"error": message, "code": code})
}
