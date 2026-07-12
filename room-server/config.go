package main

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Config is intentionally environment based so a room service can be
// configured without changing the web bundle.
type Config struct {
	Address             string
	DataDir             string
	MaxRooms            int
	MaxMembersPerRoom   int
	MaxQueueItems       int
	MaxConnections      int
	ListPageSize        int
	ListMaxPageSize     int
	EmptyTTL            time.Duration
	MaxChatMessages     int
	MaxChatMessageBytes int
	MaxChatImageBytes   int
	AudioCacheTTL       time.Duration
	TokenSecret         []byte
	CookieKey           []byte
	SuperAdminPassword  string
}

func loadConfig() Config {
	superAdminPassword := envString("ROOM_SUPER_ADMIN_PASSWORD", "")
	if superAdminPassword == "" {
		// Keep the shorter alias for deployments that configured the first
		// development name before ROOM_SUPER_ADMIN_PASSWORD was documented.
		superAdminPassword = envString("ROOM_SUPER_PASSWORD", "")
	}
	c := Config{
		Address:             envString("ROOM_ADDR", ":8738"),
		DataDir:             envString("ROOM_DATA_DIR", "./room-data"),
		MaxRooms:            envInt("ROOM_MAX_COUNT", 50),
		MaxMembersPerRoom:   envInt("ROOM_MAX_MEMBERS_PER_ROOM", 30),
		MaxQueueItems:       envInt("ROOM_MAX_QUEUE_ITEMS", 100),
		MaxConnections:      envInt("ROOM_MAX_TOTAL_CONNECTIONS", 1000),
		ListPageSize:        envInt("ROOM_LIST_PAGE_SIZE", 24),
		ListMaxPageSize:     envInt("ROOM_LIST_MAX_PAGE_SIZE", 50),
		EmptyTTL:            time.Duration(envInt("ROOM_EMPTY_TTL_MINUTES", 30)) * time.Minute,
		MaxChatMessages:     envInt("ROOM_MAX_CHAT_MESSAGES", 500),
		MaxChatMessageBytes: envInt("ROOM_MAX_CHAT_MESSAGE_BYTES", 600),
		MaxChatImageBytes:   envInt("ROOM_MAX_CHAT_IMAGE_BYTES", 512*1024),
		AudioCacheTTL:       time.Duration(envInt("ROOM_AUDIO_CACHE_SECONDS", 300)) * time.Second,
		SuperAdminPassword:  superAdminPassword,
	}
	secret := envString("ROOM_TOKEN_SECRET", "123456")
	if secret == "" {
		// A process-local fallback is safe for development, but operators should
		// always configure ROOM_TOKEN_SECRET in production to preserve sessions.
		secret = randomID(48)
	}
	sum := sha256.Sum256([]byte(secret))
	c.TokenSecret = sum[:]
	if cookieSecret := envString("ROOM_COOKIE_KEY", "123456"); cookieSecret != "" {
		cookieSum := sha256.Sum256([]byte(cookieSecret))
		c.CookieKey = cookieSum[:]
	}
	c.DataDir = filepath.Clean(c.DataDir)
	return c
}

func envString(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err == nil && value > 0 {
		return value
	}
	return fallback
}

func encodeKey(value []byte) string { return base64.RawURLEncoding.EncodeToString(value) }
