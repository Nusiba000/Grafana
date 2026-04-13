from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
from datetime import datetime, timedelta
import logging
import threading
import time


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

# JIRA Configuration
JIRA_URL = os.getenv('JIRA_URL', 'https://omandatapark-sandbox-811.atlassian.net')
JIRA_USERNAME = os.getenv('JIRA_USERNAME', 'halhaddabi@omandatapark.com')
JIRA_API_TOKEN = os.getenv('JIRA_API_TOKEN', 'ATATT3xFfGF02Y1ODUJZBPhiomIm1FvVFwSdun5K3-DGJmwwZNykTYwxXKd6NkWcUJTUPBi4ZhKMw3_pAfpmlCre2b3kjlQhoRB6AeqktlbOvc-lurff2Jbh9D4cqzbb50bX42_UC4YGZNR073s3bgGZwDboEBLHxe0QALIA-vEgfbYL86W_9r8=876C8C00')
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
        
        for metric_key, metric_info in critical_metrics_store.items():
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
                    "type": "listItem",
                    "content": [{
                        "type": "paragraph",
                        "content": [{
                            "type": "text",
                            "text": f"Data Source: {alert_data.get('source', 'unknown')}"
                        }]
                    }]
                },
                {
                    "type": "bulletList",
                    "content": [
                        {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Source: ODP Main Prometheus Instance"}]}]},
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

def update_critical_metrics_store(alert_data, status):
    """Update the global store with critical metric information"""
    global critical_metrics_store
    
    # Create a unique key for the metric
    metric_key = f"{alert_data['metric_name']}_{hash(str(alert_data['labels']))}"
    
    if status == 'critical':
        # Store or update critical metric info
        critical_metrics_store[metric_key] = {
            'metric_name': alert_data['metric_name'],
            'current_value': alert_data['current_value'],
            'yesterday_value': alert_data['yesterday_value'],
            'change_percentage': alert_data['change_percentage'],
            'labels': alert_data['labels'],
            'warning_threshold': alert_data['warning_threshold'],
            'critical_threshold': alert_data['critical_threshold'],
            'status': status,
            'first_critical_time': datetime.now(),
            'persistent_hours': 0,
            'last_ticket_time': datetime.now().isoformat()
        }
        logger.info(f"Added/Updated critical metric in store: {metric_key}")
    else:
        # Remove from store if no longer critical
        if metric_key in critical_metrics_store:
            del critical_metrics_store[metric_key]
            logger.info(f"Removed metric from critical store (no longer critical): {metric_key}")

def start_hourly_scheduler():
    """Start the hourly scheduler in a background thread"""
    def scheduler_loop():
        jira_client = JiraClient()
        while True:
            try:
                jira_client.check_and_create_hourly_tickets()
                time.sleep(60)  # Check every minute (but only process if hour has passed)
            except Exception as e:
                logger.error(f"Error in hourly scheduler: {str(e)}")
                time.sleep(60)
    
    scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    scheduler_thread.start()
    logger.info("Hourly scheduler started in background thread")

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

        base_url = DATA_SOURCES.get(source)

        if not base_url:
            return jsonify({"error": f"Invalid data source: {source}"}), 400

        response = requests.get(
            f"{base_url}/api/v1/query",
            params={"query": query}
        )

        return jsonify(response.json())

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/v1/label/<label_name>/values', methods=['GET'])
def prometheus_label_values(label_name):
    try:
        source = request.args.get('source', 'vcenter-prom')
        base_url = DATA_SOURCES.get(source)

        if not base_url:
            return jsonify({"error": f"Invalid data source: {source}"}), 400

        response = requests.get(
            f"{base_url}/api/v1/label/{label_name}/values"
        )

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
                logger.error(f"❌ Missing required field: {field}")
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
        
        # BACKEND SAFETY NET: Check if we already created a ticket for this exact metric+labels in the last 5 minutes
        metric_key = f"{alert_data['metric_name']}_{hash(str(alert_data['labels']))}"
        current_time = datetime.now()
        
        # Check if we have a recent ticket for this metric+labels combination
        if metric_key in critical_metrics_store:
            last_ticket_time = critical_metrics_store[metric_key].get('last_ticket_time')
            if last_ticket_time:
                last_ticket_time = datetime.fromisoformat(last_ticket_time)
                time_diff = current_time - last_ticket_time
                
                # If less than 5 minutes, reject the duplicate
                if time_diff.total_seconds() < 300:  # 5 minutes = 300 seconds
                    logger.warning(f"DUPLICATE ALERT REJECTED: {metric_key} - Last ticket was {time_diff.total_seconds():.1f} seconds ago")
                    return jsonify({
                        "success": False,
                        "error": "Duplicate alert rejected - ticket already created recently"
                    }), 429  # Too Many Requests
        
        logger.info("Creating JIRA ticket...")
        
        # Update critical metrics store with timestamp
        update_critical_metrics_store(alert_data, 'critical')
        
        # Create JIRA ticket
        result = jira_client.create_ticket(alert_data)
        
        if result['success']:
            logger.info("JIRA TICKET CREATED SUCCESSFULLY!")
            logger.info(f"Ticket Key: {result['ticket_key']}")
            logger.info(f"Ticket URL: {result['ticket_url']}")
            logger.info("=" * 50)
            
            # Update the last ticket time for this metric
            if metric_key in critical_metrics_store:
                critical_metrics_store[metric_key]['last_ticket_time'] = current_time.isoformat()
            
            return jsonify(result)
        else:
            logger.error("FAILED TO CREATE JIRA TICKET!")
            logger.error(f"Error: {result['error']}")
            logger.error("=" * 50)
            return jsonify(result), 500
            
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
    
    # Start the hourly scheduler
    start_hourly_scheduler()
    
    app.run(debug=True, host='0.0.0.0', port=5000)
