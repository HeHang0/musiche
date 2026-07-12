package main

import "testing"

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
