package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type Room struct {
	mu              sync.RWMutex
	config          RoomConfig
	state           RoomState
	connections     map[*RoomConnection]struct{}
	path            string
	snapshotMu      sync.Mutex
	snapshotRunning bool
	snapshotDirty   bool
	snapshotWaiters []chan struct{}
}

type RoomStore struct {
	config      Config
	logger      *appLogger
	mu          sync.RWMutex
	rooms       map[string]*Room
	connections int
	resolver    *Resolver
}

func (s *RoomStore) reserveConnection() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.config.MaxConnections > 0 && s.connections >= s.config.MaxConnections {
		return false
	}
	s.connections++
	return true
}

func (s *RoomStore) releaseConnection() {
	s.mu.Lock()
	if s.connections > 0 {
		s.connections--
	}
	s.mu.Unlock()
}

func (s *RoomStore) logf(format string, values ...interface{}) {
	if s.logger != nil {
		s.logger.Printf(format, values...)
	}
}

func newRoomStore(config Config) (*RoomStore, error) {
	if config.MaxRooms <= 0 {
		config.MaxRooms = 50
	}
	if config.MaxMembersPerRoom <= 0 {
		config.MaxMembersPerRoom = 30
	}
	if config.MaxQueueItems <= 0 {
		config.MaxQueueItems = 100
	}
	if config.ListPageSize <= 0 {
		config.ListPageSize = 24
	}
	if config.ListMaxPageSize <= 0 {
		config.ListMaxPageSize = 50
	}
	if config.EmptyTTL <= 0 {
		config.EmptyTTL = 30 * time.Minute
	}
	if config.MaxChatMessages <= 0 {
		config.MaxChatMessages = 500
	}
	if config.MaxChatImageBytes <= 0 {
		config.MaxChatImageBytes = 512 * 1024
	}
	if config.AudioCacheTTL <= 0 {
		config.AudioCacheTTL = 5 * time.Minute
	}
	if err := os.MkdirAll(config.DataDir, 0700); err != nil {
		return nil, err
	}
	store := &RoomStore{config: config, rooms: map[string]*Room{}, resolver: newResolver(config)}
	if err := store.loadRooms(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *RoomStore) loadRooms() error {
	entries, err := os.ReadDir(s.config.DataDir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		room, err := s.loadRoom(filepath.Join(s.config.DataDir, entry.Name()))
		if err != nil {
			continue
		}
		room.mu.Lock()
		if room.state.EmptySince == nil {
			now := time.Now().UTC()
			room.state.EmptySince = &now
			_ = room.saveStateLocked()
		}
		room.mu.Unlock()
		s.rooms[room.config.ID] = room
	}
	return nil
}

func (s *RoomStore) loadRoom(path string) (*Room, error) {
	config := RoomConfig{}
	state := RoomState{}
	if err := readJSON(filepath.Join(path, ".config.json"), &config); err != nil {
		return nil, err
	}
	if err := readJSON(filepath.Join(path, ".state.json"), &state); err != nil {
		return nil, err
	}
	if config.ID == "" || config.Name == "" {
		return nil, errors.New("invalid room config")
	}
	if config.Members == nil {
		config.Members = map[string]Member{}
	}
	if config.Credentials == nil {
		config.Credentials = map[string]SecretInfo{}
	}
	if state.Queue == nil {
		state.Queue = []QueueItem{}
	}
	return &Room{config: config, state: state, connections: map[*RoomConnection]struct{}{}, path: path}, nil
}

func (s *RoomStore) createRoom(request CreateRoomRequest) (*Room, string, error) {
	name := sanitizeName(request.Name, 30)
	nickname := sanitizeName(request.Nickname, 24)
	if name == "" || nickname == "" || len(strings.TrimSpace(request.AdminPassword)) < 6 {
		return nil, "", errors.New("请完整填写房间名、昵称和至少 6 位的管理员密码")
	}
	memberID := fingerprintHash(request.VisitorID, request.Fingerprint)
	if strings.TrimSpace(request.VisitorID) == "" || strings.TrimSpace(request.Fingerprint) == "" {
		return nil, "", errors.New("无效的浏览器标识")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.rooms) >= s.config.MaxRooms {
		return nil, "", errors.New("当前歌房数量已达上限")
	}
	roomID := ""
	for i := 0; i < 20; i++ {
		candidate := strings.ToUpper(randomID(5))
		candidate = strings.NewReplacer("-", "", "_", "").Replace(candidate)
		if len(candidate) > 8 {
			candidate = candidate[:8]
		}
		if _, exists := s.rooms[candidate]; !exists {
			roomID = candidate
			break
		}
	}
	if roomID == "" {
		return nil, "", errors.New("无法生成房间号")
	}
	now := time.Now().UTC()
	room := &Room{
		config:      RoomConfig{ID: roomID, Name: name, AdminPasswordHash: hashPassword(request.AdminPassword), AdminVersion: 1, MaxMembers: s.config.MaxMembersPerRoom, CreatedAt: now, Members: map[string]Member{}, Credentials: map[string]SecretInfo{}},
		state:       RoomState{Version: 1, Queue: []QueueItem{}, Playback: PlaybackState{UpdatedAt: now}},
		connections: map[*RoomConnection]struct{}{},
		path:        filepath.Join(s.config.DataDir, roomID),
	}
	if password := strings.TrimSpace(request.EntryPassword); password != "" {
		room.config.EntryPasswordHash = hashPassword(password)
	}
	room.config.Members[memberID] = Member{ID: memberID, Nickname: nickname, FingerprintHash: fingerprintHash("", request.Fingerprint), FirstJoinedAt: now, LastJoinedAt: now}
	if err := os.MkdirAll(room.path, 0700); err != nil {
		return nil, "", err
	}
	if err := room.saveLocked(); err != nil {
		_ = os.RemoveAll(room.path)
		return nil, "", err
	}
	s.rooms[roomID] = room
	return room, issueAdminToken(s.config.TokenSecret, roomID, room.config.AdminPasswordHash, room.config.AdminVersion), nil
}

func (s *RoomStore) get(id string) (*Room, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	room, ok := s.rooms[id]
	return room, ok
}

func (s *RoomStore) roomList(keyword string, page, pageSize int) ([]RoomSummary, int) {
	keyword = strings.ToLower(strings.TrimSpace(keyword))
	s.mu.RLock()
	rooms := make([]*Room, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, room)
	}
	s.mu.RUnlock()
	items := make([]RoomSummary, 0, len(rooms))
	for _, room := range rooms {
		room.mu.RLock()
		if keyword == "" || strings.Contains(strings.ToLower(room.config.Name), keyword) {
			items = append(items, room.summaryLocked())
		}
		room.mu.RUnlock()
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].OnlineCount == items[j].OnlineCount {
			return items[i].CreatedAt.After(items[j].CreatedAt)
		}
		return items[i].OnlineCount > items[j].OnlineCount
	})
	total := len(items)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return items[start:end], total
}

