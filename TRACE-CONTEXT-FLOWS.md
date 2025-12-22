# Trace Context Flow - Complete Reference

## Overview

This extension handles **all scenarios** for trace context propagation:
1. Client sends existing `traceparent` → Preserve and enhance
2. Client sends no `traceparent` → Generate from APIC correlation ID
3. DataPower logs use W3C trace ID (not APIC correlation ID)
4. Both IDs available for correlation queries

---

## Scenario 1: Client Sends Existing Trace Context

### Flow Diagram
```
External Client (with distributed tracing)
    │
    │ traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
    │ tracestate: vendor1=value1
    ↓
┌─────────────────────────────────────────────────────┐
│  Gateway Extension (Request Handler)                │
│                                                      │
│  1. Detect existing traceparent                     │
│  2. Validate format                                 │
│  3. Preserve client's traceparent (unchanged)       │
│  4. Enhance tracestate with APIC correlation        │
│     tracestate: vendor1=value1,apic=550e8400-...    │
│  5. Set DataPower transaction-id = trace-id         │
│     (0af7651916cd43dd8448eb211c80319c)              │
│                                                      │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  DataPower Logs                                      │
│  Transaction ID: 0af7651916cd43dd8448eb211c80319c   │ ← W3C trace ID
│  APIC Correlation: 550e8400-e29b-41d4-a716-...      │ ← Stored separately
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  API Policies Execute                                │
│  (See both traceparent and X-Global-Transaction-ID) │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  Backend Service                                     │
│  Receives:                                           │
│    traceparent: 00-0af7651916cd...                  │ ← Original from client
│    tracestate: vendor1=value1,apic=550e8400-...     │ ← Enhanced
│    X-Correlation-ID: 0af7651916cd...                │ ← Trace ID
│    X-Global-Transaction-ID: 0af7651916cd...         │ ← Same as trace ID
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  Gateway Extension (Response Handler)                │
│                                                      │
│  Response Headers:                                   │
│    X-Trace-Id: 0af7651916cd43dd8448eb211c80319c    │ ← W3C trace ID
│    X-Correlation-ID: 0af7651916cd...                │ ← W3C trace ID
│    X-APIC-Correlation-ID: 550e8400-e29b-...         │ ← Original APIC ID
└─────────────────────────────────────────────────────┘
    ↓
External Client
```

### Key Points
✓ Client's trace context is **preserved** (not replaced)  
✓ APIC correlation ID is **added to tracestate** for bi-directional lookup  
✓ DataPower logs use **W3C trace ID** for consistency with distributed tracing  
✓ Both IDs are **available** for correlation queries  

---

## Scenario 2: Client Sends No Trace Context

### Flow Diagram
```
Client (no distributed tracing)
    │
    │ [No traceparent header]
    ↓
┌─────────────────────────────────────────────────────┐
│  APIC Gateway                                        │
│  Generates: X-Global-Transaction-ID                 │
│    550e8400-e29b-41d4-a716-446655440000             │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  Gateway Extension (Request Handler)                │
│                                                      │
│  1. No traceparent detected                         │
│  2. Get APIC correlation ID                         │
│     550e8400-e29b-41d4-a716-446655440000            │
│  3. Normalize to W3C trace-id                       │
│     550e8400e29b41d4a716446655440000 (32 hex)       │
│  4. Generate span-id (random 16 hex)                │
│     b7ad6b7169203331                                │
│  5. Create traceparent                              │
│     00-550e8400e29b41d4a716446655440000-            │
│        b7ad6b7169203331-01                          │
│  6. Create tracestate                               │
│     apic=550e8400-e29b-41d4-a716-446655440000       │
│  7. Set DataPower transaction-id = trace-id         │
│     (550e8400e29b41d4a716446655440000)              │
│                                                      │
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  DataPower Logs                                      │
│  Transaction ID: 550e8400e29b41d4a716446655440000   │ ← W3C trace ID
│  APIC Correlation: 550e8400-e29b-41d4-a716-...      │ ← Original with hyphens
└─────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────┐
│  Backend Service                                     │
│  Receives:                                           │
│    traceparent: 00-550e8400e29b41d4a716...          │ ← Generated
│    tracestate: apic=550e8400-e29b-41d4-a716-...     │ ← APIC ID preserved
│    X-Correlation-ID: 550e8400e29b41d4a716...        │ ← Trace ID
│    X-Global-Transaction-ID: 550e8400e29b...         │ ← Same as trace ID
└─────────────────────────────────────────────────────┘
```

