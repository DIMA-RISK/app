package scanner

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/policy"
)

// Phase represents the three governed scanner integration phases from EWNAF docs.
type Phase int

const (
	PhaseRecon Phase = iota + 1
	PhaseValidate
	PhaseExploit // template/exposure validation, not exploitation
)

// Runner executes external tools when policy permits.
type Runner struct {
	policy *policy.Engine
	jobs   int
}

func NewRunner(eng *policy.Engine, jobs int) *Runner {
	return &Runner{policy: eng, jobs: jobs}
}

// RunPipeline executes allowed scanner tools in governed order.
func (r *Runner) RunPipeline(ctx context.Context, phase Phase, topo *models.Topology, session *models.SessionState) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	session.SetPhase(fmt.Sprintf("scanners_phase_%d", phase))

	tools := r.toolsForPhase(phase)
	for _, tool := range tools {
		entry, err := r.policy.AllowTool(tool)
		if err != nil {
			slog.Info("scanner skipped by policy", "tool", tool, "reason", err)
			continue
		}
		if err := r.invoke(ctx, tool, entry, topo); err != nil {
			slog.Warn("scanner invocation failed", "tool", tool, "error", err)
		}
	}
	return nil
}

func (r *Runner) toolsForPhase(phase Phase) []models.Tool {
	switch phase {
	case PhaseRecon:
		return []models.Tool{models.ToolNaabu, models.ToolP0f, models.ToolGhostProbe}
	case PhaseValidate:
		return []models.Tool{models.ToolHTTPX, models.ToolNuclei}
	case PhaseExploit:
		return []models.Tool{models.ToolKatana, models.ToolPhaseX}
	default:
		return nil
	}
}

func (r *Runner) invoke(ctx context.Context, tool models.Tool, entry policy.MatrixEntry, topo *models.Topology) error {
	if _, err := exec.LookPath(string(tool)); err != nil {
		slog.Info("external tool not installed", "tool", tool)
		return nil
	}
	if entry.RequiresRoot {
		slog.Info("tool requires elevated privileges; skipping in unprivileged Go port", "tool", tool)
		return nil
	}

	targets := make([]string, 0, len(topo.Hosts()))
	for _, h := range topo.Hosts() {
		targets = append(targets, h.Key)
	}
	if len(targets) == 0 {
		return nil
	}

	args := r.buildArgs(tool, targets)
	cmd := exec.CommandContext(ctx, string(tool), args...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s: %w: %s", tool, err, strings.TrimSpace(string(out)))
	}
	slog.Info("scanner completed", "tool", tool, "bytes", len(out))
	return nil
}

func (r *Runner) buildArgs(tool models.Tool, targets []string) []string {
	switch tool {
	case models.ToolHTTPX:
		return append([]string{"-silent", "-status-code"}, targets...)
	case models.ToolNaabu:
		return []string{"-host", strings.Join(targets, ","), "-silent"}
	default:
		return targets
	}
}

// AvailableTools returns which configured tools exist on PATH and are policy-allowed.
func (r *Runner) AvailableTools(ctx context.Context) []models.Tool {
	_ = ctx
	var out []models.Tool
	for _, t := range []models.Tool{
		models.ToolNaabu, models.ToolHTTPX, models.ToolNuclei,
		models.ToolKatana, models.ToolGhostProbe, models.ToolP0f, models.ToolPhaseX,
	} {
		if _, err := r.policy.AllowTool(t); err != nil {
			continue
		}
		if _, err := exec.LookPath(string(t)); err == nil {
			out = append(out, t)
		}
	}
	return out
}

// StubResult records scanner phase metadata when tools are unavailable.
func StubResult(session *models.SessionState, phase Phase) {
	session.Blackboard[fmt.Sprintf("scanner_phase_%d", phase)] = map[string]interface{}{
		"completed_at": time.Now().UTC(),
		"status":       "governed_stub",
	}
}
