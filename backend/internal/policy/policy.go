package policy

import (
	"errors"
	"fmt"
	"sync"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
)

var (
	ErrPolicyFrozen     = errors.New("policy configuration is frozen and cannot be modified")
	ErrToolBlocked      = errors.New("tool blocked by policy matrix")
	ErrHardBlock        = errors.New("operation hard-blocked by security policy")
	ErrInvalidMode      = errors.New("invalid scan mode")
	ErrInvalidSecurity  = errors.New("invalid security level")
	ErrOffensivePassive = errors.New("OFFENSIVE security level incompatible with passive mode")
)

// MatrixEntry describes whether a tool is allowed under a mode/security pair.
type MatrixEntry struct {
	Allowed    bool
	RequiresRoot bool
	Notes      string
}

// Engine enforces MODE × SECURITY_LEVEL gating and freeze semantics.
type Engine struct {
	mu      sync.RWMutex
	mode    models.ScanMode
	security models.SecurityLevel
	frozen  bool
	matrix  map[models.ScanMode]map[models.SecurityLevel]map[models.Tool]MatrixEntry
	hardBlocks map[string]bool
}

// NewEngine builds the default enterprise policy matrix from EWNAF v38.1 docs.
func NewEngine(mode models.ScanMode, security models.SecurityLevel) (*Engine, error) {
	if err := ValidateModeSecurity(mode, security); err != nil {
		return nil, err
	}
	e := &Engine{
		mode:     mode,
		security: security,
		matrix:   defaultMatrix(),
		hardBlocks: defaultHardBlocks(mode, security),
	}
	return e, nil
}

func defaultHardBlocks(mode models.ScanMode, security models.SecurityLevel) map[string]bool {
	blocks := map[string]bool{
		"syn_flood":       true,
		"raw_socket_scan": mode == models.ModePassive,
		"arp_spoof":       security != models.SecurityOffensive,
		"credential_spray": security == models.SecurityStrict,
	}
	if security == models.SecurityStrict {
		blocks["active_udp_scan"] = mode == models.ModePassive
	}
	return blocks
}

func defaultMatrix() map[models.ScanMode]map[models.SecurityLevel]map[models.Tool]MatrixEntry {
	allow := func(root bool, notes string) MatrixEntry {
		return MatrixEntry{Allowed: true, RequiresRoot: root, Notes: notes}
	}
	deny := func(notes string) MatrixEntry {
		return MatrixEntry{Allowed: false, Notes: notes}
	}

	m := make(map[models.ScanMode]map[models.SecurityLevel]map[models.Tool]MatrixEntry)

	for _, mode := range []models.ScanMode{models.ModePassive, models.ModeStandard, models.ModeDeep} {
		m[mode] = make(map[models.SecurityLevel]map[models.Tool]MatrixEntry)
		for _, sec := range []models.SecurityLevel{models.SecurityStrict, models.SecurityRelaxed, models.SecurityOffensive} {
			tools := map[models.Tool]MatrixEntry{
				models.ToolP0f:        allow(false, "passive fingerprinting"),
				models.ToolGhostProbe: allow(false, "lightweight HTTP probe"),
				models.ToolHTTPX:      allow(false, "HTTP service validation"),
				models.ToolNaabu:      allow(true, "port discovery"),
				models.ToolNuclei:     allow(false, "template scanning"),
				models.ToolKatana:     allow(false, "web crawling"),
				models.ToolPhaseX:     allow(true, "phase-x behavioural engine"),
			}

			switch mode {
			case models.ModePassive:
				tools[models.ToolNaabu] = deny("passive mode blocks active port scan")
				tools[models.ToolNuclei] = deny("passive mode blocks nuclei")
				tools[models.ToolKatana] = deny("passive mode blocks katana")
				tools[models.ToolPhaseX] = deny("passive mode blocks phase-x")
				if sec == models.SecurityStrict {
					tools[models.ToolGhostProbe] = deny("strict passive allows only p0f")
					tools[models.ToolHTTPX] = deny("strict passive allows only p0f")
				}
			case models.ModeStandard:
				if sec == models.SecurityStrict {
					tools[models.ToolKatana] = deny("strict standard limits crawling")
					tools[models.ToolPhaseX] = deny("strict standard limits phase-x")
				}
			case models.ModeDeep:
				// all tools potentially allowed; offensive unlocks phase-x aggressively
			}

			if sec == models.SecurityOffensive && mode != models.ModePassive {
				tools[models.ToolPhaseX] = allow(true, "offensive deep integration")
			}
			if sec == models.SecurityStrict && mode == models.ModeDeep {
				tools[models.ToolPhaseX] = deny("strict caps phase-x even in deep mode")
			}

			m[mode][sec] = tools
		}
	}
	return m
}

