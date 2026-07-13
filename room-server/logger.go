package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type appLogger struct {
	logger *log.Logger
	file   *rotatingLogWriter
}

func newAppLogger(config Config) (*appLogger, error) {
	writer, err := newRotatingLogWriter(config.LogFile, config.LogMaxBytes, config.LogBackups)
	if err != nil {
		return nil, err
	}
	return &appLogger{
		logger: log.New(io.MultiWriter(os.Stdout, writer), "", log.Ldate|log.Ltime|log.Lmicroseconds|log.LUTC),
		file:   writer,
	}, nil
}

func (l *appLogger) Printf(format string, values ...interface{}) {
	if l != nil && l.logger != nil {
		l.logger.Printf(format, values...)
	}
}

func (l *appLogger) Close() error {
	if l == nil || l.file == nil {
		return nil
	}
	return l.file.Close()
}

type rotatingLogWriter struct {
	mu       sync.Mutex
	path     string
	maxBytes int64
	backups  int
	file     *os.File
	size     int64
}

func newRotatingLogWriter(path string, maxBytes int64, backups int) (*rotatingLogWriter, error) {
	if strings.TrimSpace(path) == "" {
		return nil, errors.New("ROOM_LOG_FILE 不能为空")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, fmt.Errorf("创建日志目录失败: %w", err)
	}
	writer := &rotatingLogWriter{path: path, maxBytes: maxBytes, backups: backups}
	if err := writer.open(); err != nil {
		return nil, err
	}
	return writer, nil
}

func (w *rotatingLogWriter) open() error {
	file, err := os.OpenFile(w.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %w", err)
	}
	stat, err := file.Stat()
	if err != nil {
		_ = file.Close()
		return err
	}
	w.file = file
	w.size = stat.Size()
	return nil
}

func (w *rotatingLogWriter) Write(data []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return 0, os.ErrClosed
	}
	if w.maxBytes > 0 && w.size > 0 && w.size+int64(len(data)) > w.maxBytes {
		if err := w.rotate(); err != nil {
			return 0, err
		}
	}
	written, err := w.file.Write(data)
	w.size += int64(written)
	return written, err
}

func (w *rotatingLogWriter) rotate() error {
	if err := w.file.Close(); err != nil {
		return err
	}
	w.file = nil
	if w.backups > 0 {
		_ = os.Remove(fmt.Sprintf("%s.%d", w.path, w.backups))
		for index := w.backups - 1; index >= 1; index-- {
			from := fmt.Sprintf("%s.%d", w.path, index)
			to := fmt.Sprintf("%s.%d", w.path, index+1)
			_ = os.Remove(to)
			if err := os.Rename(from, to); err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
		}
		_ = os.Remove(w.path + ".1")
		if err := os.Rename(w.path, w.path+".1"); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	} else {
		_ = os.Remove(w.path)
	}
	w.size = 0
	return w.open()
}

func (w *rotatingLogWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return nil
	}
	err := w.file.Close()
	w.file = nil
	return err
}

func readLogTail(path string, maxBytes int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}
	start := int64(0)
	if maxBytes > 0 && stat.Size() > maxBytes {
		start = stat.Size() - maxBytes
	}
	readStart := start
	if readStart > 0 {
		readStart--
	}
	if _, err := file.Seek(readStart, io.SeekStart); err != nil {
		return nil, err
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, err
	}
	if start > 0 {
		if len(data) > 0 && data[0] == '\n' {
			data = data[1:]
		} else if newline := strings.IndexByte(string(data), '\n'); newline >= 0 {
			data = data[newline+1:]
		}
	}
	return data, nil
}

type requestContextKey string

const requestIDKey requestContextKey = "request-id"

type loggingResponseWriter struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (w *loggingResponseWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *loggingResponseWriter) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	written, err := w.ResponseWriter.Write(data)
	w.bytes += written
	return written, err
}

func (w *loggingResponseWriter) Flush() {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *loggingResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("response writer does not support hijacking")
	}
	if w.status == 0 {
		w.status = http.StatusSwitchingProtocols
	}
	return hijacker.Hijack()
}

func (w *loggingResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

func (s *server) requestLogger(next http.Handler) http.Handler {
	if s.logger == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		requestID := randomID(6)
		r = r.WithContext(context.WithValue(r.Context(), requestIDKey, requestID))
		writer := &loggingResponseWriter{ResponseWriter: w}
		next.ServeHTTP(writer, r)
		status := writer.status
		if status == 0 {
			status = http.StatusOK
		}
		s.logger.Printf(
			"http request_id=%s method=%s path=%q status=%d bytes=%d duration_ms=%d host=%q remote=%q forwarded_for=%q real_ip=%q cf_connecting_ip=%q proto=%q tls=%t forwarded_proto=%q upgrade=%q connection=%q websocket_version=%q websocket_protocol=%q origin=%q cf_ray=%q user_agent=%q",
			requestID, r.Method, r.URL.Path, status, writer.bytes, time.Since(startedAt).Milliseconds(),
			cleanLogValue(r.Host, 240), cleanLogValue(r.RemoteAddr, 160), cleanLogValue(r.Header.Get("X-Forwarded-For"), 240),
			cleanLogValue(r.Header.Get("X-Real-IP"), 100), cleanLogValue(r.Header.Get("CF-Connecting-IP"), 100), r.Proto, r.TLS != nil,
			cleanLogValue(r.Header.Get("X-Forwarded-Proto"), 32), cleanLogValue(r.Header.Get("Upgrade"), 32),
			cleanLogValue(r.Header.Get("Connection"), 80), cleanLogValue(r.Header.Get("Sec-WebSocket-Version"), 32),
			cleanLogValue(r.Header.Get("Sec-WebSocket-Protocol"), 160), cleanLogValue(r.Header.Get("Origin"), 240),
			cleanLogValue(r.Header.Get("CF-Ray"), 100), cleanLogValue(r.UserAgent(), 300),
		)
	})
}

func requestIDFrom(r *http.Request) string {
	requestID, _ := r.Context().Value(requestIDKey).(string)
	return requestID
}

func cleanLogValue(value string, maxLength int) string {
	value = strings.NewReplacer("\r", " ", "\n", " ").Replace(strings.TrimSpace(value))
	if maxLength > 0 && len(value) > maxLength {
		return value[:maxLength] + "..."
	}
	return value
}

func logError(err error) string {
	if err == nil {
		return ""
	}
	return cleanLogValue(err.Error(), 500)
}
