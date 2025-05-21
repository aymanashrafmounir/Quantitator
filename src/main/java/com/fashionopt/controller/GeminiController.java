package com.fashionopt.controller;

import com.fashionopt.service.GeminiService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/gemini")
public class GeminiController {

    @Autowired
    private GeminiService geminiService;
    
    /**
     * General query endpoint for Gemini with persistent context
     */
    @PostMapping("/query")
    public ResponseEntity<String> query(@RequestParam String query, @RequestParam(required = false) MultipartFile file) {
        try {
            // This method now ensures all context is included with every query
            String response = geminiService.queryWithFullContext(query, file);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error querying Gemini: " + e.getMessage());
        }
    }
    
    /**
     * Product-specific query endpoint with persistent context
     */
    @PostMapping("/product")
    public ResponseEntity<String> queryProduct(@RequestParam String productName) {
        try {
            // This method now ensures all context is included with every query
            String response = geminiService.queryAboutProduct(productName);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error querying Gemini about product: " + e.getMessage());
        }
    }
    
    /**
     * Test endpoint to verify Gemini connection
     */
    @GetMapping("/test-connection")
    public ResponseEntity<Map<String, Object>> testConnection() {
        Map<String, Object> result = new HashMap<>();
        
        boolean connected = geminiService.validateGeminiConnection();
        result.put("connected", connected);
        
        if (connected) {
            result.put("status", "Gemini API connection successful");
        } else {
            result.put("status", "Failed to connect to Gemini API");
        }
        
        return ResponseEntity.ok(result);
    }
    
    /**
     * Test endpoint to verify data flow
     */
    @GetMapping("/test-data-flow")
    public ResponseEntity<Map<String, Object>> testDataFlow(HttpSession session) {
        Map<String, Object> result = new HashMap<>();
        
        // Check file data
        result.put("hasFileData", session.getAttribute("fileData") != null);
        
        // Check parameters
        result.put("hasParameters", session.getAttribute("parameters") != null);
        
        // Check results
        result.put("hasResults", session.getAttribute("results") != null);
        
        return ResponseEntity.ok(result);
    }
}
