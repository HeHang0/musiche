package main

import (
	"path/filepath"
	"testing"
)

func TestLoadConfigSuperAdminPassword(t *testing.T) {
	t.Setenv("ROOM_SUPER_ADMIN_PASSWORD", "super-password")
	t.Setenv("ROOM_SUPER_PASSWORD", "")
	if got := loadConfig().SuperAdminPassword; got != "super-password" {
		t.Fatalf("super admin password was not loaded: %q", got)
	}
}

func TestLoadConfigSuperAdminPasswordAlias(t *testing.T) {
	t.Setenv("ROOM_SUPER_ADMIN_PASSWORD", "")
	t.Setenv("ROOM_SUPER_PASSWORD", "alias-password")
	if got := loadConfig().SuperAdminPassword; got != "alias-password" {
		t.Fatalf("super admin password alias was not loaded: %q", got)
	}
}

func TestLoadConfigLogging(t *testing.T) {
	dataDir := t.TempDir()
	t.Setenv("ROOM_DATA_DIR", dataDir)
	t.Setenv("ROOM_LOG_FILE", "")
	t.Setenv("ROOM_LOG_TOKEN", "view-logs")
	t.Setenv("ROOM_LOG_MAX_MB", "3")
	t.Setenv("ROOM_LOG_BACKUPS", "2")
	config := loadConfig()
	if config.LogFile != filepath.Join(dataDir, "logs", "room-server.log") {
		t.Fatalf("unexpected default log path: %q", config.LogFile)
	}
	if config.LogViewToken != "view-logs" || config.LogMaxBytes != 3*1024*1024 || config.LogBackups != 2 {
		t.Fatalf("unexpected log config: %#v", config)
	}
}