func (s *RoomStore) missingRoomIDs(ids []string) []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	missing := make([]string, 0)
	for _, id := range ids {
		if _, exists := s.rooms[id]; !exists {
			missing = append(missing, id)
		}
	}
	return missing
}

func (s *RoomStore) findCurrent(visitorID, fingerprint string) *RoomSummary {
	memberID := fingerprintHash(visitorID, fingerprint)
	var latest *RoomSummary
	var latestJoined time.Time
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, room := range s.rooms {
		room.mu.RLock()
		member, exists := room.config.Members[memberID]
		summary := room.summaryLocked()
		room.mu.RUnlock()
		if exists && member.LastJoinedAt.After(latestJoined) {
			latestJoined = member.LastJoinedAt
			copy := summary
			latest = &copy
		}
	}
	return latest
}

func (s *RoomStore) removeExpiredRooms() {
	now := time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, room := range s.rooms {
		room.mu.RLock()
		expired := len(room.connections) == 0 && room.state.EmptySince != nil && now.Sub(*room.state.EmptySince) >= s.config.EmptyTTL
		path := room.path
		room.mu.RUnlock()
		if expired {
			delete(s.rooms, id)
			if err := os.RemoveAll(path); err != nil {
				s.logf("room_expire_failed room_id=%s error=%q", id, err)
			} else {
				s.logf("room_expired room_id=%s empty_ttl=%s", id, s.config.EmptyTTL)
			}
		}
	}
}

