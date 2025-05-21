package com.fashionopt.dto;

import java.util.List;

public class CombinedSimulationResult {
    private SimulationResult gaResult;
    private SimulationResult antColonyResult;
    
    public SimulationResult getGaResult() {
        return gaResult;
    }
    
    public void setGaResult(SimulationResult gaResult) {
        this.gaResult = gaResult;
    }
    
    public SimulationResult getAntColonyResult() {
        return antColonyResult;
    }
    
    public void setAntColonyResult(SimulationResult antColonyResult) {
        this.antColonyResult = antColonyResult;
    }
}
