package snapshot

import (
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"

	"github.com/Azure/azure-sdk-for-go/sdk/azidentity"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

type BlobSource struct {
	client    *azblob.Client
	container string
}

var (
	storageAccountPattern = regexp.MustCompile(`^[a-z0-9]{3,24}$`)
	containerPattern      = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$`)
)

func NewBlobSource(accountName, container string) (*BlobSource, error) {
	if !storageAccountPattern.MatchString(accountName) || !containerPattern.MatchString(container) {
		return nil, errors.New("storage account or container name is invalid")
	}
	credential, err := azidentity.NewDefaultAzureCredential(nil)
	if err != nil {
		return nil, fmt.Errorf("create Azure credential: %w", err)
	}
	client, err := azblob.NewClient("https://"+accountName+".blob.core.windows.net/", credential, nil)
	if err != nil {
		return nil, fmt.Errorf("create Blob client: %w", err)
	}
	return &BlobSource{client: client, container: container}, nil
}

func (s *BlobSource) Read(ctx context.Context, name string, limit int64) ([]byte, error) {
	response, err := s.client.DownloadStream(ctx, s.container, name, nil)
	if err != nil {
		return nil, fmt.Errorf("download blob %q: %w", name, err)
	}
	defer response.Body.Close()
	content, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("read blob %q: %w", name, err)
	}
	if int64(len(content)) > limit {
		return nil, errors.New("blob exceeds size limit")
	}
	return content, nil
}
