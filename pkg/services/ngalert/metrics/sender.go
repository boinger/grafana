package metrics

import (
	"fmt"
	"strconv"

	"github.com/grafana/dskit/metrics"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

// Sender manages per-org metrics for the external Alertmanager sender.
// It follows the same TenantRegistries pattern as MultiOrgAlertmanager.
type Sender struct {
	registries        *metrics.TenantRegistries
	aggregatedMetrics *SenderAggregatedMetrics
}

// NewSenderMetrics creates a new Sender metrics manager and registers the aggregated collector on r.
func NewSenderMetrics(r prometheus.Registerer) *Sender {
	registries := metrics.NewTenantRegistries(log.New("ngalert.sender.metrics"))
	s := &Sender{
		registries:        registries,
		aggregatedMetrics: NewSenderAggregatedMetrics(registries),
	}

	r.MustRegister(s.aggregatedMetrics)

	return s
}

// RemoveOrgRegistry removes the *prometheus.Registry for the specified org. It is safe to call concurrently.
func (s *Sender) RemoveOrgRegistry(id int64) {
	s.registries.RemoveTenantRegistry(strconv.FormatInt(id, 10), false)
}

// GetOrCreateOrgRegistry gets or creates a *prometheus.Registry for the specified org. It is safe to call concurrently.
func (s *Sender) GetOrCreateOrgRegistry(id int64) prometheus.Registerer {
	sid := strconv.FormatInt(id, 10)
	reg := s.registries.GetRegistryForTenant(sid)
	if reg != nil {
		return reg
	}

	result := prometheus.NewRegistry()
	s.registries.AddTenantRegistry(sid, result)

	return result
}

// SenderAggregatedMetrics is a custom collector that aggregates per-org sender metrics
// from TenantRegistries into metrics with an "org" label.
type SenderAggregatedMetrics struct {
	registries *metrics.TenantRegistries

	notificationsLatency             *prometheus.Desc
	notificationsErrors              *prometheus.Desc
	notificationsSent                *prometheus.Desc
	notificationsDropped             *prometheus.Desc
	notificationsQueueLength         *prometheus.Desc
	notificationsQueueCapacity       *prometheus.Desc
	notificationsAlertmanagersDiscov *prometheus.Desc
}

// NewSenderAggregatedMetrics creates descriptors for the aggregated sender metrics.
func NewSenderAggregatedMetrics(registries *metrics.TenantRegistries) *SenderAggregatedMetrics {
	return &SenderAggregatedMetrics{
		registries: registries,
		notificationsLatency: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_notifications_latency_seconds", Namespace, Subsystem),
			"Latency quantiles for sending alert notifications to external Alertmanagers.",
			[]string{"org"}, nil),
		notificationsErrors: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_notifications_errors_total", Namespace, Subsystem),
			"Total number of alerts affected by errors when sending to external Alertmanagers.",
			[]string{"org"}, nil),
		notificationsSent: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_notifications_sent_total", Namespace, Subsystem),
			"Total number of alerts sent to external Alertmanagers.",
			[]string{"org"}, nil),
		notificationsDropped: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_notifications_dropped_total", Namespace, Subsystem),
			"Total number of alerts dropped due to errors when sending to external Alertmanagers.",
			[]string{"org"}, nil),
		notificationsQueueLength: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_notifications_queue_length", Namespace, Subsystem),
			"The number of alert notifications in the sender queue.",
			[]string{"org"}, nil),
		notificationsQueueCapacity: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_notifications_queue_capacity", Namespace, Subsystem),
			"The capacity of the sender alert notifications queue.",
			[]string{"org"}, nil),
		notificationsAlertmanagersDiscov: prometheus.NewDesc(
			fmt.Sprintf("%s_%s_sender_alertmanagers_discovered", Namespace, Subsystem),
			"The number of external alertmanagers discovered and active.",
			[]string{"org"}, nil),
	}
}

func (s *SenderAggregatedMetrics) Describe(out chan<- *prometheus.Desc) {
	out <- s.notificationsLatency
	out <- s.notificationsErrors
	out <- s.notificationsSent
	out <- s.notificationsDropped
	out <- s.notificationsQueueLength
	out <- s.notificationsQueueCapacity
	out <- s.notificationsAlertmanagersDiscov
}

func (s *SenderAggregatedMetrics) Collect(out chan<- prometheus.Metric) {
	data := s.registries.BuildMetricFamiliesPerTenant()

	data.SendSumOfSummariesPerTenant(out, s.notificationsLatency, "prometheus_notifications_latency_seconds")
	data.SendSumOfCountersPerTenant(out, s.notificationsErrors, "prometheus_notifications_errors_total")
	data.SendSumOfCountersPerTenant(out, s.notificationsSent, "prometheus_notifications_sent_total")
	data.SendSumOfCountersPerTenant(out, s.notificationsDropped, "prometheus_notifications_dropped_total")
	data.SendSumOfGaugesPerTenant(out, s.notificationsQueueLength, "prometheus_notifications_queue_length")
	data.SendSumOfGaugesPerTenant(out, s.notificationsQueueCapacity, "prometheus_notifications_queue_capacity")
	data.SendSumOfGaugesPerTenant(out, s.notificationsAlertmanagersDiscov, "prometheus_notifications_alertmanagers_discovered")
}
