package main

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/websocket"
)

type RoomConnection struct {
	id         string
	ws         *websocket.Conn
	room       *Room
	memberID   string
	store      *RoomStore
	writeMu    sync.Mutex
	adminToken string
	tokenMu    sync.RWMutex
}

type ClientCommand struct {
	Type       string `json:"type"`
	Action     string `json:"action"`
	AdminToken string `json:"adminToken,omitempty"`
	Music      *Music `json:"music,omitempty"`
	QueueID    string `json:"queueId,omitempty"`
	PositionMS int64  `json:"positionMs,omitempty"`
	Content    string `json:"content,omitempty"`
	Image      string `json:"image,omitempty"`
}

func (c *RoomConnection) send(event Event) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	return websocket.JSON.Send(c.ws, event)
}

func (c *RoomConnection) broadcast(event Event) {
	broadcastRoomEvent(c.room, event)
}

func broadcastRoomEvent(room *Room, event Event) {
	room.mu.RLock()
	connections := make([]*RoomConnection, 0, len(room.connections))
	for connection := range room.connections {
		connections = append(connections, connection)
	}
	room.mu.RUnlock()
	for _, connection := range connections {
		if err := connection.send(event); err != nil {
			connection.store.logf("ws_send_failed connection_id=%s room_id=%q member_id=%s event=%q error=%q", connection.id, room.config.ID, shortLogID(connection.memberID), event.Type, err)
		}
	}
}

func (c *RoomConnection) token() string {
	c.tokenMu.RLock()
	defer c.tokenMu.RUnlock()
	return c.adminToken
}

func (c *RoomConnection) setToken(value string) {
	if value == "" {
		return
	}
	c.tokenMu.Lock()
	c.adminToken = value
	c.tokenMu.Unlock()
}

// Each recipient needs its own snapshot. Broadcasting the sender's snapshot
// made every administrator appear as a normal member when a guest added a song.
// Snapshot broadcasts are coalesced per room: while one pass is sending,
// later state changes only mark the room dirty and cause one final pass with
// the latest state. This avoids serializing and sending a burst of stale
// snapshots without dropping the final update.
func (c *RoomConnection) broadcastSnapshot() <-chan struct{} {
	return broadcastRoomSnapshot(c.room)
}

func broadcastRoomSnapshot(room *Room) <-chan struct{} {
	done := make(chan struct{})
	room.snapshotMu.Lock()
	room.snapshotWaiters = append(room.snapshotWaiters, done)
	if room.snapshotRunning {
		room.snapshotDirty = true
		room.snapshotMu.Unlock()
		return done
	}
	room.snapshotRunning = true
	room.snapshotMu.Unlock()

	for {
		room.mu.RLock()
		connections := make([]*RoomConnection, 0, len(room.connections))
		for connection := range room.connections {
			connections = append(connections, connection)
		}
		room.mu.RUnlock()
		for _, connection := range connections {
			if err := connection.send(Event{Type: "snapshot", Data: connection.snapshot()}); err != nil {
				connection.store.logf("ws_send_failed connection_id=%s room_id=%q member_id=%s event=snapshot error=%q", connection.id, room.config.ID, shortLogID(connection.memberID), err)
			}
		}

		room.snapshotMu.Lock()
		if room.snapshotDirty {
			room.snapshotDirty = false
			room.snapshotMu.Unlock()
			continue
		}
		room.snapshotRunning = false
		waiters := room.snapshotWaiters
		room.snapshotWaiters = nil
		room.snapshotMu.Unlock()
		for _, waiter := range waiters {
			close(waiter)
		}
		return done
	}
}

func (s *RoomStore) memberIDForToken(roomID, token string) (string, bool) {
	memberID, valid := verifyMemberToken(s.config.TokenSecret, token, roomID)
	if !valid {
		return "", false
	}
	room, ok := s.get(roomID)
	if !ok {
		return "", false
	}
	room.mu.RLock()
	memberExists := room.config.Members[memberID].ID != ""
	room.mu.RUnlock()
	if !memberExists {
		return "", false
	}
	return memberID, true
}

