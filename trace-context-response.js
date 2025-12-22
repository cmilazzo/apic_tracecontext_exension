/**
 * W3C Trace Context Extension - Response Handler
 * 
 * Adds trace context headers to API responses for debugging and observability
 * Executes at gateway level after API processing completes
 * 
 * Features:
 * - Adds trace ID to response headers
 * - Includes APIC correlation ID
 * - Logs request completion with trace context
 * 
 * @version 1.0.0
 */

var hm = require('header-metadata');
var sm = require('service-metadata');

// Configuration
var CONFIG = {
    // Set to true to include full traceparent in response (useful for debugging)
    INCLUDE_FULL_TRACEPARENT: false,
    
    // Set to false to disable response headers entirely
    ENABLED: true
};

/**
 * Main entry point
 */
(function() {
    try {
        if (CONFIG.ENABLED) {
            processTraceResponse();
        }
    } catch (error) {
        console.error('[Trace Context Response] Error: ' + error.message);
        // Continue response processing even if trace headers fail
    }
})();

/**
 * Add trace context headers to response
 */
function processTraceResponse() {
    // Retrieve stored trace context from request processing
    var apicCorrelationId = sm.getVar('var://context/trace/apic-correlation-id');
    var traceId = sm.getVar('var://context/trace/trace-id');
    var traceparent = sm.getVar('var://context/trace/traceparent');
    
    if (!apicCorrelationId && !traceId) {
        console.warn('[Trace Context Response] No trace context available');
        return;
    }
    
    // Add trace ID to response header
    if (traceId) {
        hm.response.set('X-Trace-Id', traceId);
    }
    
    // Add APIC correlation ID to response header
    if (apicCorrelationId) {
        hm.response.set('X-APIC-Correlation-ID', apicCorrelationId);
    }
    
    // Add general correlation ID (using trace ID as primary)
    if (traceId) {
        hm.response.set('X-Correlation-ID', traceId);
    }
    
    // Optionally include full traceparent (useful for debugging)
    if (CONFIG.INCLUDE_FULL_TRACEPARENT && traceparent) {
        hm.response.set('Traceparent', traceparent);
    }
    
    // Log request completion with trace context
    console.info('[Trace Context Response] Request completed - TraceID: ' + 
                 (traceId || 'N/A') + ', APIC: ' + (apicCorrelationId || 'N/A'));
}
