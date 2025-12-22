/**
 * W3C Trace Context Extension - Request Handler
 * 
 * Automatically bridges IBM API Connect correlation ID with W3C Trace Context
 * Executes at gateway level before any API policies
 * 
 * Features:
 * - Generates W3C traceparent from APIC correlation ID
 * - Enhances existing trace context with APIC metadata
 * - Maintains backward compatibility
 * - Stores trace metadata for downstream processing
 * 
 * @version 1.0.0
 */

var hm = require('header-metadata');
var sm = require('service-metadata');
var crypto = require('crypto');

// Configuration
var CONFIG = {
    // Set to true to include full traceparent in response headers (debugging)
    INCLUDE_TRACEPARENT_IN_RESPONSE: false,
    
    // Set to true for verbose logging (dev/test only)
    VERBOSE_LOGGING: false,
    
    // Trace flags: 01 = sampled, 00 = not sampled
    DEFAULT_TRACE_FLAGS: '01'
};

/**
 * Main entry point
 */
(function() {
    try {
        processTraceContext();
    } catch (error) {
        console.error('[Trace Context] Fatal error: ' + error.message);
        console.error('[Trace Context] Stack: ' + error.stack);
        // Continue request processing even if trace context fails
    }
})();

/**
 * Process trace context for the current request
 */
function processTraceContext() {
    // Get APIC's transaction ID (correlation ID)
    var apicCorrelationId = sm.getVar('var://service/transaction-id');
    
    if (!apicCorrelationId) {
        console.error('[Trace Context] APIC correlation ID not available');
        return;
    }
    
    logDebug('Processing request with APIC correlation ID: ' + apicCorrelationId);
    
    // Check for existing W3C traceparent from client
    var existingTraceparent = hm.current.get('traceparent');
    
    if (existingTraceparent) {
        handleExistingTrace(apicCorrelationId, existingTraceparent);
    } else {
        generateNewTrace(apicCorrelationId);
    }
    
    // Always propagate correlation ID for legacy systems
    hm.current.set('X-Correlation-ID', apicCorrelationId);
    
    // Store trace context in DataPower variables for logging and response
    storeTraceContext(apicCorrelationId);
    
    logInfo('Trace context configured successfully');
}

/**
 * Handle existing trace context from client
 */
function handleExistingTrace(apicCorrelationId, existingTraceparent) {
    logDebug('Client provided traceparent: ' + existingTraceparent);
    
    // Validate the traceparent format
    if (!isValidTraceparent(existingTraceparent)) {
        console.warn('[Trace Context] Invalid traceparent format, generating new: ' + existingTraceparent);
        generateNewTrace(apicCorrelationId);
        return;
    }
    
    // Enhance tracestate with APIC correlation ID
    var existingTracestate = hm.current.get('tracestate') || '';
    var apicEntry = 'apic=' + apicCorrelationId;
    
    var newTracestate;
    if (existingTracestate && existingTracestate.length > 0) {
        // Append to existing tracestate (comma-separated list)
        newTracestate = existingTracestate + ',' + apicEntry;
    } else {
        // Create new tracestate
        newTracestate = apicEntry;
    }
    
    hm.current.set('tracestate', newTracestate);
    logDebug('Enhanced tracestate: ' + newTracestate);
}

/**
 * Generate new W3C trace context from APIC correlation ID
 */
function generateNewTrace(apicCorrelationId) {
    // Convert APIC correlation ID to W3C trace-id (32 hex chars)
    var traceId = normalizeToTraceId(apicCorrelationId);
    
    // Generate span-id (16 hex chars)
    var spanId = generateSpanId();
    
    // Build traceparent: version-trace_id-parent_id-flags
    var traceparent = '00-' + traceId + '-' + spanId + '-' + CONFIG.DEFAULT_TRACE_FLAGS;
    
    // Set headers
    hm.current.set('traceparent', traceparent);
    
    // Create tracestate with APIC correlation ID
    var tracestate = 'apic=' + apicCorrelationId;
    hm.current.set('tracestate', tracestate);
    
    logDebug('Generated traceparent: ' + traceparent);
    logDebug('Generated tracestate: ' + tracestate);
}

