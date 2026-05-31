package exploration

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/policy"
	"github.com/bahaaaljuboori/ewnaf/internal/probe"
)

// Run performs post-freeze exploration allowed by policy (HTTP probes via stdlib).
func Run(ctx context.Context, topo *models.Topology, eng *policy.Engine, session *models.SessionState) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !session.IsFrozen() {
		slog.Warn("exploration running before freeze_context; continuing in dev mode")
	}
	session.SetPhase("exploration")

	entry, err := eng.AllowTool(models.ToolHTTPX)
	if err != nil {
		slog.Info("exploration skipped", "reason", err.Error())
		return nil
	}
	_ = entry

	client := &http.Client{Timeout: 5 * time.Second}
	commonPorts := []int{80, 443, 8080, 8443}

	for _, h := range topo.Hosts() {
		if err := ctx.Err(); err != nil {
			return err
		}
		ports := probe.ValidateReachability(ctx, h, commonPorts)
		if len(ports) == 0 {
			continue
		}
		h.Ports = append(h.Ports, ports...)
		for _, p := range ports {
			if p.Number != 80 && p.Number != 443 && p.Number != 8080 && p.Number != 8443 {
				continue
			}
			scheme := "http"
			if p.Number == 443 || p.Number == 8443 {
				scheme = "https"
			}
			url := scheme + "://" + h.IP.String()
			req, err := http.NewRequestWithContext(ctx, http.MethodHead, url, nil)
			if err != nil {
				continue
			}
			resp, err := client.Do(req)
			if err != nil {
				continue
			}
			_ = resp.Body.Close()
			session.Blackboard["http_probe_"+h.Key] = resp.StatusCode
		}
		topo.UpsertHost(h)
	}

	slog.Info("exploration complete")
	return nil
}
