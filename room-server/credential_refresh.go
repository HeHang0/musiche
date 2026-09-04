package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

const qqCredentialRefreshAge = 24 * time.Hour

// refreshCredentials is intentionally process-wide. It walks the persisted
// room credentials from one timer instead of creating one background task per
// room or per connected member.
func (s *RoomStore) refreshCredentials() {
	s.mu.RLock()
	rooms := make([]*Room, 0, len(s.rooms))
	for _, room := range s.rooms {
		rooms = append(rooms, room)
	}
	s.mu.RUnlock()

	for _, room := range rooms {
		room.mu.RLock()
		sources := make([]string, 0, len(room.config.Credentials))
		for source := range room.config.Credentials {
			sources = append(sources, source)
		}
		roomID := room.config.ID
		roomPath := room.path
		room.mu.RUnlock()
		sort.Strings(sources)

		for _, source := range sources {
			raw, err := readCredential(roomPath, source, s.config.CookieKey)
			if err != nil {
				s.logf("credential_refresh_read_failed room_id=%q source=%s error=%q", roomID, source, err)
				continue
			}
			updated, changed, err := s.resolver.refreshCredential(source, raw)
			if err != nil {
				s.logf("credential_refresh_failed room_id=%q source=%s error=%q", roomID, source, err)
				continue
			}
			if !changed {
				continue
			}
			if err := s.saveRefreshedCredential(room, source, updated); err != nil {
				s.logf("credential_refresh_save_failed room_id=%q source=%s error=%q", roomID, source, err)
				continue
			}
			s.logf("credential_refreshed room_id=%q source=%s", roomID, source)
		}
	}
}

