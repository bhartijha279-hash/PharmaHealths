package com.pharmahealth.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Gracefully handle client connection aborts (Broken pipe, ClientAbortException, AsyncRequestNotUsableException)
     * when a client closes the browser tab, cancels a request, or network disconnects mid-stream.
     */
    @ExceptionHandler({AsyncRequestNotUsableException.class})
    public void handleAsyncRequestNotUsable(AsyncRequestNotUsableException ex) {
        logger.debug("Client closed connection before response completed: {}", ex.getMessage());
    }

    @ExceptionHandler(IOException.class)
    public void handleIOException(IOException ex) {
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        if (msg.contains("broken pipe") || msg.contains("connection reset")) {
            logger.debug("Client disconnected mid-stream (Broken pipe): {}", ex.getMessage());
            return;
        }
        logger.warn("I/O error during request processing: {}", ex.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return errorResponse(HttpStatus.FORBIDDEN, "You do not have permission to perform this action.");
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> handleAuthentication(AuthenticationException ex) {
        return errorResponse(HttpStatus.UNAUTHORIZED, "Invalid username or password.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String details = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + " " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return errorResponse(HttpStatus.BAD_REQUEST, "Invalid request: " + details);
    }

    @ExceptionHandler({IllegalArgumentException.class, MethodArgumentTypeMismatchException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception ex) {
        String message = ex instanceof IllegalArgumentException ? ex.getMessage() : "Malformed request.";
        return errorResponse(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        logger.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        return errorResponse(HttpStatus.CONFLICT, "Request conflicts with existing data.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGenericException(Exception ex) {
        String msg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        if (msg.contains("broken pipe") || msg.contains("connection reset") || msg.contains("stream failed to flush")) {
            logger.debug("Suppressed broken pipe exception: {}", ex.getMessage());
            return null;
        }
        // Spring MVC exceptions (missing params, unsupported method, unknown route, ...) carry their own status
        if (ex instanceof ErrorResponse errorResponse) {
            return errorResponse(errorResponse.getStatusCode(), ex.getMessage());
        }
        logger.error("Unhandled application exception: ", ex);
        return errorResponse(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage());
    }

    private ResponseEntity<Map<String, Object>> errorResponse(HttpStatusCode status, String message) {
        Map<String, Object> errorBody = new HashMap<>();
        HttpStatus resolved = HttpStatus.resolve(status.value());
        errorBody.put("error", resolved != null ? resolved.getReasonPhrase() : "Error");
        errorBody.put("message", message);
        errorBody.put("status", status.value());
        return ResponseEntity.status(status).body(errorBody);
    }
}
