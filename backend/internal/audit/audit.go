package audit

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/probe"
)

// Module represents a pluggable audit domain from EWNAF docs.
type Module interface {
	Name() string
	Run(ctx context.Context, host models.Host) ([]models.Finding, error)
}

// Registry holds ordered audit modules.
type Registry struct {
	modules []Module
}

func NewRegistry(mods ...Module) *Registry {
	return &Registry{modules: mods}
}

func DefaultRegistry() *Registry {
	return NewRegistry(
		&BaselineModule{},
		&ExposureModule{},
	)
}

// RunAll executes audit modules for every host in topology.
func RunAll(ctx context.Context, topo *models.Topology, session *models.SessionState, reg *Registry) ([]models.Finding, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	session.SetPhase("audits")

	var all []models.Finding
	for _, h := range topo.Hosts() {
		if err := ctx.Err(); err != nil {
			return all, err
		}
		updated := h
		for _, mod := range reg.modules {
			findings, err := mod.Run(ctx, h)
			if err != nil {
				slog.Warn("audit module failed", "module", mod.Name(), "host", h.Key, "error", err)
				continue
			}
			all = append(all, findings...)
			updated.Findings = append(updated.Findings, findings...)
		}
		topo.UpsertHost(updated)
	}

	slog.Info("audits complete", "findings", len(all))
	return all, nil
}

// BaselineModule checks host metadata completeness.
type BaselineModule struct{}

func (m *BaselineModule) Name() string { return "baseline" }

func (m *BaselineModule) Run(ctx context.Context, host models.Host) ([]models.Finding, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	var findings []models.Finding
	if host.Hostname == "" {
		findings = append(findings, newFinding(host, "baseline", "info", "missing_reverse_dns",
			"No PTR record resolved for host", 0.6))
	}
	conf := probe.Confidence(host)
	if conf < 0.8 {
		findings = append(findings, newFinding(host, "baseline", "low", "low_probe_confidence",
			fmt.Sprintf("Probe confidence %.2f below threshold", conf), conf))
	}
	return findings, nil
}

// ExposureModule flags common exposure patterns from open ports (when present).
type ExposureModule struct{}

func (m *ExposureModule) Name() string { return "exposure" }

func (m *ExposureModule) Run(ctx context.Context, host models.Host) ([]models.Finding, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	var findings []models.Finding
	for _, p := range host.Ports {
		switch p.Number {
		case 23, 445, 3389:
			findings = append(findings, newFinding(host, "exposure", "high", "risky_service_exposed",
				fmt.Sprintf("Port %d/%s is open", p.Number, p.Protocol), 0.85))
		case 80, 443:
			findings = append(findings, newFinding(host, "exposure", "info", "web_service_detected",
				fmt.Sprintf("Web service on port %d", p.Number), 0.9))
		}
	}
	return findings, nil
}

func newFinding(host models.Host, cat, sev, title, desc string, conf float64) models.Finding {
	return models.Finding{
		ID:          fmt.Sprintf("%s-%s-%d", host.Key, cat, time.Now().UnixNano()),
		HostKey:     host.Key,
		Category:    cat,
		Severity:    sev,
		Title:       title,
		Description: desc,
		Source:      "ewnaf-audit",
		Confidence:  conf,
		Timestamp:   time.Now().UTC(),
	}
}
