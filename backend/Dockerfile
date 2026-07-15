FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /kokusei-api ./cmd/api

FROM alpine:3.21
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /kokusei-api /kokusei-api
EXPOSE 8080
ENTRYPOINT ["/kokusei-api"]

