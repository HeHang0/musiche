package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestRefreshQQCredential(t *testing.T) {
	var requests atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Method != http.MethodPost || r.Header.Get("Cookie") == "" {
			t.Fatalf("unexpected refresh request: method=%s cookie=%q", r.Method, r.Header.Get("Cookie"))
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"req": map[string]any{"data": map[string]any{
			"musickey":           "new-key",
			"musickeyCreateTime": time.Now().Unix(),
			"refresh_token":      "new-refresh",
			"access_token":       "new-access",
			"expired_at":         1234567890,
		}}})
	}))
	defer upstream.Close()

	resolver := newResolver(Config{})
	resolver.client = upstream.Client()
	transport := resolver.client.Transport.(*http.Transport).Clone()
	transport.Proxy = nil
	resolver.client.Transport = roundTripRewrite{base: transport, target: upstream.URL}

	raw := "uin=123; qqmusic_key=old-key; psrf_qqrefresh_token=old-refresh; psrf_qqaccess_token=old-access; psrf_musickey_createtime=1"
	updated, changed, err := resolver.refreshQQCredential(raw)
	if err != nil || !changed {
		t.Fatalf("refresh result changed=%t err=%v", changed, err)
	}
	values := parseCookieValues(updated)
	if values["qqmusic_key"] != "new-key" || values["psrf_qqrefresh_token"] != "new-refresh" || values["psrf_qqaccess_token"] != "new-access" {
		t.Fatalf("credential was not updated: %#v", values)
	}
	if requests.Load() != 1 {
		t.Fatalf("expected one refresh request, got %d", requests.Load())
	}
}

func TestRefreshQQCredentialSkipsRecentCookie(t *testing.T) {
	resolver := newResolver(Config{})
	raw := "qqmusic_key=key; psrf_qqrefresh_token=refresh; psrf_musickey_createtime=" + strconv.FormatInt(time.Now().Unix(), 10)
	updated, changed, err := resolver.refreshQQCredential(raw)
	if err != nil || changed || updated != raw {
		t.Fatalf("recent credential should not refresh: changed=%t updated=%q err=%v", changed, updated, err)
	}
}

type roundTripRewrite struct {
	base   http.RoundTripper
	target string
}

func (r roundTripRewrite) RoundTrip(request *http.Request) (*http.Response, error) {
	clone := request.Clone(request.Context())
	clone.URL.Scheme = "http"
	clone.URL.Host = strings.TrimPrefix(r.target, "http://")
	return r.base.RoundTrip(clone)
}