func (s *RoomStore) saveRefreshedCredential(room *Room, source, raw string) error {
	encrypted, err := encrypt(s.config.CookieKey, []byte(raw))
	if err != nil {
		return err
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	room.mu.Lock()
	defer room.mu.Unlock()
	if s.rooms[room.config.ID] != room {
		return errors.New("房间已解散")
	}
	if _, exists := room.config.Credentials[source]; !exists {
		return errors.New("房间 Cookie 已删除")
	}
	path := filepath.Join(room.path, "credentials", source+".enc")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	if err := os.WriteFile(path, encrypted, 0600); err != nil {
		return err
	}
	room.config.Credentials[source] = SecretInfo{UpdatedAt: time.Now().UTC()}
	return room.saveConfigLocked()
}

// refreshCredential is the single provider dispatch point. New providers can
// add refresh support here without changing the global scheduling code.
func (r *Resolver) refreshCredential(source, raw string) (string, bool, error) {
	switch source {
	case "qq":
		return r.refreshQQCredential(raw)
	case "cloud", "migu":
		return raw, false, nil
	default:
		return raw, false, fmt.Errorf("不支持的音乐平台")
	}
}

func (r *Resolver) refreshQQCredential(raw string) (string, bool, error) {
	cookie := strings.TrimSpace(credentialValue(raw, "cookie"))
	if cookie == "" {
		return raw, false, nil
	}
	values := parseCookieValues(cookie)
	if createdAt, ok := qqMusicKeyCreatedAt(values["psrf_musickey_createtime"]); ok && time.Since(createdAt) < qqCredentialRefreshAge {
		return raw, false, nil
	}
	refreshToken := firstCookieValue(values, "psrf_qqrefresh_token", "wxrefresh_token")
	if refreshToken == "" {
		return raw, false, nil
	}

	payload := map[string]any{
		"req": map[string]any{
			"module": "music.login.LoginServer",
			"method": "QQLogin",
			"param": map[string]any{
				"openid":        firstCookieValue(values, "psrf_qqopenid", "wxopenid"),
				"access_token":  firstCookieValue(values, "psrf_qqaccess_token", "wxaccess_token"),
				"refresh_token": refreshToken,
				"expired_in":    cookieIntValue(values, "psrf_access_token_expiresAt"),
				"musicid":       cookieIntValue(values, "uin"),
				"musickey":      firstCookieValue(values, "qqmusic_key", "qm_keyst"),
				"refresh_key":   values["refresh_key"],
				"unionid":       firstCookieValue(values, "psrf_qqunionid", "wxunionid"),
				"loginMode":     2,
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return raw, false, err
	}
	request, err := http.NewRequest(http.MethodPost, "https://u.y.qq.com/cgi-bin/musicu.fcg", bytes.NewReader(body))
	if err != nil {
		return raw, false, err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Referer", "https://y.qq.com")
	request.Header.Set("Cookie", cookie)
	request.Header.Set("User-Agent", "Mozilla/5.0")
	response, err := r.client.Do(request)
	if err != nil {
		return raw, false, err
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		return raw, false, fmt.Errorf("QQ 音乐 Cookie 刷新失败（%s）", response.Status)
	}
	var result struct {
		Req struct {
			Data map[string]any `json:"data"`
		} `json:"req"`
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, 1024*1024))
	decoder.UseNumber()
	if err := decoder.Decode(&result); err != nil {
		return raw, false, err
	}
	data := result.Req.Data
	if cookieString(data["musickey"]) == "" {
		return raw, false, errors.New("QQ 音乐 Cookie 刷新未返回 musickey")
	}
	updateCookieAlias(values, []string{"psrf_qqopenid", "wxopenid"}, cookieString(data["openid"]))
	updateCookieAlias(values, []string{"psrf_qqrefresh_token", "wxrefresh_token"}, cookieString(data["refresh_token"]))
	updateCookieAlias(values, []string{"psrf_qqaccess_token", "wxaccess_token"}, cookieString(data["access_token"]))
	updateCookieAlias(values, []string{"psrf_qqunionid", "wxunionid"}, cookieString(data["unionid"]))
	updateCookieAlias(values, []string{"qqmusic_key"}, cookieString(data["musickey"]))
	updateCookieAlias(values, []string{"qm_keyst"}, cookieString(data["musickey"]))
	if value := cookieString(data["expired_at"]); value != "" {
		values["psrf_access_token_expiresAt"] = value
	}
	if value := firstDataValue(data, "musickeyCreateTime", "musickey_createtime"); value != "" {
		values["psrf_musickey_createtime"] = value
	}
	updatedCookie := formatCookieValues(values)
	updatedRaw := replaceCredentialCookie(raw, updatedCookie)
	return updatedRaw, updatedRaw != raw, nil
}

func parseCookieValues(cookie string) map[string]string {
	values := map[string]string{}
	for _, part := range strings.Split(cookie, ";") {
		pair := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(pair) == 2 && pair[0] != "" {
			values[pair[0]] = pair[1]
		}
	}
	return values
}

func formatCookieValues(values map[string]string) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, key+"="+values[key])
	}
	return strings.Join(parts, "; ")
}

func replaceCredentialCookie(raw, cookie string) string {
	object := map[string]any{}
	if json.Unmarshal([]byte(raw), &object) == nil {
		if _, exists := object["cookie"]; exists {
			object["cookie"] = cookie
			if encoded, err := json.Marshal(object); err == nil {
				return string(encoded)
			}
		}
	}
	return cookie
}

func firstCookieValue(values map[string]string, keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(values[key]); value != "" {
			return value
		}
	}
	return ""
}

func cookieIntValue(values map[string]string, key string) int64 {
	value, _ := strconv.ParseInt(strings.TrimSpace(values[key]), 10, 64)
	return value
}

func qqMusicKeyCreatedAt(value string) (time.Time, bool) {
	seconds, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil || seconds <= 0 {
		return time.Time{}, false
	}
	if seconds > 1_000_000_000_000 {
		return time.UnixMilli(seconds), true
	}
	return time.Unix(seconds, 0), true
}

func cookieString(value any) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(value))
}

func firstDataValue(data map[string]any, keys ...string) string {
	for _, key := range keys {
		if value := cookieString(data[key]); value != "" {
			return value
		}
	}
	return ""
}

func updateCookieAlias(values map[string]string, keys []string, value string) {
	if value == "" {
		return
	}
	for _, key := range keys {
		if _, exists := values[key]; exists {
			values[key] = value
			return
		}
	}
}
