package com.fashionopt.service;

import com.fashionopt.dto.CombinedSimulationResult;
import com.fashionopt.dto.SimulationStatus;
import com.fashionopt.dto.SimulationResult;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SimulationStatusService {

    private final Map<String, SimulationStatus> simulationStatuses = new ConcurrentHashMap<>();

    /**
     * Creates a new simulation entry and returns a unique ID.
     * @return Unique simulation ID.
     */
    public String createSimulation() {
        String simulationId = UUID.randomUUID().toString();
        // Initialize new fields
        SimulationStatus status = new SimulationStatus(
                simulationId,
                "PENDING", // Initial overall status
                0.0, 0.0, // GA progress, ETA
                0.0, 0.0, // ACO progress, ETA
                null, null, // Combined Result, Error Message
                false, false, // gaFinished, acoFinished initialized to false
                false, false  // gaHasError, acoHasError initialized to false
        );
        simulationStatuses.put(simulationId, status);
        System.out.println("Created new simulation: " + simulationId);
        return simulationId;
    }

    /**
     * Updates the progress of a specific algorithm for a given simulation.
     * @param simulationId The ID of the simulation.
     * @param algorithmType "GA" or "ACO".
     * @param progress Percentage progress (0-100).
     * @param estimatedTimeRemaining Estimated time remaining in seconds.
     */
    public void updateProgress(String simulationId, String algorithmType, double progress, double estimatedTimeRemaining) {
        SimulationStatus status = simulationStatuses.get(simulationId);
        if (status != null) {
            if ("GA".equalsIgnoreCase(algorithmType)) {
                status.setGaProgress(progress);
                status.setGaEstimatedTimeRemaining(estimatedTimeRemaining);
            } else if ("ACO".equalsIgnoreCase(algorithmType)) {
                status.setAcoProgress(progress);
                status.setAcoEstimatedTimeRemaining(estimatedTimeRemaining);
            }
            // If overall status is PENDING, change to RUNNING.
            // If it's already RUNNING or ERROR/COMPLETED, don't change it.
            if ("PENDING".equals(status.getOverallStatus())) {
                status.setOverallStatus("RUNNING");
            }
            System.out.println("Update Progress for " + simulationId + " - " + algorithmType + ": " + progress + "%, ETA: " + estimatedTimeRemaining + "s");
        }
    }

    /**
     * Stores the final result for a specific algorithm and updates overall status based on completion.
     * This method is called by the algorithm services (GA/ACO) upon their successful completion.
     * @param simulationId The ID of the simulation.
     * @param algorithmType "GA" or "ACO".
     * @param result The final SimulationResult.
     */
    public void updateResult(String simulationId, String algorithmType, SimulationResult result) {
        SimulationStatus status = simulationStatuses.get(simulationId);
        if (status != null) {
            CombinedSimulationResult combinedResult = status.getResult();
            if (combinedResult == null) {
                combinedResult = new CombinedSimulationResult();
                status.setResult(combinedResult);
            }

            if ("GA".equalsIgnoreCase(algorithmType)) {
                combinedResult.setGaResult(result);
                status.setGaProgress(100.0); // Mark as complete
                status.setGaEstimatedTimeRemaining(0.0);
                status.setGaFinished(true); // Mark GA as finished
                System.out.println("GA finished processing for simulation " + simulationId);
            } else if ("ACO".equalsIgnoreCase(algorithmType)) {
                combinedResult.setAntColonyResult(result);
                status.setAcoProgress(100.0); // Mark as complete
                status.setAcoEstimatedTimeRemaining(0.0);
                status.setAcoFinished(true); // Mark ACO as finished
                System.out.println("ACO finished processing for simulation " + simulationId);
            }

            // Determine overall status only when both algorithms have finished their processing
            // (either successfully or with an error, as indicated by their 'finished' flags)
            if (status.isGaFinished() && status.isAcoFinished()) {
                if (status.isGaHasError() || status.isAcoHasError()) {
                    status.setOverallStatus("ERROR");
                    System.err.println("Simulation " + simulationId + " overall status set to ERROR (one or more algorithms failed).");
                } else {
                    // Check for special cases before marking as completed
                    checkForSpecialCases(status, combinedResult);
                }
            }
            System.out.println("Update Result for " + simulationId + " - " + algorithmType + ": Overall Status now " + status.getOverallStatus());
        }
    }

    /**
     * Check for special cases like "Invisible Solution" and shelf space validation
     */
    private void checkForSpecialCases(SimulationStatus status, CombinedSimulationResult combinedResult) {
        // Check if either algorithm returned 0 or negative profit (Invisible Solution)
        boolean gaZeroOrNegative = combinedResult.getGaResult() != null && 
                                   combinedResult.getGaResult().getTotalProfit() <= 0.0;
        boolean acoZeroOrNegative = combinedResult.getAntColonyResult() != null && 
                                    combinedResult.getAntColonyResult().getTotalProfit() <= 0.0;

        if (gaZeroOrNegative || acoZeroOrNegative) {
            status.setOverallStatus("INVISIBLE_SOLUTION");
            status.setErrorMessage("Infeasible Solution - One or both algorithms returned zero or negative profit");
            System.out.println("Simulation " + status.getSimulationId() + " resulted in Infeasible Solution.");
        } else {
            status.setOverallStatus("COMPLETED");
            System.out.println("Simulation " + status.getSimulationId() + " completed successfully.");
        }
    }

    /**
     * Validate shelf space before starting simulation
     * @param totalShelfSpace The total available shelf space
     * @param requiredShelfSpace The required shelf space for all products
     * @return true if validation passes, false otherwise
     */
    public boolean validateShelfSpace(double totalShelfSpace, double requiredShelfSpace) {
        return requiredShelfSpace <= totalShelfSpace;
    }

    /**
     * Set shelf space error for a simulation
     * @param simulationId The simulation ID
     * @param totalShelfSpace The total available shelf space
     * @param requiredShelfSpace The required shelf space
     */
    public void setShelfSpaceError(String simulationId, double totalShelfSpace, double requiredShelfSpace) {
        SimulationStatus status = simulationStatuses.get(simulationId);
        if (status != null) {
            status.setOverallStatus("SHELF_SPACE_ERROR");
            status.setErrorMessage("No Space in total shelf space. Required: " + requiredShelfSpace + 
                                 ", Available: " + totalShelfSpace);
            status.setGaFinished(true);
            status.setAcoFinished(true);
            System.err.println("Simulation " + simulationId + " failed due to insufficient shelf space.");
        }
    }

    /**
     * Set validation error for a simulation (e.g., invalid discount base or chromosome bits)
     * @param simulationId The simulation ID
     * @param errorMessage The validation error message
     */
    public void setValidationError(String simulationId, String errorMessage) {
        SimulationStatus status = simulationStatuses.get(simulationId);
        if (status != null) {
            status.setOverallStatus("VALIDATION_ERROR");
            status.setErrorMessage(errorMessage);
            status.setGaFinished(true);
            status.setAcoFinished(true);
            System.err.println("Simulation " + simulationId + " failed due to validation error: " + errorMessage);
        }
    }

    /**
     * Sets the simulation status to ERROR for a specific algorithm.
     * This method is called by the algorithm services (GA/ACO) upon their failure.
     * @param simulationId The ID of the simulation.
     * @param algorithmType "GA" or "ACO".
     * @param errorMessage The error message.
     */
    public void updateError(String simulationId, String algorithmType, String errorMessage) {
        SimulationStatus status = simulationStatuses.get(simulationId);
        if (status != null) {
            // Append error message to the overall error message
            String currentError = status.getErrorMessage() == null ? "" : status.getErrorMessage() + "\n";
            status.setErrorMessage(currentError + algorithmType + " Error: " + errorMessage);
            System.err.println("Simulation " + simulationId + " encountered an error in " + algorithmType + ": " + errorMessage);

            // Mark the specific algorithm as having an error and being finished
            if ("GA".equalsIgnoreCase(algorithmType)) {
                status.setGaHasError(true);
                status.setGaFinished(true);
                status.setGaProgress(100.0); // Set progress to 100% on error to indicate it's done processing
                status.setGaEstimatedTimeRemaining(0.0);
            } else if ("ACO".equalsIgnoreCase(algorithmType)) {
                status.setAcoHasError(true);
                status.setAcoFinished(true);
                status.setAcoProgress(100.0); // Set progress to 100% on error to indicate it's done processing
                status.setAcoEstimatedTimeRemaining(0.0);
            }

            // Determine overall status only when both algorithms have finished their processing
            if (status.isGaFinished() && status.isAcoFinished()) {
                status.setOverallStatus("ERROR"); // Overall is ERROR if any algorithm finished with an error
                System.err.println("Simulation " + simulationId + " overall status set to ERROR due to " + algorithmType + " failure.");
            }
            System.out.println("Update Error for " + simulationId + " - " + algorithmType + ": Overall Status now " + status.getOverallStatus());
        }
    }

    /**
     * Retrieves the current status of a simulation.
     * @param simulationId The ID of the simulation.
     * @return The SimulationStatus object, or null if not found.
     */
    public SimulationStatus getStatus(String simulationId) {
        return simulationStatuses.get(simulationId);
    }

    /**
     * Removes a simulation's status from memory (e.g., after client retrieves final result).
     * @param simulationId The ID of the simulation to clean up.
     */
    public void cleanupSimulation(String simulationId) {
        simulationStatuses.remove(simulationId);
        System.out.println("Cleaned up simulation: " + simulationId);
    }
}
