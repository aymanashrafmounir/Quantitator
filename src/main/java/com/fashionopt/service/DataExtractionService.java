package com.fashionopt.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.*;

/**
 * Service for extracting data from CSV files
 * This replaces the Apache POI dependency for Excel processing
 */
@Service
public class DataExtractionService {
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * Extracts data from CSV file and converts it to a JSON string for Gemini
     */
    public String extractDataForGemini(MultipartFile file) throws IOException {
        // Check if file is CSV
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".csv")) {
            throw new IOException("Invalid file format. Must be .csv");
        }
        
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            // Read header line
            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new IOException("CSV file is empty");
            }
            
            // Parse headers
            List<String> headers = parseCSVLine(headerLine);
            
            // Read data rows
            List<Map<String, Object>> products = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) continue;
                
                List<String> values = parseCSVLine(line);
                Map<String, Object> product = new HashMap<>();
                
                for (int i = 0; i < Math.min(headers.size(), values.size()); i++) {
                    String header = headers.get(i);
                    String value = values.get(i);
                    
                    // Try to convert to number if possible
                    try {
                        if (value.contains(".")) {
                            product.put(header, Double.parseDouble(value));
                        } else {
                            product.put(header, Integer.parseInt(value));
                        }
                    } catch (NumberFormatException e) {
                        // If not a number, store as string
                        product.put(header, value);
                    }
                }
                
                products.add(product);
            }
            
            // Convert to JSON
            return objectMapper.writeValueAsString(products);
        }
    }
    
    /**
     * Parse a CSV line, handling quoted values and commas within quotes
     */
    private List<String> parseCSVLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder currentValue = new StringBuilder();
        boolean inQuotes = false;
        
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            
            if (c == '"') {
                // Toggle quote state
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                // End of value
                result.add(currentValue.toString().trim());
                currentValue = new StringBuilder();
            } else {
                // Add character to current value
                currentValue.append(c);
            }
        }
        
        // Add the last value
        result.add(currentValue.toString().trim());
        
        return result;
    }
    
    /**
     * Validates the CSV file format and structure
     */
    public void validateCSVFile(MultipartFile file) throws IOException {
        // Check file extension
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".csv")) {
            throw new IOException("Invalid file format. Must be .csv");
        }
        
        // Check file size
        if (file.isEmpty() || file.getSize() == 0) {
            throw new IOException("File is empty");
        }
        
        // Try to read the file
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            // Check if there's at least a header
            if (reader.readLine() == null) {
                throw new IOException("CSV file is empty or corrupted");
            }
        } catch (Exception e) {
            throw new IOException("Cannot read CSV file: " + e.getMessage());
        }
    }
}
