package validate

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/policy"
)

var (
	clientPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`)
)

// Config validates CLI configuration per EWNAF input validators.
func Config(cfg models.Config) error {
	if err := Client(cfg.Client); err != nil {
		return err
	}
	if err := OutputDir(cfg.Output); err != nil {
		return err
	}
	if err := Subnets(cfg.Subnets); err != nil {
		return err
	}
	if err := policy.ValidateModeSecurity(cfg.Mode, cfg.Security); err != nil {
		return err
	}
	if cfg.Jobs < 1 || cfg.Jobs > 256 {
		return fmt.Errorf("jobs must be between 1 and 256, got %d", cfg.Jobs)
	}
	if cfg.Timeout <= 0 {
		return fmt.Errorf("timeout must be positive")
	}
	return nil
}

// Client validates the client identifier used in reports.
func Client(client string) error {
	client = strings.TrimSpace(client)
	if client == "" {
		return fmt.Errorf("client name is required")
	}
	if len(client) > 64 {
		return fmt.Errorf("client name exceeds 64 characters")
	}
	if !clientPattern.MatchString(client) {
		return fmt.Errorf("client name contains invalid characters")
	}
	return nil
}

// OutputDir ensures the output path is usable.
func OutputDir(path string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		return fmt.Errorf("output directory is required")
	}
	if strings.Contains(path, "\x00") {
		return fmt.Errorf("output path contains null byte")
	}
	clean := filepath.Clean(path)
	if clean == "." || clean == string(filepath.Separator) {
		return fmt.Errorf("output directory must not be filesystem root")
	}
	info, err := os.Stat(clean)
	if err != nil {
		if os.IsNotExist(err) {
			if mkErr := os.MkdirAll(clean, 0o755); mkErr != nil {
				return fmt.Errorf("create output directory: %w", mkErr)
			}
			return nil
		}
		return fmt.Errorf("stat output directory: %w", err)
	}
	if !info.IsDir() {
		return fmt.Errorf("output path is not a directory: %s", clean)
	}
	return nil
}

// Subnets validates CIDR or IP list (at least one target required).
func Subnets(subnets []string) error {
	if len(subnets) == 0 {
		return fmt.Errorf("at least one subnet or IP is required")
	}
	for _, s := range subnets {
		s = strings.TrimSpace(s)
		if s == "" {
			return fmt.Errorf("empty subnet entry")
		}
		if strings.Contains(s, "/") {
			_, _, err := net.ParseCIDR(s)
			if err != nil {
				return fmt.Errorf("invalid CIDR %q: %w", s, err)
			}
			continue
		}
		if ip := net.ParseIP(s); ip == nil {
			return fmt.Errorf("invalid IP or CIDR: %q", s)
		}
	}
	return nil
}

// Mode parses and validates scan mode string.
func Mode(raw string) (models.ScanMode, error) {
	m := models.ScanMode(strings.ToLower(strings.TrimSpace(raw)))
	switch m {
	case models.ModePassive, models.ModeStandard, models.ModeDeep:
		return m, nil
	default:
		return "", fmt.Errorf("unknown mode %q (expected passive|standard|deep)", raw)
	}
}

// Security parses and validates security level string.
func Security(raw string) (models.SecurityLevel, error) {
	s := models.SecurityLevel(strings.ToUpper(strings.TrimSpace(raw)))
	switch s {
	case models.SecurityStrict, models.SecurityRelaxed, models.SecurityOffensive:
		return s, nil
	default:
		return "", fmt.Errorf("unknown security level %q (expected STRICT|RELAXED|OFFENSIVE)", raw)
	}
}
