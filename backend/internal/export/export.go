package export

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
)

// Formats supported by EWNAF export domain.
const (
	FormatJSON  = "json"
	FormatHTML  = "html"
	FormatSARIF = "sarif"
	FormatPDF   = "pdf"
)

// Exporter writes scan results to configured output paths.
type Exporter struct {
	outputDir string
}

func NewExporter(outputDir string) *Exporter {
	return &Exporter{outputDir: outputDir}
}

// All writes JSON, HTML, and SARIF reports (PDF stub).
func (e *Exporter) All(result *models.ScanResult) (map[string]string, error) {
	paths := map[string]string{}
	reportsDir := filepath.Join(e.outputDir, "reports")

	jsonPath, err := e.writeJSON(reportsDir, result)
	if err != nil {
		return paths, err
	}
	paths[FormatJSON] = jsonPath

	htmlPath, err := e.writeHTML(reportsDir, result)
	if err != nil {
		return paths, err
	}
	paths[FormatHTML] = htmlPath

	sarifPath, err := e.writeSARIF(reportsDir, result)
	if err != nil {
		return paths, err
	}
	paths[FormatSARIF] = sarifPath

	pdfPath, err := e.writePDFStub(reportsDir, result)
	if err != nil {
		return paths, err
	}
	paths[FormatPDF] = pdfPath

	return paths, nil
}

func (e *Exporter) writeJSON(dir string, result *models.ScanResult) (string, error) {
	path := filepath.Join(dir, fmt.Sprintf("ewnaf-%s-%d.json", sanitize(result.Client), result.EndedAt.Unix()))
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return "", err
	}
	return path, os.WriteFile(path, data, 0o644)
}

var htmlTmpl = template.Must(template.New("report").Parse(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>EWNAF Report — {{.Client}}</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;background:#0f172a;color:#e2e8f0}
h1{color:#38bdf8} .meta{color:#94a3b8} table{border-collapse:collapse;width:100%;margin-top:1rem}
th,td{border:1px solid #334155;padding:.5rem;text-align:left}
th{background:#1e293b}.score{font-size:1.5rem;color:#fbbf24}
</style>
</head>
<body>
<h1>EWNAF v{{.Version}}</h1>
<p class="meta">Client: {{.Client}} | Mode: {{.Mode}} | Security: {{.Security}}</p>
<p class="score">Overall Risk: {{printf "%.2f" .Score.Overall}}</p>
<p>Hosts: {{len .Topology.Nodes}} | Findings: {{len .Findings}} | High Risk Hosts: {{.Score.HighRiskCount}}</p>
<h2>Findings</h2>
<table>
<tr><th>Severity</th><th>Host</th><th>Title</th><th>Category</th></tr>
{{range .Findings}}
<tr><td>{{.Severity}}</td><td>{{.HostKey}}</td><td>{{.Title}}</td><td>{{.Category}}</td></tr>
{{end}}
</table>
</body>
</html>`))

func (e *Exporter) writeHTML(dir string, result *models.ScanResult) (string, error) {
	path := filepath.Join(dir, fmt.Sprintf("ewnaf-%s-%d.html", sanitize(result.Client), result.EndedAt.Unix()))
	var buf bytes.Buffer
	if err := htmlTmpl.Execute(&buf, result); err != nil {
		return "", err
	}
	return path, os.WriteFile(path, buf.Bytes(), 0o644)
}

func (e *Exporter) writeSARIF(dir string, result *models.ScanResult) (string, error) {
	path := filepath.Join(dir, fmt.Sprintf("ewnaf-%s-%d.sarif", sanitize(result.Client), result.EndedAt.Unix()))
	doc := sarifDocument(result)
	data, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return "", err
	}
	return path, os.WriteFile(path, data, 0o644)
}

func (e *Exporter) writePDFStub(dir string, result *models.ScanResult) (string, error) {
	path := filepath.Join(dir, fmt.Sprintf("ewnaf-%s-%d.pdf.stub", sanitize(result.Client), result.EndedAt.Unix()))
	note := fmt.Sprintf("PDF export stub for EWNAF %s\nClient: %s\nGenerated: %s\nUse external renderer or future PDF backend.\n",
		models.Version, result.Client, time.Now().UTC().Format(time.RFC3339))
	return path, os.WriteFile(path, []byte(note), 0o644)
}

func sanitize(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_' {
			out = append(out, c)
		} else {
			out = append(out, '_')
		}
	}
	if len(out) == 0 {
		return "client"
	}
	return string(out)
}

func sarifDocument(result *models.ScanResult) map[string]interface{} {
	var runs []map[string]interface{}
	rules := map[string]map[string]interface{}{}
	results := []map[string]interface{}{}

	for _, f := range result.Findings {
		ruleID := f.Category + "/" + f.Title
		rules[ruleID] = map[string]interface{}{
			"id":   ruleID,
			"name": f.Title,
			"shortDescription": map[string]string{"text": f.Title},
		}
		results = append(results, map[string]interface{}{
			"ruleId": ruleID,
			"level":  mapSeverityToSARIF(f.Severity),
			"message": map[string]string{"text": f.Description},
			"locations": []map[string]interface{}{
				{
					"physicalLocation": map[string]interface{}{
						"artifactLocation": map[string]string{"uri": f.HostKey},
					},
				},
			},
		})
	}

	var ruleList []map[string]interface{}
	for _, r := range rules {
		ruleList = append(ruleList, r)
	}

	runs = append(runs, map[string]interface{}{
		"tool": map[string]interface{}{
			"driver": map[string]interface{}{
				"name":    "EWNAF",
				"version": models.Version,
				"rules":   ruleList,
			},
		},
		"results": results,
	})

	return map[string]interface{}{
		"$schema": "https://json.schemastore.org/sarif-2.1.0.json",
		"version": "2.1.0",
		"runs":    runs,
	}
}

func mapSeverityToSARIF(sev string) string {
	switch sev {
	case "critical", "high":
		return "error"
	case "medium", "low":
		return "warning"
	default:
		return "note"
	}
}
