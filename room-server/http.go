package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/websocket"
)

type server struct{ store *RoomStore }

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.health)
	mux.HandleFunc("/api/v1/config", s.config)
	mux.HandleFunc("/api/v1/rooms", s.rooms)
	mux.HandleFunc("/api/v1/rooms/", s.room)
	mux.HandleFunc("/api/v1/current", s.current)
	mux.Handle("/ws", websocket.Server{Handler: websocket.Handler(s.store.serveWebSocket), Handshake: func(_ *websocket.Config, _ *http.Request) error { return nil }})
	return cors(mux)
}

func (s *server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSONResponse(w, http.StatusOK, map[string]any{"ok": true})
}
func (s *server) config(w http.ResponseWriter, _ *http.Request) {
	writeJSONResponse(w, http.StatusOK, map[string]any{"maxRooms": s.store.config.MaxRooms, "maxMembersPerRoom": s.store.config.MaxMembersPerRoom, "maxQueueItems": s.store.config.MaxQueueItems, "listPageSize": s.store.config.ListPageSize, "listMaxPageSize": s.store.config.ListMaxPageSize, "credentialUploadEnabled": len(s.store.config.CookieKey) > 0})
}

func (s *server) rooms(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		page := positiveInt(r.URL.Query().Get("page"), 1)
		pageSize := positiveInt(r.URL.Query().Get("pageSize"), s.store.config.ListPageSize)
		if pageSize > s.store.config.ListMaxPageSize {
			pageSize = s.store.config.ListMaxPageSize
		}
		items, total := s.store.roomList(r.URL.Query().Get("keyword"), page, pageSize)
		writeJSONResponse(w, http.StatusOK, map[string]any{"items": items, "total": total, "page": page, "pageSize": pageSize})
		return
	}
	if r.Method == http.MethodPost {
		request := CreateRoomRequest{}
		if err := decodeJSON(r, &request); err != nil {
			writeError(w, http.StatusBadRequest, "请求格式错误")
			return
		}
		room, token, err := s.store.createRoom(request)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
		room.mu.RLock()
		snapshot := room.snapshotLocked(memberID, token, s.store.config.TokenSecret)
		room.mu.RUnlock()
		writeJSONResponse(w, http.StatusCreated, map[string]any{"snapshot": snapshot, "adminToken": token})
		return
	}
	writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
}

func (s *server) current(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	room := s.store.findCurrent(r.URL.Query().Get("visitorId"), r.URL.Query().Get("fingerprint"))
	writeJSONResponse(w, http.StatusOK, map[string]any{"room": room})
}

func (s *server) room(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/v1/rooms/"), "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "房间不存在")
		return
	}
	room, ok := s.store.get(strings.ToUpper(parts[0]))
	if !ok {
		writeError(w, http.StatusNotFound, "房间不存在或已解散")
		return
	}
	if len(parts) == 1 && r.Method == http.MethodGet {
		s.snapshot(w, r, room)
		return
	}
	if len(parts) == 2 && parts[1] == "join" && r.Method == http.MethodPost {
		s.join(w, r, room)
		return
	}
	if len(parts) == 2 && parts[1] == "admin" && r.Method == http.MethodPost {
		s.admin(w, r, room)
		return
	}
	if len(parts) == 2 && parts[1] == "resolve" && r.Method == http.MethodPost {
		s.resolve(w, r, room)
		return
	}
	if len(parts) == 2 && parts[1] == "resolved" && r.Method == http.MethodPost {
		s.resolved(w, r, room)
		return
	}
	if len(parts) == 2 && parts[1] == "settings" && r.Method == http.MethodPut {
		s.settings(w, r, room)
		return
	}
	if len(parts) == 2 && parts[1] == "dissolve" && r.Method == http.MethodPost {
		s.dissolve(w, r, room)
		return
	}
	if len(parts) == 3 && parts[1] == "credentials" {
		s.credentials(w, r, room, parts[2])
		return
	}
	writeError(w, http.StatusNotFound, "接口不存在")
}

type JoinRequest struct {
	EntryPassword string `json:"entryPassword"`
	Nickname      string `json:"nickname"`
	VisitorID     string `json:"visitorId"`
	Fingerprint   string `json:"fingerprint"`
}

func (s *server) join(w http.ResponseWriter, r *http.Request, room *Room) {
	request := JoinRequest{}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, 400, "请求格式错误")
		return
	}
	memberID, err := room.join(request.VisitorID, request.Fingerprint, request.Nickname, request.EntryPassword)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	room.mu.RLock()
	snapshot := room.snapshotLocked(memberID, "", s.store.config.TokenSecret)
	room.mu.RUnlock()
	writeJSONResponse(w, 200, map[string]any{"snapshot": snapshot})
}

type AdminRequest struct {
	AdminPassword string `json:"adminPassword"`
	VisitorID     string `json:"visitorId"`
	Fingerprint   string `json:"fingerprint"`
}

