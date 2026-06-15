FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /bin/nms-bff ./cmd/api

FROM alpine:3.20

RUN adduser -D -H -u 10001 appuser
USER appuser

WORKDIR /app
COPY --from=builder /bin/nms-bff /usr/local/bin/nms-bff

EXPOSE 8080

CMD ["nms-bff"]