func (r *Room) join(visitorID, fingerprint, nickname, entryPassword string) (string, error) {
	memberID := fingerprintHash(visitorID, fingerprint)
	nickname = sanitizeName(nickname, 24)
	if strings.TrimSpace(visitorID) == "" || strings.TrimSpace(fingerprint) == "" || nickname == "" {
		return "", errors.New("请填写昵称")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	member, known := r.config.Members[memberID]
	if r.config.EntryPasswordHash != "" && !verifyPassword(r.config.EntryPasswordHash, entryPassword) {
		return "", errors.New("房间密码错误")
	}
	if !known {
		now := time.Now().UTC()
		member = Member{ID: memberID, Nickname: nickname, FingerprintHash: fingerprintHash("", fingerprint), FirstJoinedAt: now, LastJoinedAt: now}
		r.config.Members[memberID] = member
	} else {
		member.LastJoinedAt = time.Now().UTC()
		r.config.Members[memberID] = member
	}
	r.state.EmptySince = nil
	if err := r.saveLocked(); err != nil {
		return "", err
	}
	return memberID, nil
}

// connectMember authenticates an already joined member for a WebSocket
// connection. The HTTP join endpoint has already checked the entry password;
// the socket handshake only needs to verify the browser identity and must not
// require sending the password again in the WebSocket URL.
func (r *Room) connectMember(memberID string) (string, error) {
	if strings.TrimSpace(memberID) == "" {
		return "", errors.New("请先进入房间")
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.config.Members[memberID].ID == "" {
		return "", errors.New("请先进入房间")
	}
	if r.state.EmptySince != nil {
		r.state.EmptySince = nil
		if err := r.saveStateLocked(); err != nil {
			return "", err
		}
	}
	return memberID, nil
}

func (r *Room) summaryLocked() RoomSummary {
	var current *Music
	if r.state.Current != nil {
		item := r.state.Current.Music
		current = &item
	}
	return RoomSummary{ID: r.config.ID, Name: r.config.Name, Locked: r.config.EntryPasswordHash != "", OnlineCount: len(r.connections), MaxMembers: r.config.MaxMembers, CurrentMusic: current, CreatedAt: r.config.CreatedAt}
}

func (r *Room) snapshotLocked(memberID, token string, secret []byte) Snapshot {
	member := r.config.Members[memberID]
	sources := make([]string, 0, len(r.config.Credentials))
	for source := range r.config.Credentials {
		sources = append(sources, source)
	}
	return Snapshot{Room: r.summaryLocked(), State: r.state, IsAdmin: verifyAdminToken(secret, token, r.config.ID, r.config.AdminPasswordHash, r.config.AdminVersion), AllowGuestQueue: !r.config.GuestQueueDisabled, MemberID: memberID, Nickname: member.Nickname, CredentialSources: sources}
}

func (r *Room) saveLocked() error {
	if err := r.saveConfigLocked(); err != nil {
		return err
	}
	return r.saveStateLocked()
}
func (r *Room) saveConfigLocked() error {
	return writeJSON(filepath.Join(r.path, ".config.json"), r.config)
}
func (r *Room) saveStateLocked() error {
	return writeJSON(filepath.Join(r.path, ".state.json"), r.state)
}

func readJSON(path string, target interface{}) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, target)
}
func writeJSON(path string, value interface{}) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	temp := path + ".tmp"
	if err := os.WriteFile(temp, data, 0600); err != nil {
		return err
	}
	return os.Rename(temp, path)
}

func sanitizeName(value string, limit int) string {
	value = strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	characters := []rune(value)
	if len(characters) > limit {
		characters = characters[:limit]
	}
	return string(characters)
}

func validateSource(value string) error {
	if value != "cloud" && value != "qq" && value != "migu" {
		return fmt.Errorf("不支持的音乐平台")
	}
	return nil
}

type CreateRoomRequest struct {
	Name          string `json:"name"`
	EntryPassword string `json:"entryPassword"`
	AdminPassword string `json:"adminPassword"`
	Nickname      string `json:"nickname"`
	VisitorID     string `json:"visitorId"`
	Fingerprint   string `json:"fingerprint"`
}
