package models

import (
	"net"
	"sync"
	"time"
)

const Version = "38.1.0-ENTERPRISE-PRODUCTION"

// ScanMode defines how aggressively EWNAF probes the network.
type ScanMode string

const (
	ModePassive  ScanMode = "passive"
	ModeStandard ScanMode = "standard"
	ModeDeep     ScanMode = "deep"
)

// SecurityLevel controls offensive tooling and traffic policy.
type SecurityLevel string

const (
	SecurityStrict    SecurityLevel = "STRICT"
	SecurityRelaxed   SecurityLevel = "RELAXED"
	SecurityOffensive SecurityLevel = "OFFENSIVE"
)

// Tool identifies an external scanner or probe integrated by policy.
type Tool string

const (
	ToolNaabu      Tool = "naabu"
	ToolHTTPX      Tool = "httpx"
	ToolNuclei     Tool = "nuclei"
	ToolKatana     Tool = "katana"
	ToolGhostProbe Tool = "ghost_probe"
	ToolP0f        Tool = "p0f"
	ToolPhaseX     Tool = "phase_x"
)

// Finding represents a single audit or scanner observation.
type Finding struct {
	ID          string    `json:"id"`
	HostKey     string    `json:"host_key"`
	Category    string    `json:"category"`
	Severity    string    `json:"severity"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Evidence    string    `json:"evidence,omitempty"`
	Source      string    `json:"source"`
	Confidence  float64   `json:"confidence"`
	Timestamp   time.Time `json:"timestamp"`
}

// Port describes an open or filtered port on a host.
type Port struct {
	Number   int    `json:"number"`
	Protocol string `json:"protocol"`
	Service  string `json:"service,omitempty"`
	State    string `json:"state"`
}

// Host aggregates per-host audit state (mirrors bash associative arrays).
type Host struct {
	Key       string    `json:"key"`
	IP        net.IP    `json:"ip"`
	Hostname  string    `json:"hostname,omitempty"`
	MAC       string    `json:"mac,omitempty"`
	Ports     []Port    `json:"ports,omitempty"`
	Findings  []Finding `json:"findings,omitempty"`
	RiskScore float64   `json:"risk_score"`
	Tags      []string  `json:"tags,omitempty"`
}

// TrafficPolicy holds outbound traffic constraints for the session.
type TrafficPolicy struct {
	AllowICMP       bool     `json:"allow_icmp"`
	AllowSYN        bool     `json:"allow_syn"`
	AllowUDP        bool     `json:"allow_udp"`
	MaxPacketsPerS  int      `json:"max_packets_per_s"`
	AllowedSubnets  []string `json:"allowed_subnets"`
	BlockedSubnets  []string `json:"blocked_subnets"`
	RequireAuthZone bool     `json:"require_auth_zone"`
}

// TopologyEdge represents a discovered network relationship.
type TopologyEdge struct {
	From     string  `json:"from"`
	To       string  `json:"to"`
	Relation string  `json:"relation"`
	Weight   float64 `json:"weight"`
}

// Topology captures graph-like network structure (TOPO map in bash).
type Topology struct {
	mu      sync.RWMutex
	Nodes   map[string]Host        `json:"nodes"`
	Edges   []TopologyEdge         `json:"edges"`
	Gateway string                 `json:"gateway,omitempty"`
	DNS     []string               `json:"dns,omitempty"`
	Subnets []string               `json:"subnets"`
	Meta    map[string]interface{} `json:"meta,omitempty"`
}

func NewTopology(subnets []string) *Topology {
	return &Topology{
		Nodes:   make(map[string]Host),
		Edges:   nil,
		Subnets: append([]string(nil), subnets...),
		Meta:    make(map[string]interface{}),
	}
}

func (t *Topology) UpsertHost(h Host) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Nodes[h.Key] = h
}

func (t *Topology) GetHost(key string) (Host, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	h, ok := t.Nodes[key]
	return h, ok
}

func (t *Topology) AddEdge(e TopologyEdge) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Edges = append(t.Edges, e)
}

func (t *Topology) Hosts() []Host {
	t.mu.RLock()
	defer t.mu.RUnlock()
	out := make([]Host, 0, len(t.Nodes))
	for _, h := range t.Nodes {
		out = append(out, h)
	}
	return out
}

// SessionState tracks mutable pipeline context (SESSION_STATE in bash).
type SessionState struct {
	mu           sync.RWMutex
	Client       string                 `json:"client"`
	OutputDir    string                 `json:"output_dir"`
	Mode         ScanMode               `json:"mode"`
	Security     SecurityLevel          `json:"security_level"`
	Jobs         int                    `json:"jobs"`
	StartedAt    time.Time              `json:"started_at"`
	Frozen       bool                   `json:"frozen"`
	FrozenAt     *time.Time             `json:"frozen_at,omitempty"`
	Phase        string                 `json:"phase"`
	Traffic      TrafficPolicy          `json:"traffic_policy"`
	Behaviour    map[string]interface{} `json:"behaviour,omitempty"`
	Blackboard   map[string]interface{} `json:"blackboard,omitempty"`
	ProbeResults map[string]interface{} `json:"probe_results,omitempty"`
}

func NewSessionState(client, outputDir string, mode ScanMode, sec SecurityLevel, jobs int) *SessionState {
	return &SessionState{
		Client:       client,
		OutputDir:    outputDir,
		Mode:         mode,
		Security:     sec,
		Jobs:         jobs,
		StartedAt:    time.Now().UTC(),
		Phase:        "bootstrap",
		Behaviour:    make(map[string]interface{}),
		Blackboard:   make(map[string]interface{}),
		ProbeResults: make(map[string]interface{}),
	}
}

func (s *SessionState) Freeze() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.Frozen {
		return
	}
	now := time.Now().UTC()
	s.Frozen = true
	s.FrozenAt = &now
}

func (s *SessionState) IsFrozen() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.Frozen
}

func (s *SessionState) SetPhase(phase string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Phase = phase
}

// ScanResult is the final aggregate exported by the pipeline.
type ScanResult struct {
	Version   string        `json:"version"`
	Client    string        `json:"client"`
	Mode      ScanMode      `json:"mode"`
	Security  SecurityLevel `json:"security_level"`
	StartedAt time.Time     `json:"started_at"`
	EndedAt   time.Time     `json:"ended_at"`
	Topology  *Topology     `json:"topology"`
	Findings  []Finding     `json:"findings"`
	Score     ScoreReport   `json:"score"`
}

// ScoreReport summarizes risk scoring output.
type ScoreReport struct {
	Overall       float64            `json:"overall"`
	ByHost        map[string]float64 `json:"by_host"`
	ByCategory    map[string]float64 `json:"by_category"`
	HighRiskCount int                `json:"high_risk_count"`
}

// Config holds CLI-derived runtime configuration.
type Config struct {
	Client   string
	Output   string
	Subnets  []string
	Mode     ScanMode
	Security SecurityLevel
	Jobs     int
	Timeout  time.Duration
	DryRun   bool
	Verbose  bool
}
