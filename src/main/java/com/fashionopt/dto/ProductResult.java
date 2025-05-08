package com.fashionopt.dto;

import lombok.Getter;
import lombok.Setter;

@lombok.Data
@Getter
@Setter

public class ProductResult {
    private String name;
    private int quantity;
    private double price;
    private double unitCost;
    private double profitPerUnit;
    private double totalProfit;
    private double totalCost;
}
