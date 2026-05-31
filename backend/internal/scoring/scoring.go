package scoring

import (
	"strings"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
)

var severityWeight = map[string]float64{
	"critical": 10,
	"high":     7,
	"medium":   4,
	"low":      2,
	"info":     0.5,
}

// Compute aggregates findings into host and overall risk scores.
func Compute(topo *models.Topology, findings []models.Finding) models.ScoreReport {
	byHost := map[string]float64{}
	byCategory := map[string]float64{}

	for _, f := range findings {
		w := severityWeight[strings.ToLower(f.Severity)]
		if w == 0 {
			w = 1
		}
		score := w * f.Confidence
		byHost[f.HostKey] += score
		byCategory[f.Category] += score
	}

	highRisk := 0
	var overall float64
	hosts := topo.Hosts()
	if len(hosts) == 0 && len(byHost) > 0 {
		for k, v := range byHost {
			overall += v
			if v >= 5 {
				highRisk++
			}
			topo.UpsertHost(models.Host{Key: k, RiskScore: v})
		}
	} else {
		for i, h := range hosts {
			score := byHost[h.Key]
			h.RiskScore = score
			hosts[i] = h
			topo.UpsertHost(h)
			overall += score
			if score >= 5 {
				highRisk++
			}
		}
	}
	if len(hosts) > 0 {
		overall = overall / float64(len(hosts))
	}

	return models.ScoreReport{
		Overall:       overall,
		ByHost:        byHost,
		ByCategory:    byCategory,
		HighRiskCount: highRisk,
	}
}
