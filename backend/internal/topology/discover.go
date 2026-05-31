package topology

import (
	"context"
	"log/slog"
	"net"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
)

// Discover enriches topology with reverse DNS and local adjacency hints.
func Discover(ctx context.Context, topo *models.Topology, session *models.SessionState) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	session.SetPhase("discover")

	hosts := topo.Hosts()
	for _, h := range hosts {
		if err := ctx.Err(); err != nil {
			return err
		}
		enriched := enrichHost(ctx, h, topo.Gateway)
		topo.UpsertHost(enriched)
		if topo.Gateway != "" && enriched.Key != topo.Gateway {
			topo.AddEdge(models.TopologyEdge{
				From:     topo.Gateway,
				To:       enriched.Key,
				Relation: "routed_via",
				Weight:   0.5,
			})
		}
	}

	slog.Info("discovery complete", "nodes", len(topo.Hosts()), "edges", len(topo.Edges))
	return nil
}

func enrichHost(ctx context.Context, h models.Host, gateway string) models.Host {
	if h.IP == nil {
		return h
	}

	lookupCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	names, err := net.DefaultResolver.LookupAddr(lookupCtx, h.IP.String())
	if err == nil && len(names) > 0 {
		h.Hostname = trimTrailingDot(names[0])
	}

	if gateway != "" && h.Key == gateway {
		h.Tags = append(h.Tags, "gateway")
	}
	return h
}

func trimTrailingDot(s string) string {
	if len(s) > 0 && s[len(s)-1] == '.' {
		return s[:len(s)-1]
	}
	return s
}
