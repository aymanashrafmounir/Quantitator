package com.fashionopt.service;

import com.fashionopt.dto.ProductResult;
import com.fashionopt.dto.SimulationResult;
import com.fashionopt.dto.SimulationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
public class AntColonyService {
    public SimulationResult runOptimization(Path filePath, SimulationRequest request) throws IOException, InterruptedException {
        // Use the same directory as GAService for consistency
        String scriptDir = "F:\\Coding\\Graduation Project\\Manus\\V7.2";
        // Use the full path to ant.py to ensure it's found
        ProcessBuilder pb = new ProcessBuilder(new String[]{"python", scriptDir + "\\ant.py", filePath.toString(), "--bp", String.valueOf(request.getProductionBudget()), "--bm", String.valueOf(request.getMarketingBudget()), "--bl", String.valueOf(request.getLogisticsBudget()), "--s_max", String.valueOf(request.getShelfSpace()), "--d_base", String.valueOf(request.getDiscountBase())});
        pb.directory(new File(scriptDir));
        pb.redirectErrorStream(true);
        System.out.println("Preparing to execute Ant Colony script with command: " + String.join(" ", pb.command()));
        Process process = pb.start();
        System.out.println("Ant Colony process started successfully. Waiting for output...");
        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
        StringBuilder output = new StringBuilder();

        String line;
        while((line = reader.readLine()) != null) {
            output.append(line).append("\n");
            System.out.println("Python output: " + line);
        }

        int exitCode = process.waitFor();
        System.out.println("Ant Colony process completed with exit code: " + exitCode);
        System.out.println("Full Python script output: " + output.toString());
        if (exitCode == 0 && output.length() != 0) {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(output.toString());
            if (root.has("error")) {
                throw new RuntimeException("Python script returned an error: " + root.get("error").asText());
            } else {
                SimulationResult result = new SimulationResult();
                result.setTotalProfit(root.get("total_profit").asDouble());
                List<ProductResult> products = new ArrayList();

                for(JsonNode productNode : root.get("products")) {
                    ProductResult pr = new ProductResult();
                    pr.setName(productNode.get("name").asText());
                    pr.setQuantity(productNode.get("quantity").asInt());
                    pr.setPrice(productNode.get("price").asDouble());
                    pr.setUnitCost(productNode.get("unit_cost").asDouble());
                    pr.setProfitPerUnit(productNode.get("profit_per_unit").asDouble());
                    pr.setTotalProfit(productNode.get("total_profit").asDouble());
                    pr.setTotalCost(productNode.get("total_cost").asDouble());
                    products.add(pr);
                }

                result.setProducts(products);
                return result;
            }
        } else {
            throw new RuntimeException("Python script failed with exit code " + exitCode + ". Output: " + String.valueOf(output));
        }
    }
}
