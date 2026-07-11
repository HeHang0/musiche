package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Resolver owns short-lived parsed music URLs. The raw URLs never enter room
// state or the queue file, and are renewed after ROOM_AUDIO_CACHE_SECONDS.
type Resolver struct {
	config Config
	client *http.Client
	mu     sync.Mutex
	cache  map[string]resolvedCacheItem
}

type resolvedCacheItem struct {
	music   Music
	expires time.Time
}

var errInvalidCredential = errors.New("音乐平台 Cookie 无效，请管理员重新登录")

func newResolver(config Config) *Resolver {
	return &Resolver{config: config, client: &http.Client{Timeout: 12 * time.Second}, cache: map[string]resolvedCacheItem{}}
}

func (r *Resolver) resolve(room *Room, music Music) (Music, error) {
	if music.ID == "" || music.Type == "" {
		return Music{}, errors.New("无效的歌曲")
	}
	room.mu.RLock()
	_, configured := room.config.Credentials[music.Type]
	roomID := room.config.ID
	path := room.path
	room.mu.RUnlock()
	key := r.cacheKey(roomID, music)
	r.mu.Lock()
	if cached, ok := r.cache[key]; ok && time.Now().Before(cached.expires) {
		r.mu.Unlock()
		return cached.music, nil
	}
	r.mu.Unlock()
	if !configured {
		return Music{}, fmt.Errorf("房间未配置%s的解析 Cookie", sourceName(music.Type))
	}
	cookie, err := readCredential(path, music.Type, r.config.CookieKey)
	if err != nil {
		return Music{}, err
	}
	var resolved Music
	switch music.Type {
	case "cloud":
		resolved, err = r.resolveCloud(music, cookie)
	case "migu":
		resolved, err = r.resolveMigu(music, cookie)
	case "qq":
		resolved, err = r.resolveQQ(music, cookie)
	default:
		err = errors.New("不支持的音乐平台")
	}
	if err != nil {
		// A provider can reject an otherwise well-formed song request when the
		// persisted Cookie has expired. Re-check the account before returning the
		// resolver error so stale credentials are removed from the room.
		if validationErr := r.validateCredential(music.Type, cookie); validationErr != nil {
			if errors.Is(validationErr, errInvalidCredential) {
				r.invalidateCredential(room, music.Type)
				return Music{}, validationErr
			}
			// A transient validation failure should not discard a working Cookie or
			// hide the provider's more useful parsing error.
			return Music{}, err
		}
		return Music{}, err
	}
	r.mu.Lock()
	r.cache[key] = resolvedCacheItem{music: resolved, expires: time.Now().Add(r.config.AudioCacheTTL)}
	r.mu.Unlock()
	return resolved, nil
}

func (r *Resolver) validateCredential(source, rawCredential string) error {
	cookie := strings.TrimSpace(credentialValue(rawCredential, "cookie"))
	if cookie == "" {
		return errInvalidCredential
	}
	switch source {
	case "cloud":
		return r.validateCloudCredential(cookie)
	case "qq":
		return r.validateQQCredential(cookie)
	case "migu":
		return r.validateMiguCredential(cookie)
	default:
		return errors.New("不支持的音乐平台")
	}
}

func (r *Resolver) validateQQCredential(cookie string) error {
	request, err := http.NewRequest(http.MethodGet, "https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?cid=205360838&reqfrom=1", nil)
	if err != nil {
		return err
	}
	request.Header.Set("Referer", "https://y.qq.com")
	request.Header.Set("Cookie", cookie)
	request.Header.Set("User-Agent", "Mozilla/5.0")
	response, err := r.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 500 {
		return fmt.Errorf("QQ 音乐账号验证失败（%s）", response.Status)
	}
	if response.StatusCode/100 != 2 {
		return errInvalidCredential
	}
	var result struct {
		Data struct {
			Creator struct {
				EncryptUIN any `json:"encrypt_uin"`
			} `json:"creator"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1024*1024)).Decode(&result); err != nil {
		return err
	}
	if value := strings.TrimSpace(fmt.Sprint(result.Data.Creator.EncryptUIN)); value == "" || value == "<nil>" || value == "0" {
		return errInvalidCredential
	}
	return nil
}

func (r *Resolver) validateCloudCredential(cookie string) error {
	csrf := cookieValue(cookie, "__csrf")
	musicU := cookieValue(cookie, "MUSIC_U")
	if musicU == "" {
		return errInvalidCredential
	}
	payload, _ := json.Marshal(map[string]any{})
	params, err := cloudEncrypt(string(payload))
	if err != nil {
		return err
	}
	form := url.Values{}
	form.Set("params", params)
	form.Set("encSecKey", "409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053")
	request, err := http.NewRequest(http.MethodPost, "https://music.163.com/weapi/w/nuser/account/get?csrf_token="+url.QueryEscape(csrf), strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Referer", "https://music.163.com")
	request.Header.Set("User-Agent", "Mozilla/5.0")
	request.Header.Set("Cookie", "os=ios;MUSIC_U="+musicU+";__csrf="+csrf)
	response, err := r.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 500 {
		return fmt.Errorf("网易云账号验证失败（%s）", response.Status)
	}
	if response.StatusCode/100 != 2 {
		return errInvalidCredential
	}
	var result struct {
		Profile *struct {
			UserID any `json:"userId"`
		} `json:"profile"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1024*1024)).Decode(&result); err != nil {
		return err
	}
	if result.Profile == nil {
		return errInvalidCredential
	}
	if value := strings.TrimSpace(fmt.Sprint(result.Profile.UserID)); value == "" || value == "<nil>" || value == "0" {
		return errInvalidCredential
	}
	return nil
}

