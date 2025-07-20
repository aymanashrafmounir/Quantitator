package com.fashionopt.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Setter
@Getter
public class CombinedSimulationResult {
    private SimulationResult gaResult;
    private SimulationResult antColonyResult;

}