/**
 * Store trace context in DataPower variables
 */
function storeTraceContext(apicCorrelationId) {
    var traceparent = hm.current.get('traceparent');
    
    if (traceparent) {
        var traceId = extractTraceId(traceparent);
        var spanId = extractSpanId(traceparent);
        
        // Store original APIC correlation ID
        sm.setVar('var://context/trace/apic-correlation-id', apicCorrelationId);
        
        // Store trace context components
        sm.setVar('var://context/trace/traceparent', traceparent);
        sm.setVar('var://context/trace/trace-id', traceId);
        sm.setVar('var://context/trace/span-id', spanId);
        
        // CRITICAL: Override DataPower's transaction ID with W3C trace ID
        // This ensures all DataPower logs use the trace ID instead of APIC correlation ID
        sm.setVar('var://service/transaction-id', traceId);
        
        logInfo('Transaction ID set to trace ID: ' + traceId + ' (original APIC ID: ' + apicCorrelationId + ')');
        logDebug('Stored trace context - TraceID: ' + traceId + ', SpanID: ' + spanId);
    }
}

/**
 * Normalize APIC correlation ID to W3C trace-id format
 * 
 * Input: UUID format (e.g., 550e8400-e29b-41d4-a716-446655440000)
 * Output: 32 hex characters (e.g., 550e8400e29b41d4a716446655440000)
 */
function normalizeToTraceId(correlationId) {
    // Remove hyphens and convert to lowercase
    var cleaned = correlationId.replace(/-/g, '').toLowerCase();
    
    // Remove any non-hex characters
    cleaned = cleaned.replace(/[^0-9a-f]/g, '');
    
    if (cleaned.length >= 32) {
        // Take first 32 characters
        return cleaned.substring(0, 32);
    } else if (cleaned.length > 0) {
        // Pad with SHA256 hash of original if too short
        var hash = crypto.createHash('sha256')
            .update(correlationId)
            .digest('hex');
        return (cleaned + hash).substring(0, 32);
    } else {
        // Fallback: generate from hash if no valid hex chars
        return crypto.createHash('sha256')
            .update(correlationId)
            .digest('hex')
            .substring(0, 32);
    }
}

/**
 * Generate random span-id (16 hex characters)
 */
function generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Extract trace-id from traceparent header
 * Format: version-trace_id-parent_id-flags
 */
function extractTraceId(traceparent) {
    if (!traceparent) return null;
    var parts = traceparent.split('-');
    return parts.length >= 2 ? parts[1] : null;
}

/**
 * Extract span-id from traceparent header
 */
function extractSpanId(traceparent) {
    if (!traceparent) return null;
    var parts = traceparent.split('-');
    return parts.length >= 3 ? parts[2] : null;
}

/**
 * Validate traceparent header format
 * Format: 00-{32 hex}-{16 hex}-{2 hex}
 */
function isValidTraceparent(traceparent) {
    if (!traceparent) return false;
    
    var parts = traceparent.split('-');
    if (parts.length !== 4) return false;
    
    // Check version (should be 00)
    if (parts[0] !== '00') return false;
    
    // Check trace-id (32 hex chars)
    if (!/^[0-9a-f]{32}$/i.test(parts[1])) return false;
    
    // Check span-id (16 hex chars)
    if (!/^[0-9a-f]{16}$/i.test(parts[2])) return false;
    
    // Check flags (2 hex chars)
    if (!/^[0-9a-f]{2}$/i.test(parts[3])) return false;
    
    return true;
}

/**
 * Logging helpers
 */
function logInfo(message) {
    console.info('[Trace Context] ' + message);
}

function logDebug(message) {
    if (CONFIG.VERBOSE_LOGGING) {
        console.debug('[Trace Context] ' + message);
    }
}
