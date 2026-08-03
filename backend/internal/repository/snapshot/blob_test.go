package snapshot

import "testing"

func TestNewBlobSourceRejectsUnsafeAccountAndContainerNamesBeforeCredentialLookup(t *testing.T) {
	for _, test := range []struct {
		account   string
		container string
	}{
		{account: "https://example.com", container: "official-data"},
		{account: "validaccount", container: "../other"},
		{account: "ValidAccount", container: "official-data"},
	} {
		if _, err := NewBlobSource(test.account, test.container); err == nil {
			t.Fatalf("unsafe Blob endpoint input was accepted: %#v", test)
		}
	}
}
