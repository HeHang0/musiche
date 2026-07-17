package main

import (
	"encoding/json"
	"time"
)

// StringValue accepts both the string IDs used by QQ/咪咕 and the numeric IDs
// returned by 网易云. Without this adapter a single numeric song ID makes the
// WebSocket JSON decoder close the connection before the command is handled.
type StringValue string

func (value *StringValue) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		*value = ""
		return nil
	}
	var text string
	if err := json.Unmarshal(data, &text); err == nil {
		*value = StringValue(text)
		return nil
	}
	var number json.Number
	if err := json.Unmarshal(data, &number); err != nil {
		return err
	}
	*value = StringValue(number.String())
	return nil
}

type RoomConfig struct {
	ID                 string                `json:"id"`
	Name               string                `json:"name"`
	EntryPasswordHash  string                `json:"entryPasswordHash,omitempty"`
	AdminPasswordHash  string                `json:"adminPasswordHash"`
	AdminVersion       int                   `json:"adminVersion"`
	MaxMembers         int                   `json:"maxMembers"`
	GuestQueueDisabled bool                  `json:"guestQueueDisabled,omitempty"`
	CreatedAt          time.Time             `json:"createdAt"`
	Members            map[string]Member     `json:"members"`
	Credentials        map[string]SecretInfo `json:"credentials,omitempty"`
}

type Member struct {
	ID              string    `json:"id"`
	Nickname        string    `json:"nickname"`
	FingerprintHash string    `json:"fingerprintHash"`
	FirstJoinedAt   time.Time `json:"firstJoinedAt"`
	LastJoinedAt    time.Time `json:"lastJoinedAt"`
}

// SecretInfo deliberately exposes only metadata, never a cookie value.
type SecretInfo struct {
	UpdatedAt time.Time `json:"updatedAt"`
}

type RoomState struct {
	Version        int64         `json:"version"`
	Current        *QueueItem    `json:"current,omitempty"`
	Queue          []QueueItem   `json:"queue"`
	History        []QueueItem   `json:"history"`
	Playback       PlaybackState `json:"playback"`
	RandomPlayback bool          `json:"randomPlayback,omitempty"`
	EmptySince     *time.Time    `json:"emptySince,omitempty"`
}

type PlaybackState struct {
	Playing    bool      `json:"playing"`
	PositionMS int64     `json:"positionMs"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type Music struct {
	ID          StringValue `json:"id"`
	Name        string      `json:"name"`
	Image       string      `json:"image"`
	MediumImage string      `json:"mediumImage,omitempty"`
	LargeImage  string      `json:"largeImage,omitempty"`
	Singer      string      `json:"singer"`
	Album       string      `json:"album"`
	AlbumID     StringValue `json:"albumId,omitempty"`
	Duration    string      `json:"duration,omitempty"`
	Length      int64       `json:"length,omitempty"`
	VIP         bool        `json:"vip,omitempty"`
	NoRight     bool        `json:"noRight,omitempty"`
	Remark      string      `json:"remark,omitempty"`
	Type        string      `json:"type"`
	URL         string      `json:"url,omitempty"`
	LyricURL    string      `json:"lyricUrl,omitempty"`
}

type QueueItem struct {
	ID            string    `json:"id"`
	Music         Music     `json:"music"`
	RequestedBy   string    `json:"requestedBy"`
	RequestedName string    `json:"requestedName"`
	RequestedAt   time.Time `json:"requestedAt"`
}

type ChatMessage struct {
	ID        string    `json:"id"`
	MemberID  string    `json:"memberId"`
	Nickname  string    `json:"nickname"`
	Content   string    `json:"content"`
	Image     string    `json:"image,omitempty"`
	Avatar    string    `json:"avatar,omitempty"`
	System    bool      `json:"system,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type RoomSummary struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Locked       bool      `json:"locked"`
	OnlineCount  int       `json:"onlineCount"`
	MaxMembers   int       `json:"maxMembers"`
	CurrentMusic *Music    `json:"currentMusic,omitempty"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Snapshot struct {
	Room              RoomSummary `json:"room"`
	State             RoomState   `json:"state"`
	IsAdmin           bool        `json:"isAdmin"`
	AllowGuestQueue   bool        `json:"allowGuestQueue"`
	MemberID          string      `json:"memberId"`
	Nickname          string      `json:"nickname"`
	CredentialSources []string    `json:"credentialSources"`
}

type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
	Code string      `json:"code,omitempty"`
}