### Key Points
✓ W3C trace context is **generated** from APIC correlation ID  
✓ Trace ID is **deterministic** (same APIC ID → same trace ID)  
✓ Original APIC correlation ID is **preserved in tracestate**  
✓ DataPower logs use **W3C trace ID** consistently  

---

## DataPower Transaction ID Behavior

### Before This Extension
```
DataPower Variable: var://service/transaction-id
Value: 550e8400-e29b-41d4-a716-446655440000 (APIC generated UUID)

DataPower Logs:
[2024-12-22 01:30:45] [550e8400-e29b-41d4-a716-446655440000] API request received
[2024-12-22 01:30:45] [550e8400-e29b-41d4-a716-446655440000] Invoking backend
```

### After This Extension
```
DataPower Variable: var://service/transaction-id
Value: 550e8400e29b41d4a716446655440000 (W3C trace ID - no hyphens)

DataPower Logs:
[2024-12-22 01:30:45] [550e8400e29b41d4a716446655440000] API request received
[2024-12-22 01:30:45] [550e8400e29b41d4a716446655440000] Invoking backend

Original APIC ID stored separately:
var://context/trace/apic-correlation-id = 550e8400-e29b-41d4-a716-446655440000
```

### Why This Matters

**Unified Logging:**
- All logs (DataPower, application, APM) use the **same trace ID**
- No mental conversion between UUID format and trace ID format
- Direct copy-paste from APM tool to DataPower logs

**Query Examples:**

```bash
# Splunk - Single query finds everything
index=* trace_id="550e8400e29b41d4a716446655440000"
| stats count by source

# Results show:
# - DataPower gateway logs
# - Backend service logs  
# - Database logs
# - APM traces
# ALL with the same ID
```

---

## Header Reference

### Request Headers (to Backend)

| Header | Source | Example | Purpose |
|--------|--------|---------|---------|
| `traceparent` | Generated or preserved | `00-550e8400e29b41d4a716446655440000-b7ad6b7169203331-01` | W3C distributed trace ID |
| `tracestate` | Enhanced with APIC ID | `apic=550e8400-e29b-41d4-a716-446655440000` | Vendor metadata including APIC correlation |
| `X-Correlation-ID` | Set to trace ID | `550e8400e29b41d4a716446655440000` | Legacy compatibility |
| `X-Global-Transaction-ID` | Same as trace ID | `550e8400e29b41d4a716446655440000` | APIC compatibility |

### Response Headers (to Client)

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Trace-Id` | `550e8400e29b41d4a716446655440000` | W3C trace ID for client correlation |
| `X-Correlation-ID` | `550e8400e29b41d4a716446655440000` | Primary correlation ID (trace ID) |
| `X-APIC-Correlation-ID` | `550e8400-e29b-41d4-a716-446655440000` | Original APIC UUID (with hyphens) |

### DataPower Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `var://service/transaction-id` | `550e8400e29b41d4a716446655440000` | **OVERRIDDEN** - Now uses trace ID |
| `var://context/trace/apic-correlation-id` | `550e8400-e29b-41d4-a716-446655440000` | Original APIC correlation ID (preserved) |
| `var://context/trace/traceparent` | `00-550e8400e29b...` | Full traceparent header |
| `var://context/trace/trace-id` | `550e8400e29b41d4a716446655440000` | Extracted trace ID |
| `var://context/trace/span-id` | `b7ad6b7169203331` | Extracted span ID |

