package probe

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/bahaaaljuboori/ewnaf/internal/models"
	"github.com/bahaaaljuboori/ewnaf/internal/policy"
)

// Topology probes local routing/DNS context without raw sockets when possible.
func Topology(ctx context.Context, topo *models.Topology, eng *policy.Engine, session *models.SessionState) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	session.SetPhase("probe_topology")

	gw, err := defaultGateway()
	if err == nil && gw != "" {
		topo.Gateway = gw
		session.ProbeResults["gateway"] = gw
	}

	if nameservers, err := net.LookupAddr("8.8.8.8"); err == nil && len(nameservers) > 0 {
		topo.DNS = append(topo.DNS, nameservers...)
	}

	// Expand CIDR targets into host keys for downstream discovery (stdlib only).
	for _, subnet := range topo.Subnets {
		hosts, err := expandTargets(subnet, eng.Mode())
		if err != nil {
			slog.Warn("subnet expansion skipped", "subnet", subnet, "error", err)
			continue
		}
		for _, h := range hosts {
			topo.UpsertHost(h)
		}
	}

	session.ProbeResults["host_count"] = len(topo.Hosts())
	slog.Info("topology probe complete", "hosts", len(topo.Hosts()), "gateway", topo.Gateway)
	return nil
}

func defaultGateway() (string, error) {
	// Best-effort: dial UDP to infer local route (no packets required to complete).
	conn, err := net.DialTimeout("udp4", "8.8.8.8:80", 2*time.Second)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	local := conn.LocalAddr().(*net.UDPAddr)
	return local.IP.String(), nil
}

func expandTargets(subnet string, mode models.ScanMode) ([]models.Host, error) {
	if ip := net.ParseIP(subnet); ip != nil {
		return []models.Host{hostFromIP(ip)}, nil
	}
	_, network, err := net.ParseCIDR(subnet)
	if err != nil {
		return nil, err
	}

	var hosts []models.Host
	if mode == models.ModePassive {
		// Passive: register network anchor only, not full sweep.
		for _, ip := range networkAnchors(network) {
			hosts = append(hosts, hostFromIP(ip))
		}
		return hosts, nil
	}

	// Standard/deep: enumerate (not full /24 sweep) to stay non-destructive in Go port.
	for _, ip := range sampleNetwork(network, 8) {
		hosts = append(hosts, hostFromIP(ip))
	}
	return hosts, nil
}

func hostFromIP(ip net.IP) models.Host {
	ip = ip.To4()
	if ip == nil {
		ip = ip.To16()
	}
	key := ip.String()
	return models.Host{
		Key: key,
		IP:  ip,
	}
}

func networkAnchors(network *net.IPNet) []net.IP {
	ip := network.IP.Mask(network.Mask)
	networkIP := make(net.IP, len(ip))
	copy(networkIP, ip)
	return []net.IP{networkIP}
}

func sampleNetwork(network *net.IPNet, max int) []net.IP {
	ip := network.IP.Mask(network.Mask)
	if ip.To4() == nil || max <= 0 {
		return networkAnchors(network)
	}
	var out []net.IP
	for i := 1; i < 254 && len(out) < max; i++ {
		candidate := incrementIPv4(ip, i)
		if network.Contains(candidate) {
			out = append(out, candidate)
		}
	}
	if len(out) == 0 {
		out = networkAnchors(network)
	}
	return out
}

func incrementIPv4(base net.IP, n int) net.IP {
	ip := make(net.IP, 4)
	copy(ip, base.To4())
	v := int(ip[0])<<24 | int(ip[1])<<16 | int(ip[2])<<8 | int(ip[3])
	v += n
	ip[0] = byte(v >> 24)
	ip[1] = byte(v >> 16)
	ip[2] = byte(v >> 8)
	ip[3] = byte(v)
	return ip
}

// Confidence returns a probe confidence score for a host (0-1).
func Confidence(host models.Host) float64 {
	if host.IP == nil {
		return 0
	}
	if host.Hostname != "" {
		return 0.95
	}
	return 0.75
}

// ValidateReachability performs ICMP-free reachability via TCP connect to common ports.
func ValidateReachability(ctx context.Context, host models.Host, ports []int) []models.Port {
	var open []models.Port
	for _, p := range ports {
		if err := ctx.Err(); err != nil {
			break
		}
		addr := fmt.Sprintf("%s:%d", host.IP.String(), p)
		d := net.Dialer{Timeout: 2 * time.Second}
		conn, err := d.DialContext(ctx, "tcp", addr)
		if err != nil {
			continue
		}
		_ = conn.Close()
		open = append(open, models.Port{
			Number:   p,
			Protocol: "tcp",
			State:    "open",
		})
	}
	return open
}
