FROM golang:1.26.3-alpine AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/hivegraph-telemetry .

FROM alpine:3.23
RUN addgroup -S hivegraph && adduser -S -G hivegraph hivegraph
COPY --from=builder /out/hivegraph-telemetry /usr/local/bin/hivegraph-telemetry
USER hivegraph
EXPOSE 9091 9090
ENTRYPOINT ["hivegraph-telemetry"]
