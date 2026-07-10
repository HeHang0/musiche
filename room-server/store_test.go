package main

import (
	"testing"
	"time"
)

func TestRoomPersistenceAndIdentity(t *testing.T) {
	config := Config{
		DataDir:           t.TempDir(),
		MaxRooms:          50,
		MaxMembersPerRoom: 30,
		EmptyTTL:          30 * time.Minute,
		MaxChatMessages:   500,
		TokenSecret:       []byte("test-token-secret-test-token-secret"),
	}
	store, err := newRoomStore(config)
	if err != nil {
		t.Fatal(err)
	}
	room, token, err := store.createRoom(CreateRoomRequest{
		Name: "测试歌房", Nickname: "小明", VisitorID: "visitor-1", Fingerprint: "browser-1", AdminPassword: "administrator-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	if token == "" || room.config.ID == "" {
		t.Fatal("room creation did not return an administrator token")
	}
	current := store.findCurrent("visitor-1", "browser-1")
	if current == nil || current.Name != "测试歌房" {
		t.Fatal("room was not found through its persisted browser identity")
	}
	if _, err := room.join("visitor-2", "browser-2", "小红", ""); err != nil {
		t.Fatal(err)
	}
	if got := room.config.Members[fingerprintHash("visitor-2", "browser-2")].Nickname; got != "小红" {
		t.Fatalf("unexpected nickname: %s", got)
	}
	reloaded, err := newRoomStore(config)
	if err != nil {
		t.Fatal(err)
	}
	if _, exists := reloaded.get(room.config.ID); !exists {
		t.Fatal("room was not loaded from the room directory")
	}
}

func TestPasswordHash(t *testing.T) {
	encoded := hashPassword("administrator-password")
	if !verifyPassword(encoded, "administrator-password") {
		t.Fatal("password should verify")
	}
	if verifyPassword(encoded, "wrong-password") {
		t.Fatal("wrong password must not verify")
	}
}
