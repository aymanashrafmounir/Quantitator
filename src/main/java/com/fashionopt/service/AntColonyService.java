package com.fashionopt.service;

import com.fashionopt.dto.ProductResult;
import com.fashionopt.dto.SimulationResult;
import com.fashionopt.dto.SimulationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AntColonyService {

    private static final Logger logger = LoggerFactory.getLogger(AntColonyService.class);

    @Autowired
    private SimulationStatusService simulationStatusService;

    // Pattern to parse progress messages from Python scripts
    private static final Pattern PROGRESS_PATTERN = Pattern.compile("\\[PROGRESS\\] ACO: (\\d+\\.?\\d*)% completed, estimated (\\d+\\.?\\d*)s remaining");

    public SimulationResult runOptimization(String simulationId, Path filePath, SimulationRequest request) throws IOException, InterruptedException {
        String scriptDir = System.getProperty("user.dir"); // Use current working directory instead of hardcoded path

        // Try different Python executable names in order of preference
        String[] pythonCommands = {"python3.11", "python3", "python"};
        String pythonExecutable = null;
        
        // Find the first available Python executable
        for (String cmd : pythonCommands) {
            try {
                ProcessBuilder testPb = new ProcessBuilder(cmd, "--version");
                Process testProcess = testPb.start();
                int exitCode = testProcess.waitFor();
                if (exitCode == 0) {
                    pythonExecutable = cmd;
                    logger.info("Found Python executable: " + cmd);
                    break;
                }
            } catch (Exception e) {
                // Continue to next command
                logger.debug("Python command '" + cmd + "' not found: " + e.getMessage());
            }
        }
        
        if (pythonExecutable == null) {
            String errorMsg = "No Python executable found. Please install Python and ensure it's in your system PATH. Tried: " + String.join(", ", pythonCommands);
            simulationStatusService.updateError(simulationId, "ACO", errorMsg);
            SimulationResult errorResult = new SimulationResult();
            errorResult.setTotalProfit(0.0);
            errorResult.setProducts(new ArrayList<>());
            simulationStatusService.updateResult(simulationId, "ACO", errorResult);
            return errorResult;
        }

        ProcessBuilder pb = new ProcessBuilder(new String[]{
                pythonExecutable,
                scriptDir + File.separator + "ant.py", // Use File.separator for cross-platform compatibility
                filePath.toString(),
                "--bp", String.valueOf(request.getProductionBudget()),
                "--bm", String.valueOf(request.getMarketingBudget()),
                "--bl", String.valueOf(request.getLogisticsBudget()),
                "--s_max", String.valueOf(request.getShelfSpace()),
                "--d_base", String.valueOf(request.getDiscountBase()),
                "--col_name", request.getColName(),
                "--col_price", request.getColPrice(),
                "--col_cp", request.getColCp(),
                "--col_cm", request.getColCm(),
                "--col_cl", request.getColCl(),
                "--col_shelf_cost", request.getColShelfCost(),
                "--col_age", request.getColAge(),
                "--col_stock", request.getColStock(),
                "--col_shelf", request.getColShelf(),
                "--col_demand", request.getColDemand()
        });

        pb.directory(new File(scriptDir));
        pb.redirectErrorStream(true);
        logger.info("Preparing to execute Ant Colony script with command: " + String.join(" ", pb.command()));

        Process process = pb.start();
        logger.info("Ant Colony process started successfully. Waiting for output...");
        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
        StringBuilder rawOutput = new StringBuilder();
        String line;
        String jsonOutput = ""; // To store the extracted JSON
        long startTime = System.currentTimeMillis();
        int progressCount = 0;

        while((line = reader.readLine()) != null) {
            if (rawOutput.length() < 1024 * 1024) { // Limit raw output to 1MB
                rawOutput.append(line).append("\n");
            }
            logger.debug("Python output: " + line); // Log each line for debugging

            // Check for progress messages
            Matcher matcher = PROGRESS_PATTERN.matcher(line);
            if (matcher.find()) {
                try {
                    double progress = Double.parseDouble(matcher.group(1));
                    double estimatedTime = Double.parseDouble(matcher.group(2));
                    simulationStatusService.updateProgress(simulationId, "ACO", progress, estimatedTime);
                    progressCount++;
                } catch (NumberFormatException e) {
                    logger.error("Error parsing ACO progress line: " + line, e);
                }
            } else if (line.trim().startsWith("{") && line.trim().endsWith("}")) {
                // Heuristic: if a line looks like a complete JSON object, capture it as the final result
                jsonOutput = line;
            } else if (line.contains("Error:") || line.contains("Exception:") || line.contains("Traceback")) {
                // Capture error messages from Python script
                logger.error("Python ACO script error: " + line);
            }

            // Provide time estimates based on progress if no explicit progress messages
            if (progressCount == 0) {
                long elapsed = System.currentTimeMillis() - startTime;
                if (elapsed > 5000) { // After 5 seconds, start providing estimates
                    double estimatedProgress = Math.min(50.0, (elapsed / 1000.0) / 2.0); // Rough estimate
                    double estimatedRemaining = Math.max(30.0, 120.0 - (elapsed / 1000.0));
                    simulationStatusService.updateProgress(simulationId, "ACO", estimatedProgress, estimatedRemaining);
                }
            }
        }

        int exitCode = process.waitFor();
        logger.info("Ant Colony process completed with exit code: " + exitCode);
        logger.debug("Full Python script raw output: \n" + rawOutput.toString());

        SimulationResult finalResult = new SimulationResult(); // Initialize a result object

        if (exitCode == 0 && !jsonOutput.isEmpty()) {
            ObjectMapper mapper = new ObjectMapper();
            try {
                JsonNode root = mapper.readTree(jsonOutput);

                if (root.has("error")) {
                    String errorMsg = root.get("error").asText();
                    simulationStatusService.updateError(simulationId, "ACO", errorMsg);
                    // Return an empty or error-flagged SimulationResult if the Python script itself returned an error
                    finalResult.setTotalProfit(0.0);
                    finalResult.setProducts(new ArrayList<>());
                } else {
                    finalResult = parseResults(jsonOutput);
                    simulationStatusService.updateProgress(simulationId, "ACO", 100.0, 0.0); // Ensure 100% on completion
                }
            } catch (com.fasterxml.jackson.core.JsonParseException e) {
                String errorMsg = "Failed to parse JSON output from Python ACO script. Error: " + e.getMessage();
                simulationStatusService.updateError(simulationId, "ACO", errorMsg);
                // On JSON parsing error, return an empty result
                finalResult.setTotalProfit(0.0);
                finalResult.setProducts(new ArrayList<>());
            }
        } else {
            String errorMessage = "Python ACO script failed with exit code " + exitCode + ".";
            if (jsonOutput.isEmpty()) {
                errorMessage += " No valid JSON output found.";
            }
            if (rawOutput.toString().contains("Traceback")) {
                errorMessage += " Python script encountered an unhandled error (traceback detected).";
            }
            if (rawOutput.toString().contains("ModuleNotFoundError")) {
                errorMessage += " Missing Python dependencies. Please install required modules.";
            }
            simulationStatusService.updateError(simulationId, "ACO", errorMessage);
            // On script failure, return an empty result
            finalResult.setTotalProfit(0.0);
            finalResult.setProducts(new ArrayList<>());
        }

        // Always update the result for ACO, even if it's an empty/error one.
        // This is crucial to ensure both GA and ACO update their results and trigger overall completion.
        simulationStatusService.updateResult(simulationId, "ACO", finalResult);
        return finalResult;
    }

    private SimulationResult parseResults(String jsonOutput) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(jsonOutput);
        SimulationResult result = new SimulationResult();
        result.setTotalProfit(root.has("total_profit") ? root.get("total_profit").asDouble(0.0) : 0.0);
        List<ProductResult> products = new ArrayList<>();

        if (root.has("products") && root.get("products").isArray()) {
            for(JsonNode productNode : root.get("products")) {
                ProductResult pr = new ProductResult();
                pr.setName(productNode.has("name") ? productNode.get("name").asText("") : "");
                pr.setQuantity(productNode.has("quantity") ? productNode.get("quantity").asInt(0) : 0);
                pr.setPrice(productNode.has("price") ? productNode.get("price").asDouble(0.0) : 0.0);
                pr.setUnitCost(productNode.has("unit_cost") ? productNode.get("unit_cost").asDouble(0.0) : 0.0);
                pr.setProfitPerUnit(productNode.has("profit_per_unit") ? productNode.get("profit_per_unit").asDouble(0.0) : 0.0);
                pr.setTotalProfit(productNode.has("total_profit") ? productNode.get("total_profit").asDouble(0.0) : 0.0);
                pr.setTotalCost(productNode.has("total_cost") ? productNode.get("total_cost").asDouble(0.0) : 0.0);
                products.add(pr);
            }
        }
        result.setProducts(products);
        return result;
    }
}