---

## Correlation Scenarios

### Scenario 1: Query by W3C Trace ID

**User has trace ID from APM tool:**
```
Trace ID from Datadog: 550e8400e29b41d4a716446655440000
```

**Query DataPower logs:**
```bash
# DataPower logs use this as transaction ID
show log default | include "550e8400e29b41d4a716446655440000"
```

**Query Splunk:**
```spl
index=* "550e8400e29b41d4a716446655440000"
| stats count by source, api_name
```

**Result:** Finds all logs across entire stack ✓

### Scenario 2: Query by Original APIC Correlation ID

**User has APIC correlation ID from legacy system:**
```
APIC Correlation ID: 550e8400-e29b-41d4-a716-446655440000
```

**Convert to trace ID (remove hyphens):**
```
Trace ID: 550e8400e29b41d4a716446655440000
```

**Or query by APIC ID directly in tracestate:**
```spl
index=* apic_correlation_id="550e8400-e29b-41d4-a716-446655440000"
```

**Result:** Finds all logs that included tracestate ✓

### Scenario 3: Bidirectional Lookup

**Given W3C trace ID, find original APIC ID:**
```bash
# Look in response headers
curl -v https://gateway:9443/api/... | grep X-APIC-Correlation-ID

# Or check tracestate
curl -v https://gateway:9443/api/... | grep tracestate
# tracestate: apic=550e8400-e29b-41d4-a716-446655440000
```

**Given APIC ID, find W3C trace ID:**
```bash
# Remove hyphens
echo "550e8400-e29b-41d4-a716-446655440000" | tr -d '-'
# Result: 550e8400e29b41d4a716446655440000
```

---

## Observability Tool Configuration

### Datadog APM

**Configuration:**
```yaml
# Datadog agent configuration
apm_config:
  # Read W3C Trace Context headers
  trace_context_propagation_enabled: true
  
logs_config:
  # Correlate logs with traces using trace_id
  processing_rules:
    - type: trace_correlation
      name: correlate_trace_id
```

**Query:**
```
# Find trace
trace_id:550e8400e29b41d4a716446655440000

# Find correlated logs
@trace_id:550e8400e29b41d4a716446655440000
```

### Splunk

**Field Extraction:**
```
# Extract trace_id from DataPower logs
EXTRACT-trace_id = \[(?<trace_id>[0-9a-f]{32})\]

# Extract from traceparent
EXTRACT-traceparent = traceparent:\s*00-(?<trace_id>[0-9a-f]{32})-

# Extract APIC ID from tracestate
EXTRACT-apic_id = apic=(?<apic_correlation_id>[0-9a-f-]+)
```

**Query:**
```spl
# By trace ID
index=* trace_id="550e8400e29b41d4a716446655440000"

# By APIC correlation ID
index=* apic_correlation_id="550e8400-e29b-41d4-a716-446655440000"

# Both (OR query)
index=* (trace_id="550e8400e29b41d4a716446655440000" OR apic_correlation_id="550e8400-e29b-41d4-a716-446655440000")
```

### Elasticsearch

**Index Mapping:**
```json
{
  "mappings": {
    "properties": {
      "trace_id": { "type": "keyword" },
      "apic_correlation_id": { "type": "keyword" },
      "transaction_id": { "type": "keyword" }
    }
  }
}
```

**Query:**
```json
{
  "query": {
    "bool": {
      "should": [
        { "term": { "trace_id": "550e8400e29b41d4a716446655440000" }},
        { "term": { "apic_correlation_id": "550e8400-e29b-41d4-a716-446655440000" }},
        { "term": { "transaction_id": "550e8400e29b41d4a716446655440000" }}
      ],
      "minimum_should_match": 1
    }
  }
}
```

---

## Migration Considerations

### Existing Dashboards

