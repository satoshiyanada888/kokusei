package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/kokusei/dashboard/backend/internal/provider"
	"github.com/kokusei/dashboard/backend/internal/snapshot"
)

func main() {
	var output string
	var commitSHA string
	var generatedAt string
	var previousPath string
	flag.StringVar(&output, "output", "", "path for dataset.json")
	flag.StringVar(&commitSHA, "commit-sha", "", "full 40-character source commit SHA")
	flag.StringVar(&generatedAt, "generated-at", "", "optional UTC RFC3339 generation time")
	flag.StringVar(&previousPath, "previous", "", "optional path to the previously published dataset.json")
	flag.Parse()
	if output == "" {
		log.Fatal("--output is required")
	}
	generationTime := time.Now().UTC().Truncate(time.Second)
	if generatedAt != "" {
		parsed, err := time.Parse(time.RFC3339, generatedAt)
		if err != nil {
			log.Fatal("--generated-at must be RFC3339")
		}
		generationTime = parsed.UTC()
	}
	client := &http.Client{Timeout: 45 * time.Second}
	dataset, err := snapshot.Build(
		context.Background(), commitSHA, generationTime,
		provider.NewEStatPopulationProvider(client, os.Getenv("ESTAT_POPULATION_STAT_INF_ID"), os.Getenv("ESTAT_POPULATION_PUBLISHED_AT")),
		provider.NewEStatBirthsProvider(client, os.Getenv("ESTAT_APP_ID")),
		provider.NewStatisticsUnemploymentProvider(client),
	)
	if err != nil {
		log.Fatal(err)
	}
	var previous *snapshot.Dataset
	if previousPath != "" {
		content, err := os.ReadFile(previousPath)
		if err != nil {
			log.Fatal(err)
		}
		var decoded snapshot.Dataset
		if err := json.Unmarshal(content, &decoded); err != nil {
			log.Fatal(err)
		}
		previous = &decoded
	}
	dataset, err = snapshot.MergeRevisionHistory(dataset, previous)
	if err != nil {
		log.Fatal(err)
	}
	content, err := snapshot.Marshal(dataset)
	if err != nil {
		log.Fatal(err)
	}
	if err := writeAtomic(output, append(content, '\n')); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("snapshot generated: indicators=%d schema=%d sha256=%s\n", len(dataset.Indicators), dataset.SchemaVersion, snapshot.Digest(append(content, '\n')))
}

func writeAtomic(path string, content []byte) error {
	directory := filepath.Dir(path)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return err
	}
	file, err := os.CreateTemp(directory, ".dataset-*.json")
	if err != nil {
		return err
	}
	temporaryPath := file.Name()
	defer os.Remove(temporaryPath)
	if err := file.Chmod(0o600); err != nil {
		file.Close()
		return err
	}
	if _, err := file.Write(content); err != nil {
		file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(temporaryPath, path)
}
