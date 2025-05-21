package com.fashionopt.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.hc.client5.http.classic.HttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * Service for interacting with Gemini API directly via REST calls
 * This eliminates the need for the Google Cloud SDK dependency
 */
@Service
public class GeminiRestApiService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String apiEndpoint;
    
    // Rate limiting
    private long lastRequestTime = 0;
    private final long minRequestInterval = 100; // milliseconds between requests
    
    public GeminiRestApiService(
            @Value("${gemini.api.key:your-api-key-here}") String apiKey,
            @Value("${gemini.api.endpoint:https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent}") String apiEndpoint) {
        
        // Configure connection pooling
        PoolingHttpClientConnectionManager connectionManager = new PoolingHttpClientConnectionManager();
        connectionManager.setMaxTotal(50);
        connectionManager.setDefaultMaxPerRoute(20);
        
        // Configure timeouts
        RequestConfig requestConfig = RequestConfig.custom()
            .setConnectionRequestTimeout(Timeout.of(10, TimeUnit.SECONDS))
            .setResponseTimeout(Timeout.of(30, TimeUnit.SECONDS))
            .build();
        
        // Create HttpClient with configuration
        HttpClient httpClient = HttpClients.custom()
            .setConnectionManager(connectionManager)
            .setDefaultRequestConfig(requestConfig)
            .build();
        
        // Create request factory
        HttpComponentsClientHttpRequestFactory factory = new HttpComponentsClientHttpRequestFactory(httpClient);
        
        // Create RestTemplate with the configured factory
        this.restTemplate = new RestTemplate(factory);
        this.objectMapper = new ObjectMapper();
        this.apiKey = apiKey;
        this.apiEndpoint = apiEndpoint;
    }
    
    /**
     * Send a query to Gemini API with enhanced error handling and response management
     */
    public String queryGemini(String prompt) throws IOException {
        // Apply rate limiting
        applyRateLimit();
        
        try {
            // Create request body with increased output tokens
            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contents = requestBody.putArray("contents");
            
            // Create content object
            ObjectNode content = contents.addObject();
            
            // Create parts array with the prompt
            ArrayNode parts = content.putArray("parts");
            ObjectNode textPart = parts.addObject();
            textPart.put("text", prompt);
            
            // Add generation config for better responses
            ObjectNode generationConfig = requestBody.putObject("generationConfig");
            generationConfig.put("temperature", 0.7);
            generationConfig.put("topK", 40);
            generationConfig.put("topP", 0.95);
            generationConfig.put("maxOutputTokens", 2048); // Increased token limit
            
            // Set up headers with compression
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set(HttpHeaders.ACCEPT_ENCODING, "gzip, deflate");
            
            // Create HTTP entity
            HttpEntity<String> entity = new HttpEntity<>(objectMapper.writeValueAsString(requestBody), headers);
            
            // Make API call with retry logic
            String response = null;
            int maxRetries = 3;
            int retryCount = 0;
            
            while (retryCount < maxRetries && response == null) {
                try {
                    String url = apiEndpoint + "?key=" + apiKey;
                    ResponseEntity<String> responseEntity = restTemplate.postForEntity(url, entity, String.class);
                    
                    if (responseEntity.getStatusCode().is2xxSuccessful() && responseEntity.getBody() != null) {
                        response = extractTextFromResponse(responseEntity.getBody());
                    }
                } catch (Exception e) {
                    retryCount++;
                    if (retryCount == maxRetries) {
                        throw e;
                    }
                    // Exponential backoff
                    Thread.sleep((long) Math.pow(2, retryCount) * 1000);
                }
            }
            
            if (response == null || response.trim().isEmpty()) {
                throw new IOException("Empty response from Gemini API");
            }
            
            return response;
            
        } catch (Exception e) {
            throw new IOException("Error querying Gemini: " + e.getMessage(), e);
        }
    }
    
    /**
     * Extract text content from Gemini API response with enhanced error handling
     */
    private String extractTextFromResponse(String responseBody) throws IOException {
        try {
            JsonNode rootNode = objectMapper.readTree(responseBody);
            
            // Check for API errors first
            JsonNode error = rootNode.path("error");
            if (!error.isMissingNode()) {
                String errorMessage = error.path("message").asText("Unknown error");
                throw new IOException("Gemini API error: " + errorMessage);
            }
            
            // Navigate to the text content
            JsonNode candidates = rootNode.path("candidates");
            if (!candidates.isArray() || candidates.size() == 0) {
                throw new IOException("No candidates in response");
            }
            
            StringBuilder fullResponse = new StringBuilder();
            
            // Combine text from all candidates if multiple are present
            for (JsonNode candidate : candidates) {
                JsonNode content = candidate.path("content");
                JsonNode parts = content.path("parts");
                
                if (parts.isArray()) {
                    for (JsonNode part : parts) {
                        JsonNode text = part.path("text");
                        if (text.isTextual()) {
                            if (fullResponse.length() > 0) {
                                fullResponse.append("\n");
                            }
                            fullResponse.append(text.asText());
                        }
                    }
                }
            }
            
            if (fullResponse.length() == 0) {
                throw new IOException("No text content found in response");
            }
            
            return fullResponse.toString();
            
        } catch (Exception e) {
            throw new IOException("Failed to parse Gemini response: " + e.getMessage(), e);
        }
    }
    
    /**
     * Apply rate limiting to avoid exceeding API quotas
     */
    private void applyRateLimit() {
        long currentTime = System.currentTimeMillis();
        long timeSinceLastRequest = currentTime - lastRequestTime;
        
        if (timeSinceLastRequest < minRequestInterval) {
            try {
                TimeUnit.MILLISECONDS.sleep(minRequestInterval - timeSinceLastRequest);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        
        lastRequestTime = System.currentTimeMillis();
    }
    
    /**
     * Test the Gemini API connection
     */
    public boolean testConnection() {
        try {
            String response = queryGemini("Hello, are you working?");
            return response != null && !response.isEmpty();
        } catch (Exception e) {
            return false;
        }
    }
}
