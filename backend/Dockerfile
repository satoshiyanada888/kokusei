FROM golang:1.23-alpine AS build
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /kokusei-api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /import-population ./cmd/import-population

FROM alpine:3.21
RUN adduser -D -u 10001 appuser
USER appuser
COPY --from=build /kokusei-api /kokusei-api
COPY --from=build /import-population /import-population
EXPOSE 8080
ENTRYPOINT ["/kokusei-api"]
