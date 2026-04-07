package metrics

import (
	"testing"

	"github.com/grafana/dskit/metrics"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSenderAggregatedMetrics_DescribeMetricNames(t *testing.T) {
	registries := metrics.NewTenantRegistries(log.NewNopLogger())
	m := NewSenderAggregatedMetrics(registries)

	ch := make(chan *prometheus.Desc, 100)
	m.Describe(ch)
	close(ch)

	var names []string
	for desc := range ch {
		names = append(names, desc.String())
	}

	expectedNames := []string{
		"grafana_alerting_sender_notifications_latency_seconds",
		"grafana_alerting_sender_notifications_errors_total",
		"grafana_alerting_sender_notifications_sent_total",
		"grafana_alerting_sender_notifications_dropped_total",
		"grafana_alerting_sender_notifications_queue_length",
		"grafana_alerting_sender_notifications_queue_capacity",
		"grafana_alerting_sender_alertmanagers_discovered",
	}

	require.Len(t, names, len(expectedNames), "number of described metrics should match")

	for i, expected := range expectedNames {
		assert.Contains(t, names[i], "fqName: \""+expected+"\"",
			"metric at position %d should have name %s", i, expected)
	}
}
