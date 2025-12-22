# Quick Start Guide - W3C Trace Context Extension

## Deploy in 3 Steps (5 Minutes)

### Step 1: Upload to Cloud Manager
1. Login to Cloud Manager: `https://<cloud-manager-host>/admin`
2. Navigate: **Resources** → **Gateway Extensions**
3. Click **Add** → **Gateway Extension**
4. Upload: `trace-context-extension.zip`
5. Click **Save**

### Step 2: Enable on Gateway
1. Navigate: **Resources** → **Availability Zones** → **Gateway Services**
2. Select your gateway service
3. Click **Extensions** tab → **Edit**
4. Enable: **W3C Trace Context Extension**
5. Click **Save**

### Step 3: Test
```bash
curl -v https://your-gateway:9443/api/v1/test

# Look for response headers:
# X-Trace-Id: [32 hex chars]
# X-Correlation-ID: [UUID]
```

---

## What You Get

**Every API request automatically includes:**
```http
traceparent: 00-550e8400e29b41d4a716446655440000-b7ad6b7169203331-01
tracestate: apic=550e8400-e29b-41d4-a716-446655440000
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
```

**Every API response includes:**
```http
X-Trace-Id: 550e8400e29b41d4a716446655440000
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
```

---

## Key Features

✅ **Zero API Changes** - Works with all existing APIs  
✅ **W3C Standards** - Compatible with Datadog, Splunk, Jaeger, etc.  
✅ **High Performance** - <1ms overhead per request  
✅ **Automatic** - No configuration needed  

---

## CLI Alternative

```bash
# Login
apic login --server <manager-host> --realm admin/default-idp-1

# Upload extension
apic extensions:create trace-context-extension.zip --scope org

# Enable on gateway
apic gateway-extensions:set \
  --gateway-service <gateway-name> \
  --extension trace-context \
  --enabled true
```

---

## Troubleshooting

**Headers not showing?**
1. Check gateway logs: **Dashboard** → **Gateway Services** → **Logs**
2. Filter for: `[Trace Context]`
3. Verify extension is enabled on correct gateway

**Need to disable?**
1. **Resources** → **Gateway Services** → Select gateway
2. **Extensions** → **Edit**
3. Toggle extension **OFF**

---

## Documentation

- **README.md** - Complete overview and configuration
- **CLOUD-MANAGER-DEPLOYMENT.md** - Detailed deployment steps
- **extension.json** - Extension manifest
- **trace-context-request.js** - Request processing logic
- **trace-context-response.js** - Response processing logic

---

## What's Next?

1. **Integrate observability tools** - Configure APM/tracing platforms
2. **Create dashboards** - Visualize distributed traces
3. **Update documentation** - Share trace ID format with teams

---

## Questions?

Review the full documentation in README.md or check gateway logs for troubleshooting.
