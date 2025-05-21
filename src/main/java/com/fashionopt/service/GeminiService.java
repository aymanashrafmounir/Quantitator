package com.fashionopt.service;

import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.ProductResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service for interacting with Gemini using the REST API client
 * This replaces the previous implementation that used Google Cloud SDK
 */
@Service
public class GeminiService {
    
    private static final Logger logger = LoggerFactory.getLogger(GeminiService.class);
    
    @Autowired
    private SessionDataService sessionDataService;
    
    @Autowired
    private ResultsInterpretationService resultsInterpretationService;
    
    @Autowired
    private GeminiContextService geminiContextService;
    
    @Autowired
    private GeminiRestApiService geminiRestApiService;

    @Autowired
    private ExcelParsingService excelParsingService; // New field
    
    /**
     * Send a query to Gemini with full context of file data, parameters, and results
     * This method ensures all context is included with every query
     */
    public String queryWithFullContext(String userQuery, MultipartFile file) {
        try {
            String userId = geminiContextService.generateUserId();
            Map<String, Object> context = new HashMap<>();
            
            String parsedExcelData = null;
            if (file != null && !file.isEmpty()) {
                try {
                    parsedExcelData = excelParsingService.parseExcelFile(file);
                    logger.info("Successfully parsed Excel file: {}", file.getOriginalFilename());
                } catch (Exception e) {
                    logger.error("Error parsing Excel file {}: {}", file.getOriginalFilename(), e.getMessage(), e);
                    // Optionally, return an error message to the user or handle as appropriate
                    // For now, we can let geminiContextService handle null parsedExcelData if it's designed to
                    parsedExcelData = "Error parsing Excel file: " + e.getMessage(); // Or set to null and let context service handle it
                }
            }
            
            // First try to load existing context
            try {
                context = geminiContextService.loadContextFromFile(userId);
            } catch (Exception e) {
                logger.debug("No existing context found, creating new context");
            }
            
            // Always try to get fresh data from session
            try {
                // Validate and gather all context data from session
                sessionDataService.validateSessionData();
                
                if (!sessionDataService.hasCompleteData()) {
                    logger.warn("Incomplete session data");
                    return "Please run a complete simulation first. Some data is missing.";
                }
                
                // Get all required data
                String fileData = sessionDataService.getFileData();
                CombinedSimulationResult results = sessionDataService.getResults();
                String gaOutput = sessionDataService.getGADetailedOutput();
                String antOutput = sessionDataService.getAntDetailedOutput();
                
                // Validate critical data
                if (fileData == null || results == null) {
                    logger.warn("Critical data missing from session");
                    return "Critical data is missing. Please run a new simulation.";
                }
                
                // Create complete context with all available data
                context = geminiContextService.createCompleteContext(
                    fileData,
                    null, // Original request object not needed
                    results,
                    gaOutput,
                    antOutput,
                    parsedExcelData // new argument
                );
                
                // Store updated context
                try {
                    geminiContextService.storeContextToFile(userId, context);
                } catch (Exception e) {
                    logger.warn("Failed to store context to file", e);
                    // Continue anyway as we have the context in memory
                }
            } catch (Exception e) {
                logger.error("Error gathering session data", e);
                return "An error occurred while gathering optimization data. Please try running a new simulation.";
            }
            
            // Create comprehensive prompt with all context
            String prompt = geminiContextService.createComprehensivePrompt(userQuery, context);
            
            // Send to Gemini with increased timeout
            return geminiRestApiService.queryGemini(prompt);
            
        } catch (Exception e) {
            logger.error("Error in queryWithFullContext", e);
            return "An error occurred while processing your query: " + e.getMessage();
        }
    }
    
    /**
     * Specialized method for product-specific queries with full context
     */
    public String queryAboutProduct(String productName) {
        try {
            // Generate a unique user ID for context persistence
            String userId = geminiContextService.generateUserId();
            
            // Try to load context from persistent storage first
            Map<String, Object> context;
            try {
                context = geminiContextService.loadContextFromFile(userId);
            } catch (Exception e) {
                logger.warn("Could not load context from file, falling back to session data", e);
                context = new HashMap<>();
            }
            
            // If context is empty or incomplete, try to get data from session
            if (context.isEmpty() || !context.containsKey("results")) {
                try {
                    // Get results from session
                    sessionDataService.validateSessionData();
                    CombinedSimulationResult results = sessionDataService.getResults();
                    
                    if (results == null) {
                        return "No optimization results found. Please run a simulation first.";
                    }
                    
                    // Create complete context
                    context = geminiContextService.createCompleteContext(
                            sessionDataService.getFileData(),
                            null, // We don't have the original request object here
                            results,
                            sessionDataService.getGADetailedOutput(),
                            sessionDataService.getAntDetailedOutput()
                    );
                    
                    // Store context for future use
                    try {
                        geminiContextService.storeContextToFile(userId, context);
                    } catch (Exception e) {
                        logger.warn("Could not store context to file", e);
                    }
                } catch (Exception e) {
                    logger.warn("Could not get data from session", e);
                    return "Could not access optimization data. Please run a simulation first.";
                }
            }
            
            // Create a product-specific query
            String productQuery = "Analyze the performance of product '" + productName + 
                    "' in both optimization algorithms. Compare quantities, profits, and provide recommendations.";
            
            // Create a comprehensive prompt that includes all context
            String prompt = geminiContextService.createComprehensivePrompt(productQuery, context);
            
            // Send to Gemini using the REST API service
            return geminiRestApiService.queryGemini(prompt);
        } catch (Exception e) {
            logger.error("Error querying Gemini about product: " + e.getMessage(), e);
            return "Error processing your product query: " + e.getMessage();
        }
    }
    
    /**
     * Simple query to Gemini without full context (for testing)
     */
    public String queryGemini(String query) {
        try {
            return geminiRestApiService.queryGemini(query);
        } catch (IOException e) {
            logger.error("Error querying Gemini: " + e.getMessage(), e);
            return "Error querying Gemini: " + e.getMessage();
        }
    }
    
    /**
     * Validates the Gemini API connection
     */
    public boolean validateGeminiConnection() {
        return geminiRestApiService.testConnection();
    }
    
    /**
     * Helper method to find a product by name
     */
    private ProductResult findProductByName(List<ProductResult> products, String name) {
        if (products == null) return null;
        
        // Case-insensitive search
        String searchName = name.toLowerCase();
        
        for (ProductResult product : products) {
            if (product.getName().toLowerCase().contains(searchName)) {
                return product;
            }
        }
        
        return null;
    }
}
