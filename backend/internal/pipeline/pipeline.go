package pipeline

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/audit"
	"github.com/bahaaaljuboori/ewnaf/internal/behavior"
	"github.com/bahaaaljuboori/ewnaf/internal/bootstrap"
	"github.com/bahaaaljuboori/ewnaf/internal/exploration"
	"github.com/bahaaaljuboori/ewnaf/internal/export"
	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/probe"
	"github.com/bahaaaljuboori/ewnaf/internal/scanner"
	"github.com/bahaaaljuboori/ewnaf/internal/scoring"
	"github.com/bahaaaljuboori/ewnaf/internal/topology"
)

// Runner orchestrates the documented EWNAF pipeline order.
type Runner struct {
	cfg models.Config
}

func New(cfg models.Config) *Runner {
	return &Runner{cfg: cfg}
}

// Execute runs: bootstrap → preflight → probe_topology → discover → audits →
// freeze_context → exploration → phase_x → scanners → scoring → export.
func (r *Runner) Execute(ctx context.Context) (*models.ScanResult, map[string]string, error) {
	started := time.Now().UTC()

	boot, err := bootstrap.Run(ctx, r.cfg)
	if err != nil {
		return nil, nil, fmt.Errorf("bootstrap: %w", err)
	}

	if err := bootstrap.Preflight(ctx, boot); err != nil {
		return nil, nil, fmt.Errorf("preflight: %w", err)
	}

	if r.cfg.DryRun {
		slog.Info("dry-run: stopping after preflight")
		return &models.ScanResult{
			Version:   models.Version,
			Client:    r.cfg.Client,
			Mode:      r.cfg.Mode,
			Security:  r.cfg.Security,
			StartedAt: started,
			EndedAt:   time.Now().UTC(),
			Topology:  boot.Topo,
		}, nil, nil
	}

	if err := probe.Topology(ctx, boot.Topo, boot.Policy, boot.Session); err != nil {
		return nil, nil, fmt.Errorf("probe_topology: %w", err)
	}

	if err := topology.Discover(ctx, boot.Topo, boot.Session); err != nil {
		return nil, nil, fmt.Errorf("discover: %w", err)
	}

	findings, err := audit.RunAll(ctx, boot.Topo, boot.Session, audit.DefaultRegistry())
	if err != nil {
		return nil, nil, fmt.Errorf("audits: %w", err)
	}

	if err := freezeContext(boot); err != nil {
		return nil, nil, fmt.Errorf("freeze_context: %w", err)
	}

	if err := exploration.Run(ctx, boot.Topo, boot.Policy, boot.Session); err != nil {
		return nil, nil, fmt.Errorf("exploration: %w", err)
	}

	if err := behavior.PhaseX(ctx, boot.Session, boot.Topo); err != nil {
		return nil, nil, fmt.Errorf("phase_x: %w", err)
	}

	beh := behavior.NewEngine()
	if err := beh.Analyze(ctx, boot.Session, boot.Topo, findings); err != nil {
		return nil, nil, fmt.Errorf("behavioural: %w", err)
	}

	scanRunner := scanner.NewRunner(boot.Policy, r.cfg.Jobs)
	for _, phase := range []scanner.Phase{scanner.PhaseRecon, scanner.PhaseValidate, scanner.PhaseExploit} {
		if err := scanRunner.RunPipeline(ctx, phase, boot.Topo, boot.Session); err != nil {
			return nil, nil, fmt.Errorf("scanners: %w", err)
		}
		scanner.StubResult(boot.Session, phase)
	}

	score := scoring.Compute(boot.Topo, findings)
	boot.Session.SetPhase("scoring")

	result := &models.ScanResult{
		Version:   models.Version,
		Client:    r.cfg.Client,
		Mode:      r.cfg.Mode,
		Security:  r.cfg.Security,
		StartedAt: started,
		EndedAt:   time.Now().UTC(),
		Topology:  boot.Topo,
		Findings:  findings,
		Score:     score,
	}

	boot.Session.SetPhase("export")
	exp := export.NewExporter(r.cfg.Output)
	paths, err := exp.All(result)
	if err != nil {
		return nil, nil, fmt.Errorf("export: %w", err)
	}

	slog.Info("pipeline complete",
		"findings", len(findings),
		"overall_score", score.Overall,
		"reports", paths,
	)
	return result, paths, nil
}

func freezeContext(boot *bootstrap.Result) error {
	boot.Session.Freeze()
	boot.Policy.EnforceFreeze()
	boot.Session.SetPhase("freeze_context")
	slog.Info("context frozen; policy immutable")
	return nil
}
