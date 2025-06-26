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

            // Validate shelf space before starting simulation
            // Calculate required shelf space from the uploaded data
            double requiredShelfSpace = calculateRequiredShelfSpace(filePath);
            double totalShelfSpace = request.getShelfSpace();
            
            if (!simulationStatusService.validateShelfSpace(totalShelfSpace, requiredShelfSpace)) {
                simulationStatusService.setShelfSpaceError(simulationId, totalShelfSpace, requiredShelfSpace);
                return ResponseEntity.ok(simulationId); // Return simulation ID even for validation errors
            }

            // Validate discount base (must be between 0.1 and 0.5)
            double discountBase = request.getDiscountBase();
            if (discountBase < 0.1 || discountBase > 0.5) {
                String errorMsg = String.format("Invalid discount base: %.2f. Must be between 0.1 and 0.5", discountBase);
                simulationStatusService.setValidationError(simulationId, errorMsg);
                return ResponseEntity.ok(simulationId);
            }

            // Validate chromosome bits (must be between 10 and 100)
            int chromosomeBits = request.getChromosomeBits();
            if (chromosomeBits < 10 || chromosomeBits > 100) {
                String errorMsg = String.format("Invalid chromosome bits: %d. Must be between 10 and 100", chromosomeBits);
                simulationStatusService.setValidationError(simulationId, errorMsg);
                return ResponseEntity.ok(simulationId);
            }

            // Set initial time estimates (these will be updated as algorithms progress)
            simulationStatusService.updateProgress(simulationId, "GA", 0.0, 120.0); // Initial estimate: 2 minutes
            simulationStatusService.updateProgress(simulationId, "ACO", 0.0, 120.0); // Initial estimate: 2 minutes

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
     * Calculate required shelf space from uploaded data file
     * This is a simplified calculation - you may need to adjust based on your data format
     */
    private double calculateRequiredShelfSpace(Path filePath) {
        try {
            // Read the CSV file and calculate total shelf space required
            // This is a basic implementation - adjust according to your CSV structure
            java.util.List<String> lines = java.nio.file.Files.readAllLines(filePath);
            double totalRequired = 0.0;
            
            // Skip header line if present
            for (int i = 1; i < lines.size(); i++) {
                String[] columns = lines.get(i).split(",");
                if (columns.length > 8) { // Assuming shelf space is in column 9 (index 8)
                    try {
                        double shelfSpace = Double.parseDouble(columns[8].trim());
                        totalRequired += shelfSpace;
                    } catch (NumberFormatException e) {
                        // Skip invalid entries
                    }
                }
            }
            return totalRequired;
        } catch (Exception e) {
            System.err.println("Error calculating required shelf space: " + e.getMessage());
            return 0.0; // Return 0 if calculation fails (allows simulation to proceed)
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

    /**
     * New endpoint for terminating a running simulation.
     */
    @PostMapping("/simulate/terminate/{simulationId}")
    public ResponseEntity<String> terminateSimulation(@PathVariable String simulationId) {
        boolean terminated = simulationStatusService.terminateSimulation(simulationId);
        if (terminated) {
            return ResponseEntity.ok("Simulation terminated successfully");
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Simulation not found or not running");
        }
    }
}

