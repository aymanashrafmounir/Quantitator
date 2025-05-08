
package com.fashionopt.dto;

import java.util.List;
import lombok.Getter;
import lombok.Setter;

@lombok.Data
@Getter
@Setter
public class SimulationResult {
    private double totalProfit;
    private int productCount;
    private List<ProductResult> products;
}