func (s *server) admin(w http.ResponseWriter, r *http.Request, room *Room) {
	request := AdminRequest{}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, 400, "请求格式错误")
		return
	}
	memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
	room.mu.RLock()
	memberExists := room.config.Members[memberID].ID != ""
	matched := verifyPassword(room.config.AdminPasswordHash, request.AdminPassword)
	version := room.config.AdminVersion
	roomID := room.config.ID
	room.mu.RUnlock()
	if !matched && s.store.config.SuperAdminPassword != "" {
		matched = constantTimeStringEqual(s.store.config.SuperAdminPassword, request.AdminPassword)
	}
	if !memberExists || !matched {
		writeError(w, http.StatusForbidden, "管理员密码错误")
		return
	}
	writeJSONResponse(w, 200, map[string]any{"adminToken": issueAdminToken(s.store.config.TokenSecret, roomID, memberID, version)})
}

type SettingRequest struct {
	Name            *string `json:"name"`
	EntryPassword   *string `json:"entryPassword"`
	AdminPassword   *string `json:"adminPassword"`
	AllowGuestQueue *bool   `json:"allowGuestQueue"`
	VisitorID       string  `json:"visitorId"`
	Fingerprint     string  `json:"fingerprint"`
	AdminToken      string  `json:"adminToken"`
}

func (s *server) settings(w http.ResponseWriter, r *http.Request, room *Room) {
	request := SettingRequest{}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, 400, "请求格式错误")
		return
	}
	memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
	room.mu.Lock()
	if !verifyAdminToken(s.store.config.TokenSecret, request.AdminToken, room.config.ID, memberID, room.config.AdminVersion) {
		room.mu.Unlock()
		writeError(w, 403, "需要管理员权限")
		return
	}
	if request.Name != nil {
		value := sanitizeName(*request.Name, 30)
		if value == "" {
			room.mu.Unlock()
			writeError(w, 400, "房间名不能为空")
			return
		}
		room.config.Name = value
	}
	if request.EntryPassword != nil {
		value := strings.TrimSpace(*request.EntryPassword)
		if value == "" {
			room.config.EntryPasswordHash = ""
		} else if len(value) < 4 {
			room.mu.Unlock()
			writeError(w, 400, "房间密码至少 4 位")
			return
		} else {
			room.config.EntryPasswordHash = hashPassword(value)
		}
	}
	if request.AdminPassword != nil {
		value := strings.TrimSpace(*request.AdminPassword)
		if len(value) < 6 {
			room.mu.Unlock()
			writeError(w, 400, "管理员密码至少 6 位")
			return
		}
		room.config.AdminPasswordHash = hashPassword(value)
		room.config.AdminVersion++
	}
	if request.AllowGuestQueue != nil {
		room.config.GuestQueueDisabled = !*request.AllowGuestQueue
	}
	if err := room.saveConfigLocked(); err != nil {
		room.mu.Unlock()
		writeError(w, 500, "保存设置失败")
		return
	}
	member := room.config.Members[memberID]
	token := issueAdminToken(s.store.config.TokenSecret, room.config.ID, member.ID, room.config.AdminVersion)
	snapshot := room.snapshotLocked(memberID, token, s.store.config.TokenSecret)
	room.mu.Unlock()
	writeJSONResponse(w, 200, map[string]any{"snapshot": snapshot, "adminToken": token})
	broadcastRoomSnapshot(room)
}

func (s *server) dissolve(w http.ResponseWriter, r *http.Request, room *Room) {
	request := AdminRequest{}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, 400, "请求格式错误")
		return
	}
	adminToken := r.Header.Get("X-Room-Admin")
	memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
	room.mu.RLock()
	authorized := verifyAdminToken(s.store.config.TokenSecret, adminToken, room.config.ID, memberID, room.config.AdminVersion)
	roomID := room.config.ID
	path := room.path
	room.mu.RUnlock()
	if !authorized {
		writeError(w, 403, "需要管理员权限")
		return
	}
	s.store.mu.Lock()
	delete(s.store.rooms, roomID)
	s.store.mu.Unlock()
	room.mu.RLock()
	connections := make([]*RoomConnection, 0, len(room.connections))
	for connection := range room.connections {
		connections = append(connections, connection)
	}
	room.mu.RUnlock()
	for _, connection := range connections {
		_ = connection.send(Event{Type: "dissolved", Data: "房间已被管理员解散"})
	}
	_ = osRemoveAll(path)
	writeJSONResponse(w, 200, map[string]any{"ok": true})
}

type CredentialRequest struct {
	Cookie      string `json:"cookie"`
	VisitorID   string `json:"visitorId"`
	Fingerprint string `json:"fingerprint"`
	AdminToken  string `json:"adminToken"`
}

func (s *server) credentials(w http.ResponseWriter, r *http.Request, room *Room, source string) {
	if err := validateSource(source); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	request := CredentialRequest{}
	if r.Method != http.MethodDelete && decodeJSON(r, &request) != nil {
		writeError(w, 400, "请求格式错误")
		return
	}
	if r.Method == http.MethodDelete {
		if err := decodeJSON(r, &request); err != nil {
			writeError(w, 400, "请求格式错误")
			return
		}
	}
	memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
	room.mu.Lock()
	defer room.mu.Unlock()
	if !verifyAdminToken(s.store.config.TokenSecret, request.AdminToken, room.config.ID, memberID, room.config.AdminVersion) {
		writeError(w, 403, "需要管理员权限")
		return
	}
	path := filepath.Join(room.path, "credentials", source+".enc")
	if r.Method == http.MethodDelete {
		delete(room.config.Credentials, source)
		_ = os.Remove(path)
		if err := room.saveConfigLocked(); err != nil {
			writeError(w, 500, "保存失败")
			return
		}
		writeJSONResponse(w, 200, map[string]any{"ok": true})
		return
	}
	if r.Method != http.MethodPut {
		writeError(w, 405, "不支持的请求方法")
		return
	}
	if strings.TrimSpace(request.Cookie) == "" {
		writeError(w, 400, "Cookie 不能为空")
		return
	}
	if err := s.store.resolver.validateCredential(source, request.Cookie); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	encrypted, err := encrypt(s.store.config.CookieKey, []byte(request.Cookie))
	if err != nil {
		writeError(w, 503, err.Error())
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		writeError(w, 500, "无法创建凭据目录")
		return
	}
	if err := os.WriteFile(path, encrypted, 0600); err != nil {
		writeError(w, 500, "保存失败")
		return
	}
	room.config.Credentials[source] = SecretInfo{UpdatedAt: time.Now().UTC()}
	if err := room.saveConfigLocked(); err != nil {
		writeError(w, 500, "保存失败")
		return
	}
	writeJSONResponse(w, 200, map[string]any{"ok": true})
}

func (s *server) snapshot(w http.ResponseWriter, r *http.Request, room *Room) {
	memberID := fingerprintHash(r.URL.Query().Get("visitorId"), r.URL.Query().Get("fingerprint"))
	room.mu.RLock()
	defer room.mu.RUnlock()
	if room.config.Members[memberID].ID == "" {
		writeError(w, 403, "请先进入房间")
		return
	}
	writeJSONResponse(w, 200, room.snapshotLocked(memberID, r.URL.Query().Get("adminToken"), s.store.config.TokenSecret))
}

type ResolveRequest struct {
	Music       Music  `json:"music"`
	VisitorID   string `json:"visitorId"`
	Fingerprint string `json:"fingerprint"`
}

func (s *server) resolve(w http.ResponseWriter, r *http.Request, room *Room) {
	request := ResolveRequest{}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, 400, "请求格式错误")
		return
	}
	memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
	room.mu.RLock()
	memberExists := room.config.Members[memberID].ID != ""
	room.mu.RUnlock()
	if !memberExists {
		writeError(w, 403, "请先进入房间")
		return
	}
	music, err := s.store.resolver.resolve(room, request.Music)
	if err != nil {
		writeError(w, 422, err.Error())
		return
	}
	writeJSONResponse(w, 200, map[string]any{"music": music})
}

type ResolvedCacheRequest struct {
	Music       Music  `json:"music"`
	VisitorID   string `json:"visitorId"`
	Fingerprint string `json:"fingerprint"`
	AdminToken  string `json:"adminToken"`
}

func (s *server) resolved(w http.ResponseWriter, r *http.Request, room *Room) {
	request := ResolvedCacheRequest{}
	if err := decodeJSON(r, &request); err != nil {
		writeError(w, 400, "请求格式错误")
		return
	}
	memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
	room.mu.RLock()
	authorized := verifyAdminToken(s.store.config.TokenSecret, request.AdminToken, room.config.ID, memberID, room.config.AdminVersion)
	room.mu.RUnlock()
	if !authorized {
		writeError(w, 403, "需要管理员权限")
		return
	}
	if err := s.store.resolver.cacheResolved(room, request.Music); err != nil {
		writeError(w, 400, err.Error())
		return
	}
	broadcastRoomEvent(room, Event{Type: "audio_ready", Data: map[string]string{"id": string(request.Music.ID), "type": request.Music.Type}})
	writeJSONResponse(w, 200, map[string]any{"ok": true})
}

func positiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 1 {
		return fallback
	}
	return parsed
}
func decodeJSON(r *http.Request, target interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(io.LimitReader(r.Body, 1024*1024)).Decode(target)
}
func writeJSONResponse(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSONResponse(w, status, map[string]string{"error": message})
}
func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Room-Admin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// kept as a variable to make it possible to substitute during tests.
var osRemoveAll = func(path string) error { return os.RemoveAll(path) }
