package com.fashionopt.controller;

import com.fashionopt.dto.SimulationRequest;
import com.fashionopt.dto.SimulationResult;
import com.fashionopt.service.FileStorageService;
import com.fashionopt.service.GAService;
import java.nio.file.Path;
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

    @PostMapping({"/simulate"})
    public ResponseEntity<SimulationResult> runSimulation(@ModelAttribute SimulationRequest request) {
        try {
            System.out.println("Received simulation request: " + String.valueOf(request));
            Path filePath = this.fileStorageService.storeFile(request.getFile());
            System.out.println("File stored at: " + String.valueOf(filePath));
            SimulationResult result = this.gaService.runOptimization(filePath, request);
            System.out.println("Simulation result: " + String.valueOf(result));
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("Simulation error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new SimulationResult());
        }
    }
}
