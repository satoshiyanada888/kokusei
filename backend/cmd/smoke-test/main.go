package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"
)

func main() {
	baseURL := os.Getenv("TARGET_URL")
	if baseURL == "" {
		panic("TARGET_URL is required")
	}
	paths := []string{"/health", "/api/indicators", "/api/indicators/population", "/api/indicators/births", "/api/indicators/unemployment-rate"}
	client := &http.Client{Timeout: 10 * time.Second}
	for _, path := range paths {
		var lastErr error
		for attempt := 1; attempt <= 12; attempt++ {
			request, err := http.NewRequestWithContext(context.Background(), http.MethodGet, baseURL+path, nil)
			if err == nil {
				response, requestErr := client.Do(request)
				if requestErr == nil {
					_ = response.Body.Close()
					if response.StatusCode >= 200 && response.StatusCode < 300 {
						lastErr = nil
						break
					}
					requestErr = fmt.Errorf("status %d", response.StatusCode)
				}
				lastErr = requestErr
			} else {
				lastErr = err
			}
			time.Sleep(5 * time.Second)
		}
		if lastErr != nil {
			panic(fmt.Sprintf("smoke test failed for %s: %v", path, lastErr))
		}
	}
	fmt.Println("Backend smoke test succeeded")
}