// ValidateModeSecurity checks mode/security compatibility.
func ValidateModeSecurity(mode models.ScanMode, security models.SecurityLevel) error {
	switch mode {
	case models.ModePassive, models.ModeStandard, models.ModeDeep:
	default:
		return fmt.Errorf("%w: %q", ErrInvalidMode, mode)
	}
	switch security {
	case models.SecurityStrict, models.SecurityRelaxed, models.SecurityOffensive:
	default:
		return fmt.Errorf("%w: %q", ErrInvalidSecurity, security)
	}
	if mode == models.ModePassive && security == models.SecurityOffensive {
		return ErrOffensivePassive
	}
	return nil
}

// Mode returns the active scan mode.
func (e *Engine) Mode() models.ScanMode { return e.mode }

// Security returns the active security level.
func (e *Engine) Security() models.SecurityLevel { return e.security }

// Frozen reports whether policy mutations are blocked.
func (e *Engine) Frozen() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.frozen
}

// EnforceFreeze marks policy immutable for the remainder of the pipeline.
func (e *Engine) EnforceFreeze() {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.frozen = true
}

// AllowTool returns whether the given tool may run under current policy.
func (e *Engine) AllowTool(tool models.Tool) (MatrixEntry, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	modeMap, ok := e.matrix[e.mode]
	if !ok {
		return MatrixEntry{}, ErrToolBlocked
	}
	secMap, ok := modeMap[e.security]
	if !ok {
		return MatrixEntry{}, ErrToolBlocked
	}
	entry, ok := secMap[tool]
	if !ok || !entry.Allowed {
		return entry, fmt.Errorf("%w: %s", ErrToolBlocked, tool)
	}
	return entry, nil
}

// CheckHardBlock returns an error if the operation is hard-blocked.
func (e *Engine) CheckHardBlock(op string) error {
	e.mu.RLock()
	defer e.mu.RUnlock()
	if e.hardBlocks[op] {
		return fmt.Errorf("%w: %s", ErrHardBlock, op)
	}
	return nil
}

// SetSecurityLevel updates security before freeze (used during bootstrap).
func (e *Engine) SetSecurityLevel(security models.SecurityLevel) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.frozen {
		return ErrPolicyFrozen
	}
	if err := ValidateModeSecurity(e.mode, security); err != nil {
		return err
	}
	e.security = security
	e.hardBlocks = defaultHardBlocks(e.mode, security)
	return nil
}

// TrafficPolicy derives outbound traffic constraints from mode/security.
func (e *Engine) TrafficPolicy(subnets []string) models.TrafficPolicy {
	e.mu.RLock()
	defer e.mu.RUnlock()

	tp := models.TrafficPolicy{
		AllowedSubnets: append([]string(nil), subnets...),
		MaxPacketsPerS: 100,
	}
	switch e.mode {
	case models.ModePassive:
		tp.AllowICMP = true
		tp.AllowSYN = false
		tp.AllowUDP = false
		tp.MaxPacketsPerS = 20
	case models.ModeStandard:
		tp.AllowICMP = true
		tp.AllowSYN = true
		tp.AllowUDP = true
		tp.MaxPacketsPerS = 200
	case models.ModeDeep:
		tp.AllowICMP = true
		tp.AllowSYN = true
		tp.AllowUDP = true
		tp.MaxPacketsPerS = 500
	}
	switch e.security {
	case models.SecurityStrict:
		tp.RequireAuthZone = true
		tp.MaxPacketsPerS = min(tp.MaxPacketsPerS, 100)
	case models.SecurityOffensive:
		tp.RequireAuthZone = false
	}
	return tp
}

// AllowedTools lists tools permitted under current policy.
func (e *Engine) AllowedTools() []models.Tool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	var out []models.Tool
	secMap := e.matrix[e.mode][e.security]
	for tool, entry := range secMap {
		if entry.Allowed {
			out = append(out, tool)
		}
	}
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
