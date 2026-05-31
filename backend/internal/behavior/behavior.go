package behavior

import (
	"context"
	"log/slog"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
)

// Engine implements the behavioural analysis domain (Phase X precursor).
type Engine struct{}

func NewEngine() *Engine { return &Engine{} }

// Analyze records session-level behavioural signals on the blackboard.
func (e *Engine) Analyze(ctx context.Context, session *models.SessionState, topo *models.Topology, findings []models.Finding) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	session.SetPhase("behavioural")

	bySeverity := map[string]int{}
	for _, f := range findings {
		bySeverity[f.Severity]++
	}

	session.Behaviour["finding_counts"] = bySeverity
	session.Behaviour["host_count"] = len(topo.Hosts())
	session.Behaviour["edge_count"] = len(topo.Edges)

	if len(findings) == 0 {
		session.Behaviour["risk_posture"] = "minimal"
	} else if bySeverity["high"] > 0 {
		session.Behaviour["risk_posture"] = "elevated"
	} else {
		session.Behaviour["risk_posture"] = "moderate"
	}

	slog.Info("behavioural analysis complete", "posture", session.Behaviour["risk_posture"])
	return nil
}

// PhaseX stub for advanced behavioural engine (requires policy + root tooling).
func PhaseX(ctx context.Context, session *models.SessionState, topo *models.Topology) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	session.SetPhase("phase_x")
	session.Blackboard["phase_x"] = map[string]interface{}{
		"status": "stub",
		"note":   "Phase X behavioural engine requires external tooling and authorization",
	}
	slog.Info("phase_x stub complete")
	return nil
}
