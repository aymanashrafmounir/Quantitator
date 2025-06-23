package com.fashionopt.controller;

import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.SimulationRequest;
import com.fashionopt.dto.SimulationResult;
import com.fashionopt.dto.SimulationStatus; // Import the new DTO
import com.fashionopt.service.AntColonyService;
import com.fashionopt.service.FileStorageService;
import com.fashionopt.service.GAService;
import com.fashionopt.service.SimulationStatusService; // Import the new service
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors; // For creating a dedicated thread pool
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable; // For new GET endpoint
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping; // For new GET endpoint
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
    @Autowired
    private SimulationStatusService simulationStatusService; // Autowire the new service

    // Create a dedicated thread pool for long-running simulation tasks
    // Adjust pool size based on expected concurrency and system resources
    private final ExecutorService simulationExecutor = Executors.newFixedThreadPool(2);


    @PostMapping({"/simulate"})
    public ResponseEntity<String> runSimulation(@ModelAttribute SimulationRequest request) {
        String simulationId = simulationStatusService.createSimulation(); // Create a new simulation entry

        try {
            System.out.println("Received simulation request for ID: " + simulationId + " with details: " + String.valueOf(request));
            Path filePath = this.fileStorageService.storeFile(request.getFile());
            System.out.println("File stored at: " + String.valueOf(filePath));

            // Run both algorithms in parallel in the dedicated thread pool
            CompletableFuture<Void> gaFuture = CompletableFuture.runAsync(() -> {
                try {
                    System.out.println("Starting Genetic Algorithm optimization for ID: " + simulationId);
                    // The runOptimization method is now responsible for calling updateResult for GA
                    this.gaService.runOptimization(simulationId, filePath, request);
                } catch (Exception e) {
                    System.err.println("GA optimization error for ID: " + simulationId + ": " + e.getMessage());
                    e.printStackTrace();
                    // Ensure updateError is called for robust reporting
                    simulationStatusService.updateError(simulationId, "GA", e.getMessage());
                    // Even if runOptimization fails to return a result, ensure the status is eventually marked as completed for this algorithm
                    // This is now handled within GAService.runOptimization, which always returns a SimulationResult
                }
            }, simulationExecutor); // Use the dedicated executor

            CompletableFuture<Void> antFuture = CompletableFuture.runAsync(() -> {
                try {
                    System.out.println("Starting Ant Colony optimization for ID: " + simulationId);
                    // The runOptimization method is now responsible for calling updateResult for ACO
                    this.antColonyService.runOptimization(simulationId, filePath, request);
                } catch (Exception e) {
                    System.err.println("Ant Colony optimization error for ID: " + simulationId + ": " + e.getMessage());
                    e.printStackTrace();
                    // Ensure updateError is called for robust reporting
                    simulationStatusService.updateError(simulationId, "ACO", e.getMessage());
                    // This is now handled within AntColonyService.runOptimization, which always returns a SimulationResult
                }
            }, simulationExecutor); // Use the dedicated executor

            // Do NOT call .join() here. Return the simulation ID immediately.
            // The frontend will poll the status endpoint using this ID.

            return ResponseEntity.ok(simulationId); // Return the simulation ID
        } catch (Exception e) {
            System.err.println("Simulation setup error for ID: " + simulationId + ": " + e.getMessage());
            e.printStackTrace();
            simulationStatusService.updateError(simulationId, "Setup", e.getMessage()); // Report setup errors too
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error starting simulation: " + e.getMessage());
        }
    }

    /**
     * New endpoint for fetching simulation status by ID.
     * The frontend will call this periodically to get updates.
     */
    @GetMapping("/simulate/status/{simulationId}")
    public ResponseEntity<SimulationStatus> getSimulationStatus(@PathVariable String simulationId) {
        SimulationStatus status = simulationStatusService.getStatus(simulationId);
        if (status != null) {
            return ResponseEntity.ok(status);
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PostMapping("/simulate/cleanup/{simulationId}")
    public ResponseEntity<Void> cleanupSimulation(@PathVariable String simulationId) {
        simulationStatusService.cleanupSimulation(simulationId);
        return ResponseEntity.ok().build();
    }
}
