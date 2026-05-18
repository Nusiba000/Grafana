from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
import logging
import threading
import time
import hashlib
import json
import math

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

def generate_metric_key(metric_name, labels):
    labels_str = json.dumps(labels, sort_keys=True)
    return f"{metric_name}_{hashlib.md5(labels_str.encode()).hexdigest()}"


def build_promql(metric_name, labels):
    """Build a PromQL instant query string with label selectors."""
    selector_parts = [
        f'{k}="{v}"'
        for k, v in labels.items()
        if k != "__name__"
    ]
    if selector_parts:
        return f'{metric_name}{{{",".join(selector_parts)}}}'
    return metric_name


def fetch_prometheus_baseline(source, metric_name, labels, now=None):
    """
    Query Prometheus at 7, 14, and 21 days ago for the same metric + labels.
    Returns (baseline_avg, std_dev) — both None if no valid samples found.
    """
    base_url = DATA_SOURCES.get(source)
    if not base_url:
        return None, None

    if now is None:
        now = datetime.now()

    query = build_promql(metric_name, labels)
    samples = []

    for days_ago in (7, 14, 21):
        t = (now - timedelta(days=days_ago)).timestamp()
        try:
            response = requests.get(
                f"{base_url}/api/v1/query",
                params={"query": query, "time": t},
                timeout=5
            )
            if response.status_code != 200:
                continue
            results = response.json().get("data", {}).get("result", [])
            if not results:
                continue
            raw = results[0].get("value", [None, None])[1]
            if raw is None:
                continue
            samples.append(float(raw))
        except Exception:
            continue

    if not samples:
        return None, None

    baseline_avg = sum(samples) / len(samples)

    if len(samples) > 1:
        variance = sum((s - baseline_avg) ** 2 for s in samples) / len(samples)
        std_dev = math.sqrt(variance)
    else:
        std_dev = None

    return baseline_avg, std_dev


def calculate_status(current, baseline_avg, std_dev):
    """
    Determine alert status using z-score (when std_dev is available)
    or percentage change as fallback.
    Returns (status, change_pct, z_score).
    """
    if baseline_avg is None or abs(baseline_avg) == 0:
        return "unknown", None, None

    change_pct = ((current - baseline_avg) / abs(baseline_avg)) * 100

    if std_dev is not None and std_dev > 0:
        z_score = (current - baseline_avg) / std_dev
        if abs(z_score) >= 3:
            status = "critical"
        elif abs(z_score) >= 2:
            status = "warning"
        else:
            status = "normal"
    else:
        z_score = None
        if abs(change_pct) >= 50:
            status = "critical"
        elif abs(change_pct) >= 25:
            status = "warning"
        else:
            status = "normal"

    return status, change_pct, z_score


def explain_baseline(metric_name, baseline_avg, change_pct, std_dev, z_score, n_weeks):
    """
    Build a human-readable baseline explanation for Jira tickets.
    """
    if baseline_avg is None or change_pct is None:
        return f"{metric_name}: No historical baseline available for this time window."

    direction = "above" if change_pct >= 0 else "below"
    parts = [f"baseline avg: {round(baseline_avg, 6)}"]
    if std_dev is not None:
        parts.append(f"std dev: {round(std_dev, 6)}")
    if z_score is not None:
        parts.append(f"z-score: {round(z_score, 2)}")
    parts.append(f"based on {n_weeks} week(s) of history")

    return (
        f"{metric_name} is {abs(round(change_pct, 2))}% {direction} normal for this time of day "
        f"({', '.join(parts)})"
    )


store_lock = threading.Lock()

DATA_SOURCES = {
    "proxmox-prom": "https://prometheus.odp-main.duckdns.org",
    "vcenter-prom": "http://10.8.123.102:9090",
    "nebulanew-prom": "https://k8snewprom.odp-main.duckdns.org"
}

# Enhanced logging configuration for terminal visibility
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # This shows logs in terminal
        logging.FileHandler('jira_alerts.log')  # Also save to file
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Global store for tracking critical metrics and their last ticket times
critical_metrics_store = {}
last_hourly_check = datetime.now()
last_ticket_per_group = {}

