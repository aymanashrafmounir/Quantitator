package com.fashionopt.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@lombok.Data
@Getter
@Setter
public class SimulationRequest {
    private MultipartFile file;
    private double productionBudget;
    private double marketingBudget;
    private double logisticsBudget;
    private double discountBase;
    private double shelfSpace;
    private int chromosomeBits;
}
