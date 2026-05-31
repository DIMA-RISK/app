package policy_test

import (
	"testing"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/policy"
)

func TestValidateModeSecurity(t *testing.T) {
	if err := policy.ValidateModeSecurity(models.ModeStandard, models.SecurityStrict); err != nil {
		t.Fatalf("expected valid pair, got %v", err)
	}
	if err := policy.ValidateModeSecurity(models.ModePassive, models.SecurityOffensive); err == nil {
		t.Fatal("expected offensive+passive to fail")
	}
	if err := policy.ValidateModeSecurity("invalid", models.SecurityStrict); err == nil {
		t.Fatal("expected invalid mode to fail")
	}
}

func TestPolicyMatrixPassiveStrict(t *testing.T) {
	eng, err := policy.NewEngine(models.ModePassive, models.SecurityStrict)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := eng.AllowTool(models.ToolP0f); err != nil {
		t.Errorf("p0f should be allowed in passive strict: %v", err)
	}
	for _, tool := range []models.Tool{models.ToolNaabu, models.ToolNuclei, models.ToolPhaseX} {
		if _, err := eng.AllowTool(tool); err == nil {
			t.Errorf("expected %s blocked in passive strict", tool)
		}
	}
}

func TestPolicyMatrixDeepOffensive(t *testing.T) {
	eng, err := policy.NewEngine(models.ModeDeep, models.SecurityOffensive)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := eng.AllowTool(models.ToolPhaseX); err != nil {
		t.Errorf("phase_x should be allowed in deep offensive: %v", err)
	}
}

func TestPolicyFreeze(t *testing.T) {
	eng, err := policy.NewEngine(models.ModeStandard, models.SecurityRelaxed)
	if err != nil {
		t.Fatal(err)
	}
	eng.EnforceFreeze()
	if err := eng.SetSecurityLevel(models.SecurityStrict); err == nil {
		t.Fatal("expected frozen policy mutation to fail")
	}
	if !eng.Frozen() {
		t.Fatal("expected frozen state")
	}
}

func TestHardBlocks(t *testing.T) {
	eng, err := policy.NewEngine(models.ModePassive, models.SecurityStrict)
	if err != nil {
		t.Fatal(err)
	}
	if err := eng.CheckHardBlock("raw_socket_scan"); err == nil {
		t.Fatal("expected raw_socket_scan hard block in passive mode")
	}
}

func TestTrafficPolicy(t *testing.T) {
	eng, _ := policy.NewEngine(models.ModePassive, models.SecurityStrict)
	tp := eng.TrafficPolicy([]string{"192.168.1.0/24"})
	if tp.AllowSYN {
		t.Fatal("passive mode should not allow SYN")
	}
	if !tp.RequireAuthZone {
		t.Fatal("strict security should require auth zone")
	}
}

func TestAllowedTools(t *testing.T) {
	eng, _ := policy.NewEngine(models.ModeStandard, models.SecurityRelaxed)
	tools := eng.AllowedTools()
	if len(tools) == 0 {
		t.Fatal("expected at least one allowed tool")
	}
}
