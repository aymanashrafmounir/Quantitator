package com.fashionopt.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SimulationStatus {
    private String simulationId;
    private String overallStatus; // PENDING, RUNNING, COMPLETED, ERROR
    private Double gaProgress; // Percentage 0-100
    private Double gaEstimatedTimeRemaining; // Seconds
    private Double acoProgress; // Percentage 0-100
    private Double acoEstimatedTimeRemaining; // Seconds
    private CombinedSimulationResult result; // Final results, null until COMPLETED
    private String errorMessage; // Stores error message if status is ERROR

    // New fields to track individual algorithm completion and error status
    private boolean gaFinished;
    private boolean acoFinished;
    private boolean gaHasError;
    private boolean acoHasError;
}
