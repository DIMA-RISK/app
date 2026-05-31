package scoring_test

import (
	"testing"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/scoring"
)

func TestCompute(t *testing.T) {
	topo := models.NewTopology([]string{"10.0.0.0/24"})
	topo.UpsertHost(models.Host{Key: "10.0.0.1", IP: []byte{10, 0, 0, 1}})

	findings := []models.Finding{
		{HostKey: "10.0.0.1", Severity: "high", Category: "exposure", Confidence: 1.0},
		{HostKey: "10.0.0.1", Severity: "info", Category: "baseline", Confidence: 1.0},
	}

	report := scoring.Compute(topo, findings)
	if report.Overall <= 0 {
		t.Fatalf("expected positive overall score, got %f", report.Overall)
	}
	if report.ByHost["10.0.0.1"] <= 0 {
		t.Fatal("expected host score")
	}
}