func (r *Resolver) validateMiguCredential(cookie string) error {
	request, err := http.NewRequest(http.MethodGet, "https://app.c.nf.migu.cn/pc/user/h5/queryUserInfo/v1.0", nil)
	if err != nil {
		return err
	}
	request.Header.Set("Cookie", cookie)
	request.Header.Set("User-Agent", "Mozilla/5.0")
	response, err := r.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 500 {
		return fmt.Errorf("咪咕账号验证失败（%s）", response.Status)
	}
	if response.StatusCode/100 != 2 {
		return errInvalidCredential
	}
	var result struct {
		UserInfoItem *struct {
			UserID any `json:"userId"`
		} `json:"userInfoItem"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1024*1024)).Decode(&result); err != nil {
		return err
	}
	if result.UserInfoItem == nil {
		return errInvalidCredential
	}
	if value := strings.TrimSpace(fmt.Sprint(result.UserInfoItem.UserID)); value == "" || value == "<nil>" || value == "0" {
		return errInvalidCredential
	}
	return nil
}

func (r *Resolver) invalidateCredential(room *Room, source string) {
	room.mu.Lock()
	if _, exists := room.config.Credentials[source]; !exists {
		room.mu.Unlock()
		return
	}
	delete(room.config.Credentials, source)
	_ = os.Remove(filepath.Join(room.path, "credentials", source+".enc"))
	_ = room.saveConfigLocked()
	roomID := room.config.ID
	room.mu.Unlock()

	r.mu.Lock()
	for key := range r.cache {
		if strings.HasPrefix(key, roomID+"|"+source+"|") {
			delete(r.cache, key)
		}
	}
	r.mu.Unlock()
	broadcastRoomSnapshot(room)
}

// resolveQQ mirrors web/src/utils/api/qq.ts's downloadUrl implementation.
// QQ's endpoint only needs the request payload, Referer and the room's
// uploaded Cookie; no third-party signer is involved.
func (r *Resolver) resolveQQ(music Music, rawCredential string) (Music, error) {
	cookie := credentialValue(rawCredential, "cookie")
	if cookie == "" {
		return Music{}, errors.New("QQ 音乐 Cookie 为空")
	}
	for _, audition := range []bool{false, true} {
		filename := []string{}
		if audition && music.Remark != "" {
			filename = []string{music.Remark}
		}
		payload := map[string]any{
			"comm": map[string]any{
				"cv": 4747474, "ct": 24, "format": "json",
				"inCharset": "utf-8", "outCharset": "utf-8",
				"notice": 0, "platform": "yqq.json", "needNewCode": 1,
			},
			"req_0": map[string]any{
				"module": "vkey.GetVkeyServer",
				"method": "CgiGetVkey",
				"param": map[string]any{
					"guid":      qqGUID(),
					"songmid":   []string{string(music.ID)},
					"songtype":  []int{0},
					"uin":       "",
					"loginflag": 1,
					"platform":  "20",
					"filename":  filename,
				},
			},
		}
		body, err := json.Marshal(payload)
		if err != nil {
			return Music{}, err
		}
		request, err := http.NewRequest(http.MethodPost, "https://u.y.qq.com/cgi-bin/musicu.fcg", bytes.NewReader(body))
		if err != nil {
			return Music{}, err
		}
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Referer", "https://y.qq.com")
		request.Header.Set("Cookie", cookie)
		request.Header.Set("User-Agent", "Mozilla/5.0")
		response, err := r.client.Do(request)
		if err != nil {
			return Music{}, err
		}
		encoded, readErr := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024))
		response.Body.Close()
		if readErr != nil {
			return Music{}, readErr
		}
		if response.StatusCode/100 != 2 {
			return Music{}, fmt.Errorf("QQ 音乐解析失败（%s）", response.Status)
		}
		var result struct {
			Req0 struct {
				Data struct {
					SIP        []string `json:"sip"`
					MidURLInfo []struct {
						PURL string `json:"purl"`
					} `json:"midurlinfo"`
				} `json:"data"`
			} `json:"req_0"`
		}
		if err := json.Unmarshal(encoded, &result); err != nil {
			return Music{}, err
		}
		if len(result.Req0.Data.MidURLInfo) == 0 || result.Req0.Data.MidURLInfo[0].PURL == "" {
			continue
		}
		prefix := "https://dl.stream.qqmusic.qq.com/"
		for _, candidate := range result.Req0.Data.SIP {
			if candidate != "" {
				prefix = strings.Replace(candidate, "http://", "https://", 1)
				break
			}
		}
		music.URL = prefix + result.Req0.Data.MidURLInfo[0].PURL
		return music, nil
	}
	return Music{}, errors.New("当前 QQ 音乐没有可播放地址")
}

func qqGUID() string {
	return fmt.Sprintf("%010d", time.Now().UnixNano()%10000000000)
}

func (r *Resolver) cacheKey(roomID string, music Music) string {
	return strings.Join([]string{roomID, music.Type, string(music.ID), music.Remark}, "|")
}

// cacheResolved lets an administrator seed the server cache with the URL that
// their already-authorised Web player resolved. It remains a compatibility
// path for cases where a platform resolver or cookie is temporarily invalid.
func (r *Resolver) cacheResolved(room *Room, music Music) error {
	if music.ID == "" || music.Type == "" || strings.TrimSpace(music.URL) == "" {
		return errors.New("无效的播放地址")
	}
	parsed, err := url.Parse(music.URL)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return errors.New("播放地址格式错误")
	}
	room.mu.RLock()
	key := r.cacheKey(room.config.ID, music)
	room.mu.RUnlock()
	r.mu.Lock()
	r.cache[key] = resolvedCacheItem{music: music, expires: time.Now().Add(r.config.AudioCacheTTL)}
	r.mu.Unlock()
	return nil
}

func readCredential(roomPath, source string, key []byte) (string, error) {
	if len(key) == 0 {
		return "", errors.New("服务端未配置 ROOM_COOKIE_KEY")
	}
	encrypted, err := osReadFile(filepath.Join(roomPath, "credentials", source+".enc"))
	if err != nil {
		return "", errors.New("无法读取房间 Cookie")
	}
	plain, err := decrypt(key, encrypted)
	if err != nil {
		return "", errors.New("无法解密房间 Cookie")
	}
	return string(plain), nil
}

func credentialValue(raw string, field string) string {
	var object map[string]any
	if json.Unmarshal([]byte(raw), &object) == nil {
		if value, ok := object[field]; ok {
			return fmt.Sprint(value)
		}
		if field == "cookie" {
			values := make([]string, 0, len(object))
			for key, value := range object {
				if key != "uid" {
					values = append(values, key+"="+fmt.Sprint(value))
				}
			}
			return strings.Join(values, "; ")
		}
	}
	if field == "cookie" {
		return raw
	}
	return ""
}

func cookieValue(cookie, key string) string {
	for _, part := range strings.Split(cookie, ";") {
		pair := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(pair) == 2 && pair[0] == key {
			return pair[1]
		}
	}
	return ""
}

func (r *Resolver) resolveCloud(music Music, rawCredential string) (Music, error) {
	cookie := credentialValue(rawCredential, "cookie")
	csrf := cookieValue(cookie, "__csrf")
	musicU := cookieValue(cookie, "MUSIC_U")
	payload, _ := json.Marshal(map[string]any{"ids": []string{string(music.ID)}, "br": 480000, "csrf_token": csrf})
	params, err := cloudEncrypt(string(payload))
	if err != nil {
		return Music{}, err
	}
	form := url.Values{}
	form.Set("params", params)
	form.Set("encSecKey", "409afd10f2fa06173df57525287c4a1cdf6fa08bd542c6400da953704eb92dc1ad3c582e82f51a707ebfa0f6a25bcd185139fc1509d40dd97b180ed21641df55e90af4884a0b587bd25256141a9270b1b6f18908c6a626b74167e5a55a796c0f808a2eb12c33e63d34a7c4d358bab1dc661637dd1e888a1268b81a89f6136053")
	request, err := http.NewRequest(http.MethodPost, "https://music.163.com/weapi/song/enhance/player/url?csrf_token="+url.QueryEscape(csrf), strings.NewReader(form.Encode()))
	if err != nil {
		return Music{}, err
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	request.Header.Set("Referer", "https://music.163.com")
	request.Header.Set("User-Agent", "Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34")
	request.Header.Set("Cookie", "os=ios;MUSIC_U="+musicU+";__csrf="+csrf)
	response, err := r.client.Do(request)
	if err != nil {
		return Music{}, err
	}
	defer response.Body.Close()
	if response.StatusCode/100 != 2 {
		return Music{}, fmt.Errorf("网易云解析失败（%s）", response.Status)
	}
	var data struct {
		Data []struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1024*1024)).Decode(&data); err != nil {
		return Music{}, err
	}
	if len(data.Data) == 0 || data.Data[0].URL == "" {
		return Music{}, errors.New("当前网易云歌曲没有可播放地址")
	}
	music.URL = strings.Replace(data.Data[0].URL, "http://", "https://", 1)
	return music, nil
}

func cloudEncrypt(value string) (string, error) {
	first, err := aesCBCBase64([]byte(value), []byte("0CoJUm6Qyw8W8jud"))
	if err != nil {
		return "", err
	}
	return aesCBCBase64([]byte(first), []byte("t9Y0m4pdsoMznMlL"))
}

func aesCBCBase64(value, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	padding := aes.BlockSize - len(value)%aes.BlockSize
	value = append(value, bytes.Repeat([]byte{byte(padding)}, padding)...)
	output := make([]byte, len(value))
	cipher.NewCBCEncrypter(block, []byte("0102030405060708")).CryptBlocks(output, value)
	return base64.StdEncoding.EncodeToString(output), nil
}

func (r *Resolver) resolveMigu(music Music, rawCredential string) (Music, error) {
	cookie := credentialValue(rawCredential, "cookie")
	uid := credentialValue(rawCredential, "uid")
	if uid == "" {
		var err error
		uid, err = r.miguUserID(cookie)
		if err != nil {
			return Music{}, err
		}
	}
	endpoint := "https://app.c.nf.migu.cn/strategy/pc/listen/v2.0?contentId=" + url.QueryEscape(music.Remark) + "&copyrightId=" + url.QueryEscape(string(music.ID)) + "&scene=&netType=01&resourceType=2&toneFlag=SQ"
	request, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return Music{}, err
	}
	request.Header.Set("channel", "014X031")
	request.Header.Set("cookie", cookie)
	request.Header.Set("uid", uid)
	request.Header.Set("appid", "h5")
	request.Header.Set("birth", "h5page")
	request.Header.Set("signature", "1")
	request.Header.Set("referer", "https://music.migu.cn/")
	response, err := r.client.Do(request)
	if err != nil {
		return Music{}, err
	}
	defer response.Body.Close()
	encoded, err := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024))
	if err != nil {
		return Music{}, err
	}
	decoded := decodeMigu(encoded)
	var data struct {
		Data struct {
			URL    string `json:"url"`
			LrcURL string `json:"lrcUrl"`
			Song   struct {
				Duration int64  `json:"duration"`
				Img1     string `json:"img1"`
				Img2     string `json:"img2"`
			} `json:"song"`
		} `json:"data"`
	}
	if err := json.Unmarshal(decoded, &data); err != nil {
		return Music{}, errors.New("咪咕返回了无法识别的数据")
	}
	if data.Data.URL == "" {
		return Music{}, errors.New("当前咪咕歌曲没有可播放地址")
	}
	music.URL = strings.Replace(data.Data.URL, "http://", "https://", 1)
	music.LyricURL = data.Data.LrcURL
	if data.Data.Song.Duration > 0 {
		music.Length = data.Data.Song.Duration * 1000
	}
	if music.Image == "" {
		music.Image = data.Data.Song.Img2
		if music.Image == "" {
			music.Image = data.Data.Song.Img1
		}
	}
	return music, nil
}

func (r *Resolver) miguUserID(cookie string) (string, error) {
	request, _ := http.NewRequest(http.MethodGet, "https://app.c.nf.migu.cn/pc/user/h5/queryUserInfo/v1.0", nil)
	request.Header.Set("Cookie", cookie)
	response, err := r.client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	var data struct {
		UserInfoItem struct {
			UserID string `json:"userId"`
		} `json:"userInfoItem"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1024*1024)).Decode(&data); err != nil {
		return "", err
	}
	if data.UserInfoItem.UserID == "" {
		return "", errors.New("无法从咪咕 Cookie 获取用户信息")
	}
	return data.UserInfoItem.UserID, nil
}

func decodeMigu(encoded []byte) []byte {
	if len(encoded) < 5 {
		return nil
	}
	key := []byte("Jk8qzuePiJ1qE3mDYhLQ3T73DtDoAhLP")
	add := encoded[3]
	decoded := make([]byte, len(encoded)-4)
	for i := 4; i < len(encoded); i++ {
		decoded[i-4] = encoded[i] + add - key[(i-4)%len(key)]
	}
	return decoded
}

func sourceName(source string) string {
	if source == "cloud" {
		return "网易云"
	}
	if source == "qq" {
		return "QQ 音乐"
	}
	if source == "migu" {
		return "咪咕音乐"
	}
	return source
}

var osReadFile = func(path string) ([]byte, error) { return os.ReadFile(path) }
