package bootstrap

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/policy"
	"github.com/bahaaaljuboori/ewnaf/internal/validate"
)

// Result holds initialized runtime artifacts after bootstrap.
type Result struct {
	Config  models.Config
	Policy  *policy.Engine
	Session *models.SessionState
	Topo    *models.Topology
}

// Run performs EWNAF bootstrap: validate inputs, init policy, session, topology.
func Run(ctx context.Context, cfg models.Config) (*Result, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := validate.Config(cfg); err != nil {
		return nil, err
	}

	eng, err := policy.NewEngine(cfg.Mode, cfg.Security)
	if err != nil {
		return nil, err
	}

	session := models.NewSessionState(cfg.Client, cfg.Output, cfg.Mode, cfg.Security, cfg.Jobs)
	session.Traffic = eng.TrafficPolicy(cfg.Subnets)
	session.SetPhase("bootstrap")

	topo := models.NewTopology(cfg.Subnets)

	if err := ensureOutputLayout(cfg.Output); err != nil {
		return nil, err
	}

	slog.Info("bootstrap complete",
		"version", models.Version,
		"client", cfg.Client,
		"mode", cfg.Mode,
		"security", cfg.Security,
		"jobs", cfg.Jobs,
	)

	return &Result{
		Config:  cfg,
		Policy:  eng,
		Session: session,
		Topo:    topo,
	}, nil
}

func ensureOutputLayout(output string) error {
	dirs := []string{"reports", "logs", "artifacts", "sarif"}
	for _, d := range dirs {
		if err := os.MkdirAll(filepath.Join(output, d), 0o755); err != nil {
			return err
		}
	}
	return nil
}

// Preflight performs lightweight runtime checks before probing.
func Preflight(ctx context.Context, res *Result) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	res.Session.SetPhase("preflight")

	deadline, ok := ctx.Deadline()
	if ok && time.Until(deadline) <= 0 {
		return context.DeadlineExceeded
	}

	if len(res.Topo.Subnets) == 0 {
		return validate.Subnets(nil)
	}

	slog.Info("preflight passed", "subnets", len(res.Topo.Subnets))
	return nil
}
