# EWNAF — Go Port (v38.1)

Enterprise Defensive Heuristic Network Audit Framework ported from the Bash monolith (`taki-uj-hardened-v4-phase-tuned.sh`) into an idiomatic Go 1.22+ codebase.

**Version:** `38.1.0-ENTERPRISE-PRODUCTION`

## Quick start

```bash
cd ~/Developer/ewnaf
go build -o bin/ewnaf ./cmd/ewnaf
go test ./...

# Dry-run (validate + preflight only)
./bin/ewnaf --client acme --subnets 192.168.1.0/24 --mode passive --security STRICT --dry-run

# Full pipeline (authorized networks only)
./bin/ewnaf \
  --client acme \
  --output ./ewnaf-out \
  --subnets 192.168.1.0/24,10.0.0.1 \
  --mode standard \
  --security RELAXED \
  --jobs 8 \
  --timeout 15m \
  --verbose
```

## Architecture mapping (Bash → Go)

| Bash domain | Go package | Status |
|-------------|------------|--------|
| Bootstrap / Runtime Init | `internal/bootstrap` | **Implemented** — validation, output layout, preflight |
| Validators | `internal/validate` | **Implemented** — client, subnets, output, mode/security |
| Policy matrix / freeze | `internal/policy` | **Implemented** — MODE × SECURITY gating, hard blocks, freeze |
| Core data structures | `internal/models` | **Implemented** — Host, Topology, Finding, SessionState |
| Topology Engine | `internal/probe`, `internal/topology` | **Partial** — gateway inference, CIDR sampling, reverse DNS |
| Probe / Confidence | `internal/probe` | **Partial** — TCP reachability, confidence scoring |
| Hound Scope / Discover | `internal/topology` | **Partial** — adjacency edges via gateway |
| Audit Modules | `internal/audit` | **Partial** — baseline + exposure modules, extensible registry |
| Behavioural Engine | `internal/behavior` | **Partial** — blackboard analysis; Phase X stub |
| Exploration | `internal/exploration` | **Partial** — stdlib HTTP HEAD probes when policy allows |
| Scanner Integration | `internal/scanner` | **Partial** — 3-phase governed shell-out when tools on PATH |
| Phase X | `internal/behavior` | **Stub** — requires external tooling + authorization |
| Scoring | `internal/scoring` | **Implemented** — severity-weighted aggregation |
| Export (HTML/JSON/SARIF/PDF) | `internal/export` | **Partial** — JSON/HTML/SARIF live; PDF is stub file |
| Pipeline orchestration | `internal/pipeline` | **Implemented** — full documented stage order |
| CLI | `cmd/ewnaf` | **Implemented** — flags mirror bash args |

## Pipeline order

```
bootstrap → preflight → probe_topology → discover → audits →
freeze_context → exploration → phase_x → scanners → scoring → export
```

Policy becomes **immutable** after `freeze_context` (`policy.Engine.EnforceFreeze()` + `SessionState.Freeze()`).

## Policy matrix

Modes: `passive`, `standard`, `deep`

Security levels: `STRICT`, `RELAXED`, `OFFENSIVE`

Gated tools: `naabu`, `httpx`, `nuclei`, `katana`, `ghost_probe`, `p0f`, `phase_x`

See `internal/policy/policy.go` and `internal/policy/policy_test.go` for matrix behavior.

## Outputs

Reports land under `{output}/reports/`:

- `ewnaf-{client}-{ts}.json`
- `ewnaf-{client}-{ts}.html`
- `ewnaf-{client}-{ts}.sarif`
- `ewnaf-{client}-{ts}.pdf.stub` (placeholder until PDF backend added)

## Authorization & limitations

- **Only scan networks you are authorized to assess.** Active probes (TCP connect, external scanners) can be intrusive.
- Passive mode avoids SYN scans and most external tooling by policy.
- Tools requiring root (`naabu`, `phase_x` in some configs) are skipped in this unprivileged port.
- External scanners are invoked only when installed on `PATH` and allowed by policy.
- Phase X, p0f, ghost probe, nuclei, katana integrations are interface-ready but depend on host tooling.

## Project layout

```
cmd/ewnaf/           CLI entrypoint
internal/
  bootstrap/         Session bootstrap & preflight
  policy/            Policy matrix & freeze
  validate/          Input validators
  models/            Domain types
  pipeline/          Stage orchestration
  probe/             Topology probe & confidence
  topology/          Discovery enrichment
  audit/             Audit module registry
  exploration/       Post-freeze HTTP exploration
  behavior/          Behavioural engine & Phase X stub
  scanner/           Governed 3-phase scanner runner
  scoring/           Risk scoring
  export/            Report writers
```

## Development

```bash
go build ./...
go test ./...
go run ./cmd/ewnaf --version
```

## Not yet ported (future work)

- Full Hound scope / MAC correlation
- Raw socket / p0f passive fingerprinting
- Ghost probe custom protocol
- Complete nuclei/katana result parsing into findings
- PDF rendering (wkhtmltopdf, chromedp, or reportlab equivalent)
- Distributed job queue for `--jobs` parallelism
- Bash-compatible env var configuration surface
