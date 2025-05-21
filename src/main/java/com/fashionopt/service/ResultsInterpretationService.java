package com.fashionopt.service;

import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.ProductResult;
import com.fashionopt.dto.SimulationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ResultsInterpretationService {

    /**
     * Transforms optimization results into a format optimized for Gemini's understanding
     */
    public Map<String, Object> transformResultsForGemini(CombinedSimulationResult results) {
        Map<String, Object> transformedData = new HashMap<>();
        
        // Add summary comparison
        Map<String, Object> summary = new HashMap<>();
        summary.put("gaProfit", results.getGaResult().getTotalProfit());
        summary.put("antColonyProfit", results.getAntColonyResult().getTotalProfit());
        summary.put("profitDifference", results.getAntColonyResult().getTotalProfit() - results.getGaResult().getTotalProfit());
        summary.put("bestMethod", results.getAntColonyResult().getTotalProfit() > results.getGaResult().getTotalProfit() ? 
                "Ant Colony Optimization" : "Genetic Algorithm");
        
        transformedData.put("summary", summary);
        
        // Add detailed product comparisons
        List<Map<String, Object>> productComparisons = new ArrayList<>();
        Map<String, ProductResult> gaProducts = mapProductsByName(results.getGaResult().getProducts());
        Map<String, ProductResult> antProducts = mapProductsByName(results.getAntColonyResult().getProducts());
        
        // Get all unique product names
        Set<String> allProductNames = new HashSet<>();
        allProductNames.addAll(gaProducts.keySet());
        allProductNames.addAll(antProducts.keySet());
        
        // Create comparison for each product
        for (String productName : allProductNames) {
            Map<String, Object> comparison = new HashMap<>();
            comparison.put("productName", productName);
            
            ProductResult gaProduct = gaProducts.get(productName);
            ProductResult antProduct = antProducts.get(productName);
            
            if (gaProduct != null) {
                comparison.put("gaQuantity", gaProduct.getQuantity());
                comparison.put("gaProfit", gaProduct.getTotalProfit());
            } else {
                comparison.put("gaQuantity", 0);
                comparison.put("gaProfit", 0.0);
            }
            
            if (antProduct != null) {
                comparison.put("antQuantity", antProduct.getQuantity());
                comparison.put("antProfit", antProduct.getTotalProfit());
            } else {
                comparison.put("antQuantity", 0);
                comparison.put("antProfit", 0.0);
            }
            
            // Calculate differences
            int quantityDiff = (antProduct != null ? antProduct.getQuantity() : 0) - 
                              (gaProduct != null ? gaProduct.getQuantity() : 0);
            double profitDiff = (antProduct != null ? antProduct.getTotalProfit() : 0) - 
                               (gaProduct != null ? gaProduct.getTotalProfit() : 0);
            
            comparison.put("quantityDifference", quantityDiff);
            comparison.put("profitDifference", profitDiff);
            
            productComparisons.add(comparison);
        }
        
        transformedData.put("productComparisons", productComparisons);
        
        // Add algorithm-specific insights
        transformedData.put("gaInsights", extractGAInsights(results.getGaResult()));
        transformedData.put("antColonyInsights", extractAntColonyInsights(results.getAntColonyResult()));
        
        return transformedData;
    }
    
    /**
     * Maps products by name for easier comparison
     */
    private Map<String, ProductResult> mapProductsByName(List<ProductResult> products) {
        Map<String, ProductResult> map = new HashMap<>();
        if (products != null) {
            for (ProductResult product : products) {
                map.put(product.getName(), product);
            }
        }
        return map;
    }
    
    /**
     * Extracts insights specific to Genetic Algorithm results
     */
    private Map<String, Object> extractGAInsights(SimulationResult result) {
        Map<String, Object> insights = new HashMap<>();
        
        if (result == null || result.getProducts() == null || result.getProducts().isEmpty()) {
            insights.put("valid", false);
            return insights;
        }
        
        insights.put("valid", true);
        
        // Find most profitable products
        List<ProductResult> sortedByProfit = new ArrayList<>(result.getProducts());
        sortedByProfit.sort((p1, p2) -> Double.compare(p2.getTotalProfit(), p1.getTotalProfit()));
        
        List<Map<String, Object>> topProducts = new ArrayList<>();
        for (int i = 0; i < Math.min(5, sortedByProfit.size()); i++) {
            ProductResult p = sortedByProfit.get(i);
            Map<String, Object> product = new HashMap<>();
            product.put("name", p.getName());
            product.put("profit", p.getTotalProfit());
            product.put("quantity", p.getQuantity());
            topProducts.add(product);
        }
        
        insights.put("topProfitableProducts", topProducts);
        
        // Calculate efficiency (profit per unit)
        List<ProductResult> sortedByEfficiency = new ArrayList<>(result.getProducts());
        sortedByEfficiency.sort((p1, p2) -> Double.compare(p2.getProfitPerUnit(), p1.getProfitPerUnit()));
        
        List<Map<String, Object>> mostEfficient = new ArrayList<>();
        for (int i = 0; i < Math.min(5, sortedByEfficiency.size()); i++) {
            ProductResult p = sortedByEfficiency.get(i);
            Map<String, Object> product = new HashMap<>();
            product.put("name", p.getName());
            product.put("profitPerUnit", p.getProfitPerUnit());
            product.put("quantity", p.getQuantity());
            mostEfficient.add(product);
        }
        
        insights.put("mostEfficientProducts", mostEfficient);
        
        return insights;
    }
    
    /**
     * Extracts insights specific to Ant Colony Optimization results
     */
    private Map<String, Object> extractAntColonyInsights(SimulationResult result) {
        // Similar to GA insights but can be customized for ACO-specific analysis
        return extractGAInsights(result); // For simplicity, using the same method
    }
    
    /**
     * Generates natural language insights about the optimization results
     */
    public String generateNaturalLanguageInsights(CombinedSimulationResult results) {
        StringBuilder insights = new StringBuilder();
        
        // Compare overall performance
        double gaTotalProfit = results.getGaResult().getTotalProfit();
        double antTotalProfit = results.getAntColonyResult().getTotalProfit();
        
        insights.append("# Optimization Results Analysis\n\n");
        
        insights.append("## Overall Performance\n\n");
        insights.append(String.format("- Genetic Algorithm Total Profit: $%.2f\n", gaTotalProfit));
        insights.append(String.format("- Ant Colony Optimization Total Profit: $%.2f\n", antTotalProfit));
        
        double profitDifference = antTotalProfit - gaTotalProfit;
        double percentageDifference = (profitDifference / gaTotalProfit) * 100;
        
        if (profitDifference > 0) {
            insights.append(String.format("- Ant Colony Optimization performed better by $%.2f (%.2f%%)\n\n", 
                    profitDifference, percentageDifference));
        } else if (profitDifference < 0) {
            insights.append(String.format("- Genetic Algorithm performed better by $%.2f (%.2f%%)\n\n", 
                    -profitDifference, -percentageDifference));
        } else {
            insights.append("- Both algorithms performed equally\n\n");
        }
        
        // Product allocation differences
        insights.append("## Key Product Allocation Differences\n\n");
        
        Map<String, ProductResult> gaProducts = mapProductsByName(results.getGaResult().getProducts());
        Map<String, ProductResult> antProducts = mapProductsByName(results.getAntColonyResult().getProducts());
        
        // Find products with significant differences
        List<Map<String, Object>> significantDifferences = new ArrayList<>();
        
        Set<String> allProductNames = new HashSet<>();
        allProductNames.addAll(gaProducts.keySet());
        allProductNames.addAll(antProducts.keySet());
        
        for (String productName : allProductNames) {
            ProductResult gaProduct = gaProducts.get(productName);
            ProductResult antProduct = antProducts.get(productName);
            
            if (gaProduct == null || antProduct == null) continue;
            
            int quantityDiff = antProduct.getQuantity() - gaProduct.getQuantity();
            double profitDiff = antProduct.getTotalProfit() - gaProduct.getTotalProfit();
            
            // Only include if there's a significant difference
            if (Math.abs(quantityDiff) > 5 || Math.abs(profitDiff) > 1000) {
                Map<String, Object> diff = new HashMap<>();
                diff.put("name", productName);
                diff.put("gaQuantity", gaProduct.getQuantity());
                diff.put("antQuantity", antProduct.getQuantity());
                diff.put("quantityDiff", quantityDiff);
                diff.put("profitDiff", profitDiff);
                significantDifferences.add(diff);
            }
        }
        
        // Sort by absolute profit difference
        significantDifferences.sort((d1, d2) -> 
                Double.compare(Math.abs((Double)d2.get("profitDiff")), Math.abs((Double)d1.get("profitDiff"))));
        
        // Report top differences
        for (int i = 0; i < Math.min(5, significantDifferences.size()); i++) {
            Map<String, Object> diff = significantDifferences.get(i);
            String productName = (String) diff.get("name");
            int gaQuantity = (Integer) diff.get("gaQuantity");
            int antQuantity = (Integer) diff.get("antQuantity");
            int quantityDiff = (Integer) diff.get("quantityDiff");
            double profitDiff = (Double) diff.get("profitDiff");
            
            insights.append(String.format("- **%s**: GA allocated %d units vs. ACO's %d units (difference: %d units, $%.2f profit)\n", 
                    productName, gaQuantity, antQuantity, quantityDiff, profitDiff));
        }
        
        insights.append("\n## Recommendations\n\n");
        
        // Determine which algorithm performed better overall
        String betterAlgorithm = antTotalProfit > gaTotalProfit ? 
                "Ant Colony Optimization" : "Genetic Algorithm";
        
        insights.append(String.format("Based on the overall profit, the **%s** algorithm produced better results for this dataset and parameter set.\n\n", betterAlgorithm));
        
        // Add specific product recommendations
        insights.append("### Product-Specific Recommendations\n\n");
        
        // Get top 3 products by profit from the better algorithm
        List<ProductResult> products = antTotalProfit > gaTotalProfit ? 
                results.getAntColonyResult().getProducts() : 
                results.getGaResult().getProducts();
        
        products.sort((p1, p2) -> Double.compare(p2.getTotalProfit(), p1.getTotalProfit()));
        
        for (int i = 0; i < Math.min(3, products.size()); i++) {
            ProductResult p = products.get(i);
            insights.append(String.format("- **%s**: Allocate %d units for an estimated profit of $%.2f\n", 
                    p.getName(), p.getQuantity(), p.getTotalProfit()));
        }
        
        return insights.toString();
    }
    
    /**
     * Creates a structured prompt for Gemini to interpret optimization results
     */
    public String createResultsInterpretationPrompt(String userQuery, CombinedSimulationResult results) throws Exception {
        // Transform results into a more Gemini-friendly format
        Map<String, Object> transformedResults = transformResultsForGemini(results);
        String resultsJson = new ObjectMapper().writeValueAsString(transformedResults);
        
        // Generate natural language insights
        String naturalLanguageInsights = generateNaturalLanguageInsights(results);
        
        // Create a structured prompt
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("# Fashion Optimization Results Analysis\n\n");
        
        prompt.append("## User Query\n");
        prompt.append(userQuery).append("\n\n");
        
        prompt.append("## Pre-generated Insights\n");
        prompt.append(naturalLanguageInsights).append("\n\n");
        
        prompt.append("## Detailed Results Data (JSON)\n");
        prompt.append("```json\n");
        prompt.append(resultsJson);
        prompt.append("\n```\n\n");
        
        prompt.append("## Instructions for Gemini\n");
        prompt.append("Please analyze the optimization results above and answer the user's query. ");
        prompt.append("Focus on providing insights about the performance of both algorithms, ");
        prompt.append("product-specific recommendations, and any patterns or anomalies in the data. ");
        prompt.append("If the user is asking about specific products or parameters, provide detailed information about those elements.\n\n");
        
        return prompt.toString();
    }
}
