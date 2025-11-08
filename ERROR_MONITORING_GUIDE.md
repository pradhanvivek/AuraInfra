# Error Monitoring & Alerting System

## Overview
An automated error monitoring system has been implemented to track and alert on endpoint failures in real-time.

## Features

### 1. Automatic Error Tracking
- Monitors all API endpoints for 5xx status codes
- Tracks errors within a 5-minute sliding window
- Resets counters on successful requests

### 2. Alert Threshold
- **Trigger**: 5 failed requests to the same endpoint within 5 minutes
- **Action**: Critical alert logged to backend error logs
- **Auto-Clear**: Alert automatically clears when endpoint recovers

### 3. Alert Format
```
╔══════════════════════════════════════════════════════════════╗
║  🚨 CRITICAL ALERT: HIGH ERROR RATE DETECTED                 ║
╠══════════════════════════════════════════════════════════════╣
║  Endpoint: POST /api/vehicles/scan                           ║
║  Error Count: 7 errors in last 5 minutes                     ║
║  Threshold: 5 errors                                         ║
║  Status: REQUIRES IMMEDIATE ATTENTION                        ║
╚══════════════════════════════════════════════════════════════╝
```

## How to Monitor

### Check Backend Logs for Alerts
```bash
# View recent alerts
tail -n 100 /var/log/supervisor/backend.err.log | grep "CRITICAL ALERT"

# Monitor in real-time
tail -f /var/log/supervisor/backend.err.log | grep --line-buffered "CRITICAL ALERT\|ALERT CLEARED"
```

### Alert States

**🚨 ALERT TRIGGERED**
- Endpoint has failed 5+ times in 5 minutes
- Requires immediate investigation
- Check logs for specific error messages

**✅ ALERT CLEARED**
- Endpoint is functioning normally again
- Successful requests reset the counter
- Logged for tracking recovery time

## Configuration

### Adjust Alert Threshold
Edit `/app/backend/server.py`:
```python
# Change threshold (default: 5)
app.add_middleware(ErrorMonitoringMiddleware, alert_threshold=5)
```

### Adjust Time Window
Edit the middleware class:
```python
self.window_duration = 300  # 5 minutes in seconds
```

## Integration Options

The system is designed to be extended with external alerting:

### Slack Integration (Example)
```python
async def trigger_alert(self, endpoint: str, error_count: int):
    # Existing logging
    logger.error(alert_message)
    
    # Add Slack webhook
    await send_to_slack(alert_message)
```

### Email Alerts (Example)
```python
async def trigger_alert(self, endpoint: str, error_count: int):
    # Existing logging
    logger.error(alert_message)
    
    # Add email notification
    await send_email_alert(endpoint, error_count)
```

### PagerDuty Integration (Example)
```python
async def trigger_alert(self, endpoint: str, error_count: int):
    # Existing logging
    logger.error(alert_message)
    
    # Add PagerDuty alert
    await trigger_pagerduty_incident(endpoint, error_count)
```

## Benefits

1. **Early Detection**: Catches issues before they impact many users
2. **Automatic Recovery Tracking**: Know when issues are resolved
3. **Endpoint-Specific**: Pinpoints exactly which API is failing
4. **No Manual Monitoring**: Automatic alerting reduces response time
5. **Sliding Window**: Avoids alert fatigue from transient errors

## Best Practices

1. **Respond Quickly**: Alerts indicate active user-facing issues
2. **Check Recent Changes**: Look for recent deployments or code changes
3. **Review Error Logs**: Check specific error messages for the endpoint
4. **Test After Fixing**: Verify the alert clears after fix is deployed
5. **Document Patterns**: Track recurring issues for long-term fixes

## Common Alert Scenarios

### AI Scanning Endpoints
- **Likely Cause**: Invalid image format, API key issues
- **Quick Fix**: Check base64 encoding, validate API keys

### Authentication Endpoints
- **Likely Cause**: JWT token issues, database connectivity
- **Quick Fix**: Verify JWT secret, check MongoDB connection

### Document Upload Endpoints
- **Likely Cause**: File size limits, base64 encoding issues
- **Quick Fix**: Check file size, validate base64 data

## Monitoring Status

Current monitoring is **ACTIVE** on all endpoints with:
- Alert Threshold: **5 errors**
- Time Window: **5 minutes**
- Alert Clearing: **Automatic on success**
