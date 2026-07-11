# syntax=docker/dockerfile:1

FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .

RUN CGO_ENABLED=0 go build \
  -trimpath \
  -ldflags="-s -w" \
  -o /out/room-server .

FROM alpine:3.21

RUN addgroup -S app && adduser -S -G app app \
  && mkdir -p /data \
  && chown -R app:app /data

COPY --from=build /out/room-server /usr/local/bin/room-server

ENV ROOM_ADDR=:8738 \
  ROOM_DATA_DIR=/data

EXPOSE 8738
VOLUME ["/data"]
USER app
ENTRYPOINT ["/usr/local/bin/room-server"]

# 宿主机执行命令解决无权限问题
# sudo chown -R 100:101 ./data
# sudo chmod -R u+rwX ./data