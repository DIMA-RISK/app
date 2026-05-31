package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/pipeline"
	"github.com/bahaaaljuboori/ewnaf/internal/validate"
)

func main() {
	os.Exit(run())
}

func run() int {
	cfg, err := parseFlags()
	if err != nil {
		if _, ok := err.(errExitOK); ok {
			return 0
		}
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		return 2
	}

	level := slog.LevelInfo
	if cfg.Verbose {
		level = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})))

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if cfg.Timeout > 0 {
		var timeoutCancel context.CancelFunc
		ctx, timeoutCancel = context.WithTimeout(ctx, cfg.Timeout)
		defer timeoutCancel()
	}

	runner := pipeline.New(cfg)
	result, paths, err := runner.Execute(ctx)
	if err != nil {
		slog.Error("pipeline failed", "error", err)
		return 1
	}

	fmt.Printf("EWNAF %s complete for client %q\n", models.Version, result.Client)
	fmt.Printf("Mode=%s Security=%s Findings=%d OverallScore=%.2f\n",
		result.Mode, result.Security, len(result.Findings), result.Score.Overall)
	for format, path := range paths {
		fmt.Printf("  %s: %s\n", format, path)
	}
	return 0
}

func parseFlags() (models.Config, error) {
	var (
		client   = flag.String("client", "", "Client identifier for reports (required)")
		output   = flag.String("output", "./ewnaf-out", "Output directory")
		subnets  = flag.String("subnets", "", "Comma-separated CIDRs or IPs (required)")
		mode     = flag.String("mode", "standard", "Scan mode: passive|standard|deep")
		security = flag.String("security", "STRICT", "Security level: STRICT|RELAXED|OFFENSIVE")
		jobs     = flag.Int("jobs", 4, "Parallel job count (1-256)")
		timeout  = flag.Duration("timeout", 30*time.Minute, "Overall pipeline timeout")
		dryRun   = flag.Bool("dry-run", false, "Validate and preflight only")
		verbose  = flag.Bool("verbose", false, "Enable debug logging")
		version  = flag.Bool("version", false, "Print version and exit")
	)
	flag.Parse()

	if *version {
		fmt.Println(models.Version)
		return models.Config{}, errExitOK{}
	}

	scanMode, err := validate.Mode(*mode)
	if err != nil {
		return models.Config{}, err
	}
	secLevel, err := validate.Security(*security)
	if err != nil {
		return models.Config{}, err
	}

	var subnetList []string
	for _, s := range strings.Split(*subnets, ",") {
		s = strings.TrimSpace(s)
		if s != "" {
			subnetList = append(subnetList, s)
		}
	}

	cfg := models.Config{
		Client:   strings.TrimSpace(*client),
		Output:   strings.TrimSpace(*output),
		Subnets:  subnetList,
		Mode:     scanMode,
		Security: secLevel,
		Jobs:     *jobs,
		Timeout:  *timeout,
		DryRun:   *dryRun,
		Verbose:  *verbose,
	}
	return cfg, nil
}

type errExitOK struct{}

func (errExitOK) Error() string { return "version printed" }

func (e errExitOK) ExitCode() int { return 0 }
