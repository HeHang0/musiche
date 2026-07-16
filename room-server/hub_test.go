package main

import "testing"

func TestRandomQueueItemRemovesExactlyOneWaitingSong(t *testing.T) {
	state := RoomState{Queue: []QueueItem{
		{ID: "first"},
		{ID: "second"},
		{ID: "third"},
	}}
	selected := randomQueueItem(&state)
	if selected == nil {
		t.Fatal("expected a queue item")
	}
	if len(state.Queue) != 2 {
		t.Fatalf("unexpected queue length: %d", len(state.Queue))
	}
	for _, item := range state.Queue {
		if item.ID == selected.ID {
			t.Fatalf("selected item %q was not removed", selected.ID)
		}
	}
}

func TestRandomQueueItemEmptyQueue(t *testing.T) {
	if item := randomQueueItem(&RoomState{}); item != nil {
		t.Fatalf("expected no item, got %#v", item)
	}
}

func TestNextQueueItemUsesQueueOrderWhenRandomPlaybackDisabled(t *testing.T) {
	state := RoomState{Queue: []QueueItem{{ID: "first"}, {ID: "second"}}}
	next := nextQueueItem(&state)
	if next == nil || next.ID != "first" {
		t.Fatalf("expected first queued item, got %#v", next)
	}
	if len(state.Queue) != 1 || state.Queue[0].ID != "second" {
		t.Fatalf("unexpected remaining queue: %#v", state.Queue)
	}
}

func TestTrackUnavailableSkipsOnlyNoRightCurrentSong(t *testing.T) {
	room := &Room{
		config: RoomConfig{ID: "ROOM1"},
		state: RoomState{
			Current: &QueueItem{ID: "blocked", Music: Music{}},
			Queue:   []QueueItem{{ID: "playable"}},
		},
		connections: map[*RoomConnection]struct{}{},
		path:        t.TempDir(),
	}
	connection := &RoomConnection{room: room}
	if err := connection.handle(ClientCommand{Action: "track_unavailable", QueueID: "blocked", NoRight: true}); err != nil {
		t.Fatalf("skip unavailable track: %v", err)
	}
	if room.state.Current == nil || room.state.Current.ID != "playable" || !room.state.Playback.Playing {
		t.Fatalf("unexpected state after skip: %#v", room.state)
	}
	if len(room.state.Queue) != 0 {
		t.Fatalf("unexpected queue after skip: %#v", room.state.Queue)
	}
}
