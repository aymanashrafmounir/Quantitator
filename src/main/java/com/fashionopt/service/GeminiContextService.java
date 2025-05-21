package com.fashionopt.service;

import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.SimulationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpSession;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/**
 * Service for managing persistent context for Gemini AI
 * This ensures all data is available for each query
 */
@Service
public class GeminiContextService {

    private static final String CONTEXT_FILE_DIR = "gemini_context";
    private static final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Stores the complete context data to a persistent file
     */
    public void storeContextToFile(String userId, Map<String, Object> contextData) throws IOException {
        // Create directory if it doesn't exist
        File contextDir = new File(CONTEXT_FILE_DIR);
        if (!contextDir.exists()) {
            contextDir.mkdirs();
        }
        
        // Write context to file
        String contextFilePath = CONTEXT_FILE_DIR + "/" + userId + "_context.json";
        objectMapper.writeValueAsString(contextData);
        Files.write(Paths.get(contextFilePath), objectMapper.writeValueAsBytes(contextData));
    }
    
    /**
     * Loads the complete context data from a persistent file
     */
    public Map<String, Object> loadContextFromFile(String userId) throws IOException {
        String contextFilePath = CONTEXT_FILE_DIR + "/" + userId + "_context.json";
        File contextFile = new File(contextFilePath);
        
        if (!contextFile.exists()) {
            return new HashMap<>();
        }
        
        return objectMapper.readValue(contextFile, Map.class);
    }
    
    /**
     * Creates a complete context object with all data needed for Gemini
     */
    public Map<String, Object> createCompleteContext(
            String fileData, 
            SimulationRequest parameters, 
            CombinedSimulationResult results,
            String gaDetailedOutput,
            String antDetailedOutput) {
        
        Map<String, Object> context = new HashMap<>();
        
        // Add file data
        context.put("fileData", fileData);
        
        // Add parameters
        Map<String, Object> paramMap = new HashMap<>();
        if (parameters != null) {
            paramMap.put("productionBudget", parameters.getProductionBudget());
            paramMap.put("marketingBudget", parameters.getMarketingBudget());
            paramMap.put("logisticsBudget", parameters.getLogisticsBudget());
            paramMap.put("shelfSpace", parameters.getShelfSpace());
            paramMap.put("discountBase", parameters.getDiscountBase());
            paramMap.put("chromosomeBits", parameters.getChromosomeBits());
        }
        context.put("parameters", paramMap);
        
        // Add results
        context.put("results", results);
        
        // Add detailed outputs
        context.put("gaDetailedOutput", gaDetailedOutput);
        context.put("antDetailedOutput", antDetailedOutput);
        
        return context;
    }
    
    /**
     * Creates a comprehensive prompt for Gemini that includes all context data
     */
    public String createComprehensivePrompt(String userQuery, Map<String, Object> context) throws IOException {
        StringBuilder prompt = new StringBuilder();
        
        // Add system context first
        prompt.append("You are an AI assistant analyzing fashion optimization data. You have access to product information, optimization parameters, and results from two algorithms (GA and ACO). Please provide detailed, data-driven responses.\n\n");
        
        // Add user query with clear separator
        prompt.append("USER QUERY: ").append(userQuery).append("\n\n");
        prompt.append("AVAILABLE DATA:\n\n");
        
        // Add file data context with size check
        String fileData = context.get("fileData") != null ? context.get("fileData").toString() : "";
        if (!fileData.isEmpty()) {
            prompt.append("Product Data:\n");
            // Truncate if too large, but keep essential information
            if (fileData.length() > 8000) {
                prompt.append(fileData.substring(0, 8000)).append("\n[Data truncated for length...]\n");
            } else {
                prompt.append(fileData).append("\n");
            }
        }
        
        // Add parameters context
        if (context.get("parameters") != null) {
            prompt.append("\nOptimization Parameters:\n");
            String params = objectMapper.writeValueAsString(context.get("parameters"));
            prompt.append(params).append("\n");
        }
        
        // Add results context with size management
        if (context.get("results") != null) {
            prompt.append("\nOptimization Results:\n");
            String results = objectMapper.writeValueAsString(context.get("results"));
            // Ensure we don't exceed token limits while keeping critical data
            if (results.length() > 8000) {
                // Extract and keep the most important parts of the results
                prompt.append(extractImportantResults(results));
            } else {
                prompt.append(results);
            }
        }
        
        // Add detailed outputs with size management
        String gaOutput = (String) context.get("gaDetailedOutput");
        String antOutput = (String) context.get("antDetailedOutput");
        
        if (gaOutput != null && !gaOutput.isEmpty()) {
            prompt.append("\nGA Algorithm Details:\n");
            prompt.append(truncateOutput(gaOutput, 5000));
        }
        
        if (antOutput != null && !antOutput.isEmpty()) {
            prompt.append("\nACO Algorithm Details:\n");
            prompt.append(truncateOutput(antOutput, 5000));
        }
        
        // Add specific instructions for response
        prompt.append("\nINSTRUCTIONS:\n");
        prompt.append("1. Analyze the provided data thoroughly\n");
        prompt.append("2. Include specific metrics and numbers in your response\n");
        prompt.append("3. Compare algorithm performance where relevant\n");
        prompt.append("4. Highlight key insights about product pricing\n");
        prompt.append("5. Provide actionable recommendations\n\n");
        
        return prompt.toString();
    }
    
    /**
     * Helper method to extract important parts of results
     */
    private String extractImportantResults(String results) throws IOException {
        JsonNode resultsNode = objectMapper.readTree(results);
        ObjectNode summary = objectMapper.createObjectNode();
        
        // Keep only the most important fields
        if (resultsNode.has("bestSolution")) {
            summary.set("bestSolution", resultsNode.get("bestSolution"));
        }
        if (resultsNode.has("revenue")) {
            summary.set("revenue", resultsNode.get("revenue"));
        }
        if (resultsNode.has("profitMargin")) {
            summary.set("profitMargin", resultsNode.get("profitMargin"));
        }
        if (resultsNode.has("convergenceRate")) {
            summary.set("convergenceRate", resultsNode.get("convergenceRate"));
        }
        
        return objectMapper.writeValueAsString(summary);
    }
    
    /**
     * Helper method to truncate output while keeping structure
     */
    private String truncateOutput(String output, int maxLength) {
        if (output.length() <= maxLength) {
            return output;
        }
        
        // Try to truncate at a logical break point
        int breakPoint = output.lastIndexOf("\n", maxLength);
        if (breakPoint == -1) {
            breakPoint = maxLength;
        }
        
        return output.substring(0, breakPoint) + "\n[Output truncated for length...]\n";
    }
    
    /**
     * Generates a unique user ID based on session or request information
     */
    public String generateUserId() {
        try {
            ServletRequestAttributes attr = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpSession session = attr.getRequest().getSession(true);
            return session.getId();
        } catch (Exception e) {
            // Fallback to timestamp if session is not available
            return "user_" + System.currentTimeMillis();
        }
    }
}