**Issue:** Dashboards may query by APIC correlation ID (UUID format with hyphens)

**Solution Options:**

1. **Update queries to use trace ID:**
   ```spl
   # Old
   transaction_id="550e8400-e29b-41d4-a716-446655440000"
   
   # New (remove hyphens)
   transaction_id="550e8400e29b41d4a716446655440000"
   ```

2. **Use OR queries for transition period:**
   ```spl
   (transaction_id="550e8400e29b41d4a716446655440000" OR 
    apic_correlation_id="550e8400-e29b-41d4-a716-446655440000")
   ```

3. **Add field alias in Splunk:**
   ```
   # In props.conf
   FIELDALIAS-apic_to_trace = apic_correlation_id AS transaction_id
   ```

### Existing Integrations

**Systems that expect APIC correlation ID:**

✓ Still available in `X-APIC-Correlation-ID` response header  
✓ Still available in `tracestate` header  
✓ Stored in `var://context/trace/apic-correlation-id`  

**Example - Legacy system integration:**
```javascript
// Backend service that expects APIC UUID
const apicId = request.headers['x-apic-correlation-id'];
// OR extract from tracestate
const tracestate = request.headers['tracestate'];
const apicId = tracestate.match(/apic=([0-9a-f-]+)/)[1];
```

---

## Benefits Summary

### Unified Logging
✓ All logs use same trace ID format  
✓ No conversion needed between systems  
✓ Direct copy-paste from APM to logs  

### Standards Compliance
✓ W3C Trace Context specification  
✓ OpenTelemetry compatible  
✓ Works with all major APM tools  

### Backward Compatibility
✓ Original APIC ID preserved  
✓ Available for legacy integrations  
✓ Gradual migration path  

### Operational Excellence
✓ Single ID across entire trace  
✓ Faster troubleshooting (one query finds all)  
✓ Better correlation in distributed systems  

---

## Testing Both Scenarios

### Test 1: No Incoming Trace Context

```bash
curl -v https://gateway:9443/api/v1/test

# Response headers should show:
# X-Trace-Id: 550e8400e29b41d4a716446655440000 (no hyphens)
# X-Correlation-ID: 550e8400e29b41d4a716446655440000 (same as trace ID)
# X-APIC-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000 (with hyphens)
```

### Test 2: With Incoming Trace Context

```bash
curl -v https://gateway:9443/api/v1/test \
  -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \
  -H "tracestate: vendor1=value1"

# Response headers should show:
# X-Trace-Id: 0af7651916cd43dd8448eb211c80319c (from client)
# X-Correlation-ID: 0af7651916cd43dd8448eb211c80319c (same)
# X-APIC-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000 (APIC generated)

# Backend receives:
# traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01 (preserved)
# tracestate: vendor1=value1,apic=550e8400-e29b-41d4-a716-446655440000 (enhanced)
```

### Test 3: DataPower Logs

```bash
# Check DataPower logs show trace ID as transaction ID
# Cloud Manager → Dashboard → Gateway Services → Logs
# Filter for: [Trace Context]

Expected:
[2024-12-22 01:30:45] [550e8400e29b41d4a716446655440000] [Trace Context] Processing request...
[2024-12-22 01:30:45] [550e8400e29b41d4a716446655440000] [Trace Context] Transaction ID set to trace ID: 550e8400e29b41d4a716446655440000 (original APIC ID: 550e8400-e29b-41d4-a716-446655440000)
```

---

## Summary

This extension provides **complete trace context handling**:

✅ **Incoming trace contexts** - Preserved and enhanced  
✅ **Outgoing trace contexts** - Generated when missing  
✅ **DataPower logging** - Uses W3C trace ID  
✅ **APIC compatibility** - Original correlation ID preserved  
✅ **Bidirectional correlation** - Query by either ID  
✅ **Standards compliant** - W3C Trace Context spec  

**Result:** Unified observability across your entire API ecosystem.
