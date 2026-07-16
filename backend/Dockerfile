FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /kokusei-api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /import-population ./cmd/import-population
RUN CGO_ENABLED=0 GOOS=linux go build -o /import-births ./cmd/import-births
RUN CGO_ENABLED=0 GOOS=linux go build -o /import-unemployment ./cmd/import-unemployment
RUN CGO_ENABLED=0 GOOS=linux go build -o /smoke-test ./cmd/smoke-test

FROM alpine:3.21
RUN apk add --no-cache ca-certificates \
    && adduser -D -u 10001 appuser
USER appuser
COPY --from=build /kokusei-api /kokusei-api
COPY --from=build /import-population /import-population
COPY --from=build /import-births /import-births
COPY --from=build /import-unemployment /import-unemployment
COPY --from=build /smoke-test /smoke-test
EXPOSE 8080
ENTRYPOINT ["/kokusei-api"]