func (s *RoomStore) serveWebSocket(ws *websocket.Conn) {
	request := ws.Request()
	connectionID := randomID(6)
	requestID := requestIDFrom(request)
	if requestID == "" {
		requestID = randomID(6)
	}
	roomID := strings.ToUpper(strings.TrimSpace(request.URL.Query().Get("roomId")))
	memberToken := request.URL.Query().Get("memberToken")
	s.logf(
		"ws_connect_attempt request_id=%s connection_id=%s room_id=%q remote=%q forwarded_for=%q forwarded_proto=%q origin=%q user_agent=%q",
		requestID, connectionID, roomID, cleanLogValue(request.RemoteAddr, 160),
		cleanLogValue(request.Header.Get("X-Forwarded-For"), 240), cleanLogValue(request.Header.Get("X-Forwarded-Proto"), 32),
		cleanLogValue(request.Header.Get("Origin"), 240), cleanLogValue(request.UserAgent(), 300),
	)
	if roomID == "" {
		s.rejectWebSocket(ws, requestID, connectionID, roomID, "missing_room_id", "缺少房间号")
		return
	}
	if strings.TrimSpace(memberToken) == "" {
		s.rejectWebSocket(ws, requestID, connectionID, roomID, "missing_member_token", "缺少成员连接凭证")
		return
	}
	room, ok := s.get(roomID)
	if !ok {
		s.rejectWebSocket(ws, requestID, connectionID, roomID, "room_not_found", "房间不存在或已解散")
		return
	}
	if !s.reserveConnection() {
		s.rejectWebSocket(ws, requestID, connectionID, roomID, "connection_limit_reached", "歌房服务连接数已达上限")
		return
	}
	defer s.releaseConnection()
	memberID, valid := s.memberIDForToken(roomID, memberToken)
	if !valid {
		s.rejectWebSocket(ws, requestID, connectionID, roomID, "invalid_member_token", "成员连接凭证无效或已过期")
		return
	}
	memberID, err := room.connectMember(memberID)
	if err != nil {
		s.rejectWebSocket(ws, requestID, connectionID, roomID, "member_connect_failed", err.Error())
		return
	}
	connection := &RoomConnection{id: connectionID, ws: ws, room: room, memberID: memberID, store: s}
	room.mu.Lock()
	if len(room.connections) >= room.config.MaxMembers {
		room.mu.Unlock()
		s.rejectWebSocket(ws, requestID, connectionID, roomID, "room_full", "房间人数已满")
		return
	}
	room.connections[connection] = struct{}{}
	snapshot := room.snapshotLocked(memberID, connection.token(), s.config.TokenSecret)
	onlineCount := len(room.connections)
	room.mu.Unlock()
	connectedAt := time.Now()
	disconnectReason := "handler_returned"
	s.logf("ws_connected request_id=%s connection_id=%s room_id=%q member_id=%s online=%d", requestID, connectionID, roomID, shortLogID(memberID), onlineCount)
	if err := connection.send(Event{Type: "snapshot", Data: snapshot}); err != nil {
		disconnectReason = "initial_snapshot_failed"
		s.logf("ws_send_failed request_id=%s connection_id=%s room_id=%q member_id=%s event=snapshot error=%q", requestID, connectionID, roomID, shortLogID(memberID), err)
		return
	}
	connection.broadcast(Event{Type: "presence", Data: roomSummary(room)})
	defer func() {
		room.mu.Lock()
		delete(room.connections, connection)
		if len(room.connections) == 0 {
			now := time.Now().UTC()
			room.state.EmptySince = &now
			_ = room.saveStateLocked()
		}
		room.mu.Unlock()
		connection.broadcast(Event{Type: "presence", Data: roomSummary(room)})
		s.logf("ws_disconnected request_id=%s connection_id=%s room_id=%q member_id=%s duration_ms=%d reason=%s", requestID, connectionID, roomID, shortLogID(memberID), time.Since(connectedAt).Milliseconds(), disconnectReason)
	}()
	for {
		command := ClientCommand{}
		if err := websocket.JSON.Receive(ws, &command); err != nil {
			if errors.Is(err, io.EOF) {
				disconnectReason = "peer_closed"
				return
			}
			disconnectReason = "receive_error"
			s.logf("ws_receive_failed request_id=%s connection_id=%s room_id=%q member_id=%s error=%q", requestID, connectionID, roomID, shortLogID(memberID), err)
			_ = connection.send(Event{Type: "error", Code: "invalid_message", Data: "WebSocket 消息格式错误"})
			return
		}
		if err := connection.handle(command); err != nil {
			s.logf("ws_command_rejected request_id=%s connection_id=%s room_id=%q member_id=%s action=%q error=%q", requestID, connectionID, roomID, shortLogID(memberID), command.Action, err)
			_ = connection.send(Event{Type: "error", Code: "command_rejected", Data: err.Error()})
		}
	}
}

