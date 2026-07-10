package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

func randomBytes(length int) []byte {
	result := make([]byte, length)
	if _, err := rand.Read(result); err != nil {
		panic(err)
	}
	return result
}

func randomID(length int) string {
	return base64.RawURLEncoding.EncodeToString(randomBytes(length))
}

// PBKDF2-SHA256 is used to avoid bringing a database or a password library
// into this small standalone service. The iteration count is encoded with the
// result, which lets it be increased without invalidating existing rooms.
func hashPassword(password string) string {
	salt := randomBytes(16)
	const iterations = 600000
	derived := pbkdf2SHA256([]byte(password), salt, iterations, 32)
	return fmt.Sprintf("pbkdf2-sha256$%d$%s$%s", iterations,
		base64.RawURLEncoding.EncodeToString(salt),
		base64.RawURLEncoding.EncodeToString(derived))
}

func verifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" {
		return false
	}
	var iterations int
	if _, err := fmt.Sscanf(parts[1], "%d", &iterations); err != nil || iterations < 1 {
		return false
	}
	salt, saltErr := base64.RawURLEncoding.DecodeString(parts[2])
	expected, expectedErr := base64.RawURLEncoding.DecodeString(parts[3])
	if saltErr != nil || expectedErr != nil {
		return false
	}
	actual := pbkdf2SHA256([]byte(password), salt, iterations, len(expected))
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func pbkdf2SHA256(password, salt []byte, iterations, keyLength int) []byte {
	result := make([]byte, 0, keyLength)
	for block := 1; len(result) < keyLength; block++ {
		mac := hmac.New(sha256.New, password)
		mac.Write(salt)
		mac.Write([]byte{byte(block >> 24), byte(block >> 16), byte(block >> 8), byte(block)})
		u := mac.Sum(nil)
		value := append([]byte(nil), u...)
		for i := 1; i < iterations; i++ {
			mac = hmac.New(sha256.New, password)
			mac.Write(u)
			u = mac.Sum(nil)
			for j := range value {
				value[j] ^= u[j]
			}
		}
		result = append(result, value...)
	}
	return result[:keyLength]
}

func encrypt(key, plain []byte) ([]byte, error) {
	if len(key) == 0 {
		return nil, errors.New("ROOM_COOKIE_KEY is not configured")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := randomBytes(gcm.NonceSize())
	return append(nonce, gcm.Seal(nil, nonce, plain, nil)...), nil
}

func decrypt(key, encrypted []byte) ([]byte, error) {
	if len(key) == 0 {
		return nil, errors.New("ROOM_COOKIE_KEY is not configured")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(encrypted) < gcm.NonceSize() {
		return nil, errors.New("invalid encrypted payload")
	}
	return gcm.Open(nil, encrypted[:gcm.NonceSize()], encrypted[gcm.NonceSize():], nil)
}

func issueAdminToken(secret []byte, roomID, memberID string, version int) string {
	expires := time.Now().Add(24 * time.Hour).Unix()
	payload := fmt.Sprintf("%s|%s|%d|%d", roomID, memberID, version, expires)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString([]byte(payload)) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func verifyAdminToken(secret []byte, token, roomID, memberID string, version int) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	signature, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	if subtle.ConstantTimeCompare(signature, mac.Sum(nil)) != 1 {
		return false
	}
	values := strings.Split(string(payload), "|")
	if len(values) != 4 || values[0] != roomID || values[1] != memberID {
		return false
	}
	var tokenVersion int
	var expires int64
	if _, err := fmt.Sscanf(values[2], "%d", &tokenVersion); err != nil || tokenVersion != version {
		return false
	}
	if _, err := fmt.Sscanf(values[3], "%d", &expires); err != nil || time.Now().Unix() > expires {
		return false
	}
	return true
}

func fingerprintHash(visitorID, fingerprint string) string {
	sum := sha256.Sum256([]byte(visitorID + "|" + fingerprint))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
