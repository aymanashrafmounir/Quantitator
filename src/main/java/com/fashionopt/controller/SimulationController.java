package com.fashionopt.controller;

import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.SimulationRequest;
import com.fashionopt.dto.SimulationResult;
import com.fashionopt.service.AntColonyService;
import com.fashionopt.service.FileStorageService;
import com.fashionopt.service.GAService;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(
        origins = {"*"}
)
@RequestMapping({"/api"})
public class SimulationController {
    @Autowired
    private FileStorageService fileStorageService;
    @Autowired
    private GAService gaService;
    @Autowired
    private AntColonyService antColonyService;

    @PostMapping({"/simulate"})
    public ResponseEntity<CombinedSimulationResult> runSimulation(@ModelAttribute SimulationRequest request) {
        try {
            System.out.println("Received simulation request: " + String.valueOf(request));
            Path filePath = this.fileStorageService.storeFile(request.getFile());
            System.out.println("File stored at: " + String.valueOf(filePath));
            
            // Run both algorithms in parallel
            CompletableFuture<SimulationResult> gaFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    System.out.println("Starting Genetic Algorithm optimization...");
                    return this.gaService.runOptimization(filePath, request);
                } catch (Exception e) {
                    System.err.println("GA optimization error: " + e.getMessage());
                    e.printStackTrace();
                    return new SimulationResult(); // Return empty result on error
                }
            });
            
            CompletableFuture<SimulationResult> antFuture = CompletableFuture.supplyAsync(() -> {
                try {
                    System.out.println("Starting Ant Colony optimization...");
                    return this.antColonyService.runOptimization(filePath, request);
                } catch (Exception e) {
                    System.err.println("Ant Colony optimization error: " + e.getMessage());
                    e.printStackTrace();
                    return new SimulationResult(); // Return empty result on error
                }
            });
            
            // Wait for both futures to complete
            CompletableFuture<Void> combinedFuture = CompletableFuture.allOf(gaFuture, antFuture);
            combinedFuture.join(); // Wait for both to complete
            
            // Get results from both algorithms
            SimulationResult gaResult = gaFuture.get();
            SimulationResult antResult = antFuture.get();
            
            // Combine results
            CombinedSimulationResult combinedResult = new CombinedSimulationResult();
            combinedResult.setGaResult(gaResult);
            combinedResult.setAntColonyResult(antResult);
            
            System.out.println("Combined simulation results ready");
            return ResponseEntity.ok(combinedResult);
        } catch (Exception e) {
            System.err.println("Simulation error: " + e.getMessage());
            e.printStackTrace();
            CombinedSimulationResult errorResult = new CombinedSimulationResult();
            errorResult.setGaResult(new SimulationResult());
            errorResult.setAntColonyResult(new SimulationResult());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResult);
        }
    }
}
