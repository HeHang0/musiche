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
	if _, err := room.join("visitor-2", "browser-2", "小红", "", ""); err != nil {
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

func TestExpiredRoomsAreKeptBelowOneThirdCapacity(t *testing.T) {
	config := Config{
		DataDir: t.TempDir(), MaxRooms: 9, MaxMembersPerRoom: 30,
		EmptyTTL: time.Minute, TokenSecret: []byte("room-expiry-threshold-test"),
	}
	store, err := newRoomStore(config)
	if err != nil {
		t.Fatal(err)
	}
	for index := 0; index < 2; index++ {
		room, _, err := store.createRoom(CreateRoomRequest{
			Name: "保留歌房", Nickname: "用户", VisitorID: "visitor" + string(rune('A'+index)), Fingerprint: "fingerprint" + string(rune('A'+index)), AdminPassword: "administrator-password",
		})
		if err != nil {
			t.Fatal(err)
		}
		expiredAt := time.Now().UTC().Add(-2 * time.Minute)
		room.state.EmptySince = &expiredAt
	}
	store.removeExpiredRooms()
	if len(store.rooms) != 2 {
		t.Fatalf("expected empty rooms to remain below one-third capacity, got %d", len(store.rooms))
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

func TestMemberToken(t *testing.T) {
	secret := []byte("member-token-secret")
	token := issueMemberToken(secret, "ROOM1", "member1")
	if memberID, ok := verifyMemberToken(secret, token, "ROOM1"); !ok || memberID != "member1" {
		t.Fatalf("member token did not verify: %q %v", memberID, ok)
	}
	if _, ok := verifyMemberToken(secret, token, "ROOM2"); ok {
		t.Fatal("member token must not verify for another room")
	}
	if _, ok := verifyMemberToken(secret, token+"x", "ROOM1"); ok {
		t.Fatal("tampered member token must not verify")
	}
}

func TestRoomAdminTokenIsSharedAndRotatesWithPassword(t *testing.T) {
	secret := []byte("room-admin-token-secret")
	passwordHash := hashPassword("administrator-password")
	first := issueAdminToken(secret, "ROOM1", passwordHash, 1)
	second := issueAdminToken(secret, "ROOM1", passwordHash, 1)
	if first == "" || first != second {
		t.Fatal("the same room administrator password must produce the same token")
	}
	if !verifyAdminToken(secret, first, "ROOM1", passwordHash, 1) {
		t.Fatal("room administrator token did not verify")
	}
	changedPasswordHash := hashPassword("new-administrator-password")
	if verifyAdminToken(secret, first, "ROOM1", changedPasswordHash, 2) {
		t.Fatal("changing the administrator password must invalidate the old token")
	}
	if rotated := issueAdminToken(secret, "ROOM1", changedPasswordHash, 2); rotated == first {
		t.Fatal("changing the administrator password must rotate the token")
	}
}

func TestRoomJoinChecksEntryPasswordForKnownMembers(t *testing.T) {
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
	room, _, err := store.createRoom(CreateRoomRequest{
		Name:          "密码歌房",
		EntryPassword: "entry-password",
		Nickname:      "房主",
		VisitorID:     "owner",
		Fingerprint:   "owner-browser",
		AdminPassword: "administrator-password",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := room.join("visitor", "browser", "访客", "wrong-password", ""); err == nil {
		t.Fatal("a wrong entry password must be rejected for a new member")
	}
	if _, err := room.join("visitor", "browser", "访客", "entry-password", ""); err != nil {
		t.Fatal(err)
	}
	if _, err := room.join("visitor", "browser", "访客", "wrong-password", ""); err == nil {
		t.Fatal("a wrong entry password must be rejected for a known member")
	}
	if _, err := room.connectMember(fingerprintHash("visitor", "browser")); err != nil {
		t.Fatal(err)
	}
	if _, err := room.connectMember(fingerprintHash("unknown", "browser")); err == nil {
		t.Fatal("a websocket must not create a member without a prior password-checked join")
	}
}
