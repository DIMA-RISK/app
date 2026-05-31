package validate_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/validate"
)

func TestClient(t *testing.T) {
	if err := validate.Client(""); err == nil {
		t.Fatal("empty client should fail")
	}
	if err := validate.Client("acme-corp"); err != nil {
		t.Fatalf("valid client rejected: %v", err)
	}
	if err := validate.Client("bad client!"); err == nil {
		t.Fatal("invalid chars should fail")
	}
}

func TestSubnets(t *testing.T) {
	if err := validate.Subnets(nil); err == nil {
		t.Fatal("empty subnets should fail")
	}
	if err := validate.Subnets([]string{"192.168.1.0/24", "10.0.0.1"}); err != nil {
		t.Fatalf("valid subnets rejected: %v", err)
	}
	if err := validate.Subnets([]string{"not-an-ip"}); err == nil {
		t.Fatal("invalid subnet should fail")
	}
}

func TestOutputDir(t *testing.T) {
	dir := t.TempDir()
	if err := validate.OutputDir(dir); err != nil {
		t.Fatalf("existing dir: %v", err)
	}
	newDir := filepath.Join(dir, "nested", "out")
	if err := validate.OutputDir(newDir); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	file := filepath.Join(dir, "file.txt")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := validate.OutputDir(file); err == nil {
		t.Fatal("file path should fail")
	}
}

func TestModeAndSecurity(t *testing.T) {
	m, err := validate.Mode("deep")
	if err != nil || m != models.ModeDeep {
		t.Fatalf("mode parse: %v %q", err, m)
	}
	if _, err := validate.Mode("aggressive"); err == nil {
		t.Fatal("unknown mode should fail")
	}
	s, err := validate.Security("relaxed")
	if err != nil || s != models.SecurityRelaxed {
		t.Fatalf("security parse: %v %q", err, s)
	}
}

func TestConfig(t *testing.T) {
	dir := t.TempDir()
	cfg := models.Config{
		Client:   "test-client",
		Output:   dir,
		Subnets:  []string{"127.0.0.1"},
		Mode:     models.ModePassive,
		Security: models.SecurityStrict,
		Jobs:     2,
		Timeout:  time.Minute,
	}
	if err := validate.Config(cfg); err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}
	cfg.Jobs = 0
	if err := validate.Config(cfg); err == nil {
		t.Fatal("invalid jobs should fail")
	}
}