# JIRA Configuration
JIRA_URL = os.getenv('JIRA_URL', 'https://omandatapark-sandbox-811.atlassian.net')
JIRA_USERNAME = os.getenv('JIRA_USERNAME', 'halhaddabi@omandatapark.com')
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN")
JIRA_PROJECT_KEY = os.getenv('JIRA_PROJECT_KEY', 'OCI')


class JiraClient:
    def __init__(self):
        self.base_url = JIRA_URL
        self.auth = (JIRA_USERNAME, JIRA_API_TOKEN)
        self.headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        logger.info("JIRA Client initialized")
        logger.info(f"JIRA URL: {self.base_url}")
        logger.info(f"Username: {JIRA_USERNAME}")
        logger.info(f"Project: {JIRA_PROJECT_KEY}")
    
    def create_ticket(self, alert_data):
        """Create JIRA ticket for critical alert"""
        try:
            logger.info("Preparing JIRA ticket data...")
            
            # Prepare ticket data
            if alert_data.get('is_persistent'):
                summary = f"PERSISTENT CRITICAL ALERT: {alert_data['metric_name']} - Still Critical After {alert_data['persistent_hours']} Hours (+{alert_data['change_percentage']:.2f}%)"
            else:
                summary = f"CRITICAL ALERT: {alert_data['metric_name']} - Threshold Violation +{alert_data['change_percentage']:.2f}%"
            
            ticket_data = {
                "fields": {
                    "project": {"key": JIRA_PROJECT_KEY},
                    "summary": summary,
                    "description": self._format_description(alert_data),
                    "issuetype": {"name": "Task"},
                    "priority": {"name": "High"}
                }
            }
            
            logger.info(f"Sending request to JIRA API: {self.base_url}/rest/api/3/issue")
            
            # Create ticket via JIRA API
            response = requests.post(
                f"{self.base_url}/rest/api/3/issue",
                json=ticket_data,
                auth=self.auth,
                headers=self.headers
            )
            
            logger.info(f"JIRA API Response Status: {response.status_code}")
            
            if response.status_code == 201:
                ticket_info = response.json()
                logger.info("JIRA API SUCCESS!")
                logger.info(f"Response: {ticket_info}")
                return {
                    "success": True,
                    "ticket_key": ticket_info['key'],
                    "ticket_url": f"{self.base_url}/browse/{ticket_info['key']}"
                }
            else:
                logger.error("JIRA API FAILED!")
                logger.error(f"Status Code: {response.status_code}")
                logger.error(f"Response Text: {response.text}")
                return {
                    "success": False,
                    "error": f"JIRA API error: {response.status_code}"
                }
                
        except Exception as e:
            logger.error("EXCEPTION IN JIRA CLIENT!")
            logger.error(f"Error: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def check_and_create_hourly_tickets(self):
        """Check for persistent critical metrics and create hourly tickets"""
        global critical_metrics_store, last_hourly_check
        
        current_time = datetime.now()
        
        # Only run if an hour has passed since last check
        if current_time - last_hourly_check < timedelta(hours=1):
            return
        
        logger.info("=" * 50)
        logger.info("HOURLY CHECK: Checking for persistent critical metrics...")
        logger.info(f"Current time: {current_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        last_hourly_check = current_time
        
        if not critical_metrics_store:
            logger.info("No critical metrics to check")
            logger.info("=" * 50)
            return
        with store_lock:
            for metric_key, metric_info in list(critical_metrics_store.items()):
                try:
                    # Check if metric is still critical and needs a new ticket
                    if metric_info['status'] == 'critical':
                        logger.info(f"Creating hourly ticket for persistent critical metric: {metric_info['metric_name']}")
                    
                        # Create new ticket for persistent critical issue
                        alert_data = {
                            'metric_name': metric_info['metric_name'],
                            'current_value': metric_info['current_value'],
                            'yesterday_value': metric_info['yesterday_value'],
                            'change_percentage': metric_info['change_percentage'],
                            'labels': metric_info['labels'],
                            'warning_threshold': metric_info['warning_threshold'],
                            'critical_threshold': metric_info['critical_threshold'],
                            'persistent_hours': metric_info.get('persistent_hours', 0) + 1,
                            'is_persistent': True
                        }
                    
                        # Update persistent hours count
                        critical_metrics_store[metric_key]['persistent_hours'] = alert_data['persistent_hours']
                    
                        # Create the ticket
                        result = self.create_ticket(alert_data)
                    
                        if result['success']:
                            logger.info(f"HOURLY TICKET CREATED SUCCESSFULLY!")
                            logger.info(f"Ticket Key: {result['ticket_key']}")
                            logger.info(f"Ticket URL: {result['ticket_url']}")
                            logger.info(f"Metric: {metric_info['metric_name']} - Persistent for {alert_data['persistent_hours']} hours")
                        else:
                            logger.error(f"FAILED TO CREATE HOURLY TICKET!")
                            logger.error(f"Error: {result['error']}")
                        
                except Exception as e:
                    logger.error(f"Error processing hourly ticket for {metric_key}: {str(e)}")
        
            logger.info("=" * 50)
    
    def _format_description(self, alert_data):
        """Format description for JIRA ticket using Atlassian Document Format"""
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Use Atlassian Document Format (ADF) that JIRA Cloud requires
        description = {
            "version": 1,
            "type": "doc",
            "content": [
                                                 {
                    "type": "heading",
                    "attrs": {"level": 1},
                    "content": [{"type": "text", "text": f"{'PERSISTENT ' if alert_data.get('is_persistent') else ''}AUTOMATIC CRITICAL ALERT - OpSight Operations Monitor"}]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "METRIC DETAILS"}]
                },
                {
                    "type": "bulletList",
                    "content": [
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Metric Name: {alert_data['metric_name']}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Current Value: {alert_data['current_value']}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Yesterday's Value: {alert_data['yesterday_value']}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Change Percentage: {alert_data['change_percentage']:+.2f}%"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Threshold Exceeded: Critical ({alert_data['critical_threshold']}%)"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Persistent Hours: {alert_data.get('persistent_hours', 0)}"}]}]}
                    ]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "LABELS & CONTEXT"}]
                },
                {
                    "type": "bulletList",
                    "content": self._format_labels_adf(alert_data['labels'])
                },
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "THRESHOLD SETTINGS"}]
                },
                {
                    "type": "bulletList",
                    "content": [
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Warning Threshold: {alert_data['warning_threshold']}%"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Critical Threshold: {alert_data['critical_threshold']}%"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Status: CRITICAL"}]}]}
                    ]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "TIMING"}]
                },
                {
                    "type": "bulletList",
                    "content": [
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Alert Generated: {current_time}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Data Collected: {alert_data.get('timestamp', 'N/A')}"}]}]}
                    ]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "MONITORING INFO"}]
                },
                {
                    "type": "bulletList",
                    "content": [
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Data Source: {alert_data.get('source', 'unknown')}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Alert Type: Automatic Threshold Violation"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Requires: Immediate Investigation"}]}]}
                    ]
                },
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "---"}]
                },
                                 {
                     "type": "paragraph",
                     "content": [{"type": "text", "text": "This ticket was automatically generated by the OpSight Operations Monitor. Please investigate the metric change and take appropriate action."}]
                 }
                 
            ]
        }
        
        return description
    
    def _format_labels(self, labels):
        """Format metric labels for description (legacy)"""
        if not labels:
            return "- No additional labels"
        
        label_text = ""
        for key, value in labels.items():
            if key != '__name__':  # Skip metric name
                label_text += f"- {key}: {value}\n"
        
        return label_text.strip() if label_text else "- No additional labels"
    
    def _format_labels_adf(self, labels):
        """Format metric labels for ADF description"""
        if not labels:
            return [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "No additional labels"}]}]}]
        
        label_items = []
        for key, value in labels.items():
            if key != '__name__':  # Skip metric name
                label_items.append({
                    "type": "listItem", 
                    "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"{key}: {value}"}]}]
                })
        
        return label_items if label_items else [{"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "No additional labels"}]}]}]

    def create_grouped_ticket(self, group_info):
        try:
            category = group_info.get("category", "Unknown")
            source = group_info.get("source", "Unknown")
            metrics = group_info.get("metrics", [])

            metrics = sorted(metrics, key=lambda x: x.get("change_percentage", 0), reverse=True)
            metrics = metrics[:10]

            critical_count = sum(1 for m in metrics if m.get("status") == "critical")
            warning_count  = sum(1 for m in metrics if m.get("status") == "warning")
            normal_count   = sum(1 for m in metrics if m.get("status") == "normal")

            summary = f"AUTOMATIC CRITICAL ALERT - {category} ({source})"

            # ── Summary counts ──────────────────────────────────────────────
            total = len(metrics)

            # Exclude NORMAL metrics from the table (counts above are preserved)
            metrics = [m for m in metrics if m.get("status") in ("critical", "warning")]

            # ── Insight: average baseline deviation ─────────────────────────
            baseline_changes = [
                abs(m.get("baseline_change", 0))
                for m in metrics
                if m.get("baseline_change") is not None
            ]
            avg_deviation = sum(baseline_changes) / len(baseline_changes) if baseline_changes else 0

            # ── Split into CPU vs other ─────────────────────────────────────
            cpu_metrics   = [m for m in metrics if "cpu" in m["metric_name"].lower()]
            other_metrics = [m for m in metrics if "cpu" not in m["metric_name"].lower()]

            # ── Helpers ─────────────────────────────────────────────────────
            def format_number(value):
                try:
                    v = float(value)
                    if v >= 1_000_000:
                        return f"{v / 1_000_000:.2f}M"
                    elif v >= 1_000:
                        return f"{v / 1_000:.2f}K"
                    return str(value)
                except (TypeError, ValueError):
                    return str(value)

            def status_with_emoji(status):
                s = status.upper()
                if s == "CRITICAL":
                    return "🔴 CRITICAL"
                if s == "WARNING":
                    return "🟡 WARNING"
                if s == "NORMAL":
                    return "🟢 NORMAL"
                return s

            def build_table_rows(metric_list):
                rows = [{
                    "type": "tableRow",
                    "content": [
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Metric"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Current"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Yesterday"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Change"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Baseline Avg"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Baseline Change (%)"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Trend"}]}]},
                        {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Status"}]}]}
                    ]
                }]
                for m in metric_list:
                    trend = "UP" if m["change_percentage"] > 0 else "DOWN"
                    status = m.get("status", "UNKNOWN").upper()
                    labels = m.get("labels", {})
                    instance = labels.get("instance") or labels.get("node") or ""
                    metric_display = f"{m['metric_name']} ({instance})" if instance else m["metric_name"]
                    baseline_avg = m.get("baseline_avg")
                    baseline_change = m.get("baseline_change")
                    baseline_avg_display    = format_number(round(baseline_avg, 2)) if baseline_avg is not None else "N/A"
                    baseline_change_display = f"{abs(round(baseline_change, 2))}%" if baseline_change is not None else "N/A"
                    rows.append({
                        "type": "tableRow",
                        "content": [
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": metric_display}]}]},
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": format_number(m["current_value"])}]}]},
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": format_number(m["yesterday_value"])}]}]},
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"{m['change_percentage']:.2f}%"}]}]},
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": baseline_avg_display}]}]},
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": baseline_change_display}]}]},
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": trend}]}]},
                            {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": status_with_emoji(status)}]}]}
                        ]
                    })
                return rows

            # ── Build ADF content ───────────────────────────────────────────
            adf_content = [
                {
                    "type": "heading",
                    "attrs": {"level": 1},
                    "content": [{"type": "text", "text": f"AUTOMATIC ALERT — {category} ({source})"}]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "Summary"}]
                },
                {
                    "type": "bulletList",
                    "content": [
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Total Metrics: {total}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"🔴 Critical: {critical_count}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"🟡 Warning: {warning_count}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"🟢 Stable: {normal_count}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Source: {source}"}]}]},
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Category: {category}"}]}]}
                    ]
                },
                {
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "Insight"}]
                },
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": (
                        "All monitored metrics are within normal range. No abnormal behavior detected."
                        if critical_count == 0 and warning_count == 0
                        else "Some metrics show warning-level deviations, indicating minor irregularities that should be monitored."
                        if critical_count == 0 and warning_count > 0
                        else "Critical deviations detected in some metrics, indicating abnormal system behavior requiring attention."
                        if critical_count > 0 and warning_count == 0 and normal_count == 0
                        else "The system shows mixed behavior, with some metrics stable while others indicate warning or critical deviations."
                    )}]
                }
            ]

            if cpu_metrics:
                adf_content.append({
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "CPU Metrics"}]
                })
                adf_content.append({"type": "table", "content": build_table_rows(cpu_metrics)})

            if other_metrics:
                adf_content.append({
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "Other Metrics"}]
                })
                adf_content.append({"type": "table", "content": build_table_rows(other_metrics)})

            if not cpu_metrics and not other_metrics:
                adf_content.append({"type": "table", "content": build_table_rows(metrics)})

            # ── Root Cause & Recommended Action ─────────────────────────────
            if metrics:
                adf_content.append({
                    "type": "heading",
                    "attrs": {"level": 2},
                    "content": [{"type": "text", "text": "Root Cause & Recommended Action"}]
                })

                for m in metrics:
                    m_name      = m.get("metric_name", "Unknown")
                    curr_val    = m.get("current_value", "N/A")
                    base_avg    = m.get("baseline_avg")
                    base_change = m.get("baseline_change")
                    labels      = m.get("labels", {})

                    instance = labels.get("instance", "")
                    job      = labels.get("job", "")
                    device   = labels.get("device", "")

                    location_parts = []
                    if instance:
                        location_parts.append(f"Instance: {instance}")
                    if job:
                        location_parts.append(f"Job: {job}")
                    if device:
                        location_parts.append(f"Device: {device}")
                    location_text = " | ".join(location_parts) if location_parts else "N/A"

                    base_avg_text    = format_number(round(base_avg, 2)) if base_avg is not None else "N/A"
                    base_change_text = f"{round(base_change, 2)}%" if base_change is not None else "N/A"

                    # Determine direction from actual values
                    try:
                        is_rising = float(curr_val) > float(m.get("yesterday_value", 0))
                    except (TypeError, ValueError):
                        is_rising = True
                    direction_word = "increased" if is_rising else "decreased"
                    direction_noun = "increase"  if is_rising else "decrease"

                    change_pct   = m.get("change_percentage", 0)
                    status_lower = m.get("status", "").lower()
                    deviation    = abs(base_change) if base_change is not None else None

                    yesterday_display = format_number(m.get("yesterday_value", "N/A"))
                    current_display   = format_number(curr_val)

                    # ── Root cause: data-driven narrative ───────────────────
                    if base_avg is None:
                        root_cause_narrative = (
                            f"Value {direction_word} {change_pct:.2f}% vs yesterday "
                            f"({yesterday_display} → {current_display}). "
                            f"No baseline history available yet to compare against normal behavior."
                        )
                    elif isinstance(base_avg, (int, float)) and abs(base_avg) < 0.001:
                        root_cause_narrative = (
                            f"Value {direction_word} {change_pct:.2f}% vs yesterday "
                            f"({yesterday_display} → {current_display}). "
                            f"Baseline average is near zero — deviation percentage is unreliable."
                        )
                    else:
                        above_below = "above" if base_change > 0 else "below"
                        root_cause_narrative = (
                            f"Value {direction_word} {change_pct:.2f}% vs yesterday "
                            f"({yesterday_display} → {current_display}). "
                            f"This is {abs(round(base_change, 2))}% {above_below} "
                            f"the historical average of {base_avg_text}."
                        )

                    root_cause_text = (
                        f"{root_cause_narrative}\n"
                        f"Location: {location_text}"
                    )

                    # ── Action: based on alert numbers only ─────────────────
                    if base_avg is None:
                        if change_pct > 50:
                            action_text = (
                                f"Large {direction_noun} ({change_pct:.2f}%) vs yesterday with no baseline established yet. "
                                f"Monitor closely for 2-3 more cycles before drawing conclusions."
                            )
                        else:
                            action_text = (
                                f"No baseline history yet — normal behavior will be established after a few more alert cycles. "
                                f"No immediate action required."
                            )
                    elif isinstance(base_avg, (int, float)) and abs(base_avg) < 0.001:
                        action_text = (
                            "Baseline average is near zero — deviation percentage is not reliable. "
                            "Verify the metric is reporting valid data before taking any action."
                        )
                    else:
                        target = f"on {instance}" if instance else "on this system"
                        above_below = "above" if base_change > 0 else "below"
                        if deviation is not None and deviation > 100:
                            action_text = (
                                f"Extreme anomaly: value is {deviation:.2f}% {above_below} historical average. "
                                f"This is highly abnormal behavior. "
                                f"Immediate investigation required {target} — "
                                f"check for incidents, runaway processes, or misconfigurations."
                            )
                        elif deviation is not None and deviation > 50:
                            action_text = (
                                f"Severe deviation ({deviation:.2f}% {above_below} baseline). "
                                f"Investigate what changed in the last 24 hours {target}. "
                                f"Compare with related metrics from the same instance to identify the root cause."
                            )
                        elif deviation is not None and deviation > 25:
                            action_text = (
                                f"Significant {direction_noun} of {change_pct:.2f}% vs yesterday, "
                                f"{deviation:.2f}% {above_below} baseline. "
                                f"Review recent deployments or configuration changes {target}."
                            )
                        else:
                            if status_lower == "critical":
                                action_text = (
                                    f"Value crossed the critical threshold with a {change_pct:.2f}% {direction_noun}. "
                                    f"Monitor the next cycle — if the trend continues, escalate investigation {target}."
                                )
                            else:
                                action_text = (
                                    f"Minor {direction_noun} of {change_pct:.2f}% vs yesterday "
                                    f"({deviation:.2f}% {above_below} baseline). "
                                    f"Monitor the next alert cycle to confirm whether this is a growing trend."
                                )

                    adf_content.append({
                        "type": "heading",
                        "attrs": {"level": 3},
                        "content": [{"type": "text", "text": m_name}]
                    })
                    adf_content.append({
                        "type": "bulletList",
                        "content": [
                            {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": root_cause_text}]}]},
                            {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": f"Recommended Action: {action_text}"}]}]}
                        ]
                    })

            description = {
                "version": 1,
                "type": "doc",
                "content": adf_content
            }

            ticket_data = {
                "fields": {
                    "project": {"key": JIRA_PROJECT_KEY},
                    "summary": summary,
                    "description": description,
                    "issuetype": {"name": "Task"}
                }
            }

            response = requests.post(
                f"{self.base_url}/rest/api/3/issue",
                json=ticket_data,
                auth=self.auth,
                headers=self.headers
            )

            if response.status_code == 201:
                return {"success": True, "ticket_key": response.json()["key"]}
            else:
                return {"success": False, "error": response.text}

        except Exception as e:
            return {"success": False, "error": str(e)}

def process_grouped_alerts():
    global critical_metrics_store

    with store_lock:
        if not critical_metrics_store:
            return

        logger.info("PROCESSING GROUPED ALERTS...")

        groups_snapshot = critical_metrics_store.copy()
        critical_metrics_store.clear()

    for group_key, group_info in groups_snapshot.items():
        try:
            now = datetime.now()

            if group_key in last_ticket_per_group:
                last_time = last_ticket_per_group[group_key]
                if now - last_time < timedelta(minutes=10):
                    logger.info(f"Skipping ticket (cooldown active): {group_key}")
                    continue

            logger.info(f"Creating ONE ticket for group: {group_key}")

            result = jira_client.create_grouped_ticket(group_info)

            if result.get("success"):
                logger.info(f"TICKET CREATED: {result['ticket_key']}")
                last_ticket_per_group[group_key] = now
            else:
                logger.error(f"FAILED GROUP: {group_key}")

        except Exception as e:
            logger.error(f"ERROR in grouped processing: {str(e)}")

def start_batch_scheduler():
    def loop():
        while True:
            try:
                process_grouped_alerts()
                time.sleep(30)
            except Exception as e:
                logger.error(f"SCHEDULER ERROR: {str(e)}")
                time.sleep(30)

    t = threading.Thread(target=loop, daemon=True)
    t.start()

# Initialize JIRA client
jira_client = JiraClient()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    logger.info("Health check requested")
    return jsonify({
        "status": "healthy",
        "service": "OpSight JIRA Alert Service",
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/v1/query', methods=['GET'])
def prometheus_query():
    try:
        query = request.args.get('query')
        source = request.args.get('source', 'vcenter-prom')
        time_param = request.args.get('time')  

        base_url = DATA_SOURCES.get(source)

        if not base_url:
            return jsonify({"error": f"Invalid data source: {source}"}), 400

        # Build params dynamically
        params = {"query": query}
        if time_param:
            params["time"] = time_param

        response = requests.get(
            f"{base_url}/api/v1/query",
            params=params,
            timeout=10 
        )

        return jsonify(response.json())

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/v1/label/<label_name>/values', methods=['GET'])
def prometheus_label_values(label_name):
    try:
        source = request.args.get('source', 'vcenter-prom')
        base_url = DATA_SOURCES.get(source)

        print("SOURCE:", source)
        print("BASE URL:", base_url)

        if not base_url:
            return jsonify({"error": f"Invalid data source: {source}"}), 400

        response = requests.get(
            f"{base_url}/api/v1/label/{label_name}/values"
        )

        return jsonify(response.json())

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/v1/metadata', methods=['GET'])
def prometheus_metadata():
    try:
        source = request.args.get('source', 'vcenter-prom')
        base_url = DATA_SOURCES.get(source)

        if not base_url:
            return jsonify({"error": f"Invalid data source: {source}"}), 400

        response = requests.get(f"{base_url}/api/v1/metadata")

        return jsonify(response.json())

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/critical-metrics', methods=['GET'])
def get_critical_metrics():
    """Get current critical metrics status"""
    try:
        global critical_metrics_store
        return jsonify({
            "success": True,
            "critical_metrics_count": len(critical_metrics_store),
            "critical_metrics": critical_metrics_store,
            "last_hourly_check": last_hourly_check.isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting critical metrics: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/alert', methods=['POST'])
def create_alert():
    """Create JIRA ticket for critical alert"""
    try:
        data = request.get_json()
        
        source = data.get('source', 'proxmox-prom')

        # Log incoming alert request
        logger.info("CRITICAL ALERT RECEIVED!")
        logger.info(f"Metric: {data.get('metric_name', 'Unknown')}")
        logger.info(f"Change: {data.get('change_percentage', 'Unknown')}%")
        logger.info(f"Thresholds: Warning {data.get('warning_threshold', 'Unknown')}%, Critical {data.get('critical_threshold', 'Unknown')}%")
        
        # Validate required fields
        required_fields = ['metric_name', 'current_value', 'yesterday_value', 'change_percentage', 'labels']
        for field in required_fields:
            if field not in data:
                logger.error(f" Missing required field: {field}")
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        # Add threshold information
        alert_data = {
            **data,
            "source": source,
            "warning_threshold": data.get('warning_threshold', 15),
            "critical_threshold": data.get('critical_threshold', 25),
            "timestamp": datetime.now().isoformat()
        }

        # Query Prometheus for multi-week baseline (7, 14, 21 days ago)
        now = datetime.now()
        baseline_avg, std_dev = fetch_prometheus_baseline(
            source=alert_data["source"],
            metric_name=alert_data["metric_name"],
            labels=alert_data.get("labels", {}),
            now=now
        )

        current_value = alert_data["current_value"]
        status, change_pct, z_score = calculate_status(current_value, baseline_avg, std_dev)

        if baseline_avg is None:
            n_weeks = 0
        elif std_dev is None:
            n_weeks = 1
        else:
            n_weeks = 3

        explanation = explain_baseline(
            metric_name=alert_data["metric_name"],
            baseline_avg=baseline_avg,
            change_pct=change_pct,
            std_dev=std_dev,
            z_score=z_score,
            n_weeks=n_weeks
        )

        alert_data["baseline_avg"]    = baseline_avg
        alert_data["baseline_change"] = change_pct
        alert_data["std_dev"]         = std_dev
        alert_data["z_score"]         = z_score
        alert_data["explanation"]     = explanation
        alert_data["status"]          = status

        group_key = f"{alert_data['source']}_{alert_data.get('category', 'general')}"
        current_time = datetime.now()
        
        with store_lock:
            if group_key not in critical_metrics_store:
                logger.info(f"Creating NEW group: {group_key}")

                critical_metrics_store[group_key] = {
                    "category": alert_data.get("category", "general"),
                    "source": alert_data["source"],
                    "metrics": []
                }

            logger.info(f"Adding metric to group: {group_key}")

            existing_metrics = critical_metrics_store[group_key]["metrics"]

            if not any(
                m["metric_name"] == alert_data["metric_name"] and m["labels"] == alert_data["labels"]
                for m in existing_metrics
            ):
                existing_metrics.append(alert_data)

        return jsonify({
            "success": True,
            "queued": True,
            "group_key": group_key
        })
            
    except Exception as e:
        logger.error("CRITICAL ERROR PROCESSING ALERT!")
        logger.error(f"Exception: {str(e)}")
        logger.error("=" * 50)
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500

if __name__ == '__main__':
    logger.info("Starting OpSight JIRA Alert Service...")
    logger.info("=" * 50)
    
    # Start the batch scheduler
    start_batch_scheduler()
    
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)