func (s *RoomStore) rejectWebSocket(ws *websocket.Conn, requestID, connectionID, roomID, code, message string) {
	sendErr := websocket.JSON.Send(ws, Event{Type: "error", Code: code, Data: message})
	s.logf("ws_rejected request_id=%s connection_id=%s room_id=%q code=%s message=%q send_ok=%t send_error=%q", requestID, connectionID, roomID, code, message, sendErr == nil, logError(sendErr))
	_ = ws.Close()
}

func shortLogID(value string) string {
	if len(value) <= 12 {
		return value
	}
	return value[:12]
}

func roomSummary(room *Room) RoomSummary {
	room.mu.RLock()
	defer room.mu.RUnlock()
	return room.summaryLocked()
}

func (c *RoomConnection) isAdmin(token string) bool {
	c.room.mu.RLock()
	defer c.room.mu.RUnlock()
	return verifyAdminToken(c.store.config.TokenSecret, token, c.room.config.ID, c.room.config.AdminPasswordHash, c.room.config.AdminVersion)
}

func (c *RoomConnection) handle(command ClientCommand) error {
	c.setToken(command.AdminToken)
	switch command.Action {
	case "auth_admin":
		if !c.isAdmin(command.AdminToken) {
			return errors.New("管理员凭证无效")
		}
		return c.send(Event{Type: "snapshot", Data: c.snapshot()})
	case "heartbeat":
		return c.send(Event{Type: "pong", Data: time.Now().UTC()})
	case "queue_add":
		if command.Music == nil || command.Music.ID == "" || command.Music.Type == "" || command.Music.Name == "" {
			return errors.New("无效的歌曲")
		}
		c.room.mu.Lock()
		admin := verifyAdminToken(c.store.config.TokenSecret, command.AdminToken, c.room.config.ID, c.room.config.AdminPasswordHash, c.room.config.AdminVersion)
		if c.room.config.GuestQueueDisabled && !admin {
			c.room.mu.Unlock()
			return errors.New("管理员已关闭游客点歌")
		}
		if len(c.room.state.Queue) >= c.store.config.MaxQueueItems {
			c.room.mu.Unlock()
			return fmt.Errorf("当前点歌列表已达到 %d 首上限", c.store.config.MaxQueueItems)
		}
		member := c.room.config.Members[c.memberID]
		item := QueueItem{ID: randomID(12), Music: *command.Music, RequestedBy: c.memberID, RequestedName: member.Nickname, RequestedAt: time.Now().UTC()}
		c.room.state.Queue = append(c.room.state.Queue, item)
		// The first song in an empty room should start immediately. Moving it
		// into Current also makes the playback state authoritative for every
		// member instead of requiring the administrator to press play manually.
		if c.room.state.Current == nil {
			c.room.state.Current = queueHead(&c.room.state)
			c.room.state.Playback = PlaybackState{
				Playing:    c.room.state.Current != nil,
				PositionMS: 0,
				UpdatedAt:  time.Now().UTC(),
			}
		}
		c.room.state.Version++
		err := c.room.saveStateLocked()
		c.room.mu.Unlock()
		if err == nil {
			done := c.broadcastSnapshot()
			<-done
			c.broadcast(Event{Type: "chat", Data: ChatMessage{
				ID: randomID(10), MemberID: c.memberID, Nickname: member.Nickname,
				Content:   "点歌：《" + sanitizeName(command.Music.Name, 120) + "》",
				CreatedAt: item.RequestedAt,
			}})
		}
		return err
	case "queue_remove":
		c.room.mu.Lock()
		admin := verifyAdminToken(c.store.config.TokenSecret, command.AdminToken, c.room.config.ID, c.room.config.AdminPasswordHash, c.room.config.AdminVersion)
		index := -1
		for i, item := range c.room.state.Queue {
			if item.ID == command.QueueID && (admin || item.RequestedBy == c.memberID) {
				index = i
				break
			}
		}
		if index < 0 {
			c.room.mu.Unlock()
			return errors.New("没有操作该歌曲的权限")
		}
		c.room.state.Queue = append(c.room.state.Queue[:index], c.room.state.Queue[index+1:]...)
		c.room.state.Version++
		err := c.room.saveStateLocked()
		c.room.mu.Unlock()
		if err == nil {
			c.broadcastSnapshot()
		}
		return err
	case "queue_pin":
		if !c.isAdmin(command.AdminToken) {
			return errors.New("请输入管理员密码后再操作")
		}
		c.room.mu.Lock()
		index := -1
		for i, item := range c.room.state.Queue {
			if item.ID == command.QueueID {
				index = i
				break
			}
		}
		if index < 0 {
			c.room.mu.Unlock()
			return errors.New("歌曲不在点歌队列中")
		}
		if index == 0 {
			c.room.mu.Unlock()
			return nil
		}
		item := c.room.state.Queue[index]
		queue := append(c.room.state.Queue[:index:index], c.room.state.Queue[index+1:]...)
		c.room.state.Queue = append([]QueueItem{item}, queue...)
		c.room.state.Version++
		err := c.room.saveStateLocked()
		c.room.mu.Unlock()
		if err == nil {
			c.broadcastSnapshot()
		}
		return err
	case "play_toggle", "next", "seek":
		if !c.isAdmin(command.AdminToken) {
			return errors.New("请输入管理员密码后再操作")
		}
		c.room.mu.Lock()
		now := time.Now().UTC()
		switch command.Action {
		case "play_toggle":
			if c.room.state.Current == nil && len(c.room.state.Queue) > 0 {
				c.room.state.Current = queueHead(&c.room.state)
			}
			if c.room.state.Current == nil {
				c.room.mu.Unlock()
				return errors.New("点歌队列为空")
			}
			c.room.state.Playback.PositionMS = currentPosition(c.room.state.Playback, now)
			c.room.state.Playback.Playing = !c.room.state.Playback.Playing
			c.room.state.Playback.UpdatedAt = now
		case "next":
			c.room.state.Current = queueHead(&c.room.state)
			c.room.state.Playback = PlaybackState{Playing: c.room.state.Current != nil, PositionMS: 0, UpdatedAt: now}
		case "seek":
			if c.room.state.Current == nil {
				c.room.mu.Unlock()
				return errors.New("当前没有播放歌曲")
			}
			if command.PositionMS < 0 {
				command.PositionMS = 0
			}
			c.room.state.Playback.PositionMS = command.PositionMS
			c.room.state.Playback.UpdatedAt = now
		}
		c.room.state.Version++
		err := c.room.saveStateLocked()
		c.room.mu.Unlock()
		if err == nil {
			c.broadcastSnapshot()
		}
		return err
	case "track_ended":
		if !c.isAdmin(command.AdminToken) {
			return errors.New("请输入管理员密码后再操作")
		}
		c.room.mu.Lock()
		if c.room.state.Current == nil || c.room.state.Current.ID != command.QueueID {
			c.room.mu.Unlock()
			return nil
		}
		c.room.state.Current = queueHead(&c.room.state)
		c.room.state.Playback = PlaybackState{Playing: c.room.state.Current != nil, UpdatedAt: time.Now().UTC()}
		c.room.state.Version++
		err := c.room.saveStateLocked()
		c.room.mu.Unlock()
		if err == nil {
			c.broadcastSnapshot()
		}
		return err
	case "chat":
		content := sanitizeName(command.Content, c.store.config.MaxChatMessageBytes)
		image := sanitizeChatImage(command.Image, c.store.config.MaxChatImageBytes)
		if strings.TrimSpace(command.Image) != "" && image == "" {
			return errors.New("图片格式不支持或图片过大")
		}
		if content == "" && image == "" {
			return nil
		}
		c.room.mu.Lock()
		member := c.room.config.Members[c.memberID]
		message := ChatMessage{ID: randomID(10), MemberID: c.memberID, Nickname: member.Nickname, Content: content, Image: image, CreatedAt: time.Now().UTC()}
		c.room.mu.Unlock()
		c.broadcast(Event{Type: "chat", Data: message})
		return nil
	}
	return errors.New("不支持的房间操作")
}

func sanitizeChatImage(value string, maxBytes int) string {
	value = strings.TrimSpace(value)
	if value == "" || maxBytes <= 0 || len(value) > maxBytes {
		return ""
	}
	for _, prefix := range []string{
		"data:image/png;base64,",
		"data:image/jpeg;base64,",
		"data:image/webp;base64,",
		"data:image/gif;base64,",
	} {
		if strings.HasPrefix(value, prefix) {
			return value
		}
	}
	return ""
}

func (c *RoomConnection) snapshot() Snapshot {
	c.room.mu.RLock()
	defer c.room.mu.RUnlock()
	return c.room.snapshotLocked(c.memberID, c.token(), c.store.config.TokenSecret)
}

func queueHead(state *RoomState) *QueueItem {
	if len(state.Queue) == 0 {
		return nil
	}
	item := state.Queue[0]
	state.Queue = state.Queue[1:]
	return &item
}
func currentPosition(playback PlaybackState, now time.Time) int64 {
	if !playback.Playing {
		return playback.PositionMS
	}
	return playback.PositionMS + now.Sub(playback.UpdatedAt).Milliseconds()
}
