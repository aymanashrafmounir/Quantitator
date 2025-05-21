package com.fashionopt.service;

import org.springframework.stereotype.Service;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.util.HashMap;
import java.util.Map;

@Service
public class PythonIntegrationService {

    /**
     * Enhances Python scripts to output additional data for Gemini
     */
    public void enhancePythonScripts(String scriptDir) throws IOException {
        // Enhance GA.py
        enhanceGAScript(scriptDir);
        
        // Enhance ant.py
        enhanceAntScript(scriptDir);
    }
    
    private void enhanceGAScript(String scriptDir) throws IOException {
        Path gaPath = Paths.get(scriptDir, "GA.py");
        if (!Files.exists(gaPath)) {
            throw new IOException("GA.py not found at: " + gaPath);
        }
        
        // Read the script content
        String content = new String(Files.readAllBytes(gaPath));
        
        // Check if already enhanced
        if (content.contains("# GEMINI ENHANCEMENT")) {
            return; // Already enhanced
        }
        
        // Add detailed data export function
        String enhancementCode = "\n\n# GEMINI ENHANCEMENT\n" +
                "def export_detailed_data(data_df, params, results):\n" +
                "    \"\"\"Export all data, parameters, and results in a format Gemini can process\"\"\"\n" +
                "    detailed_output = {\n" +
                "        \"input_data\": data_df.to_dict(orient=\"records\"),\n" +
                "        \"parameters\": {\n" +
                "            \"production_budget\": params.get('budget_production', 0),\n" +
                "            \"marketing_budget\": params.get('budget_marketing', 0),\n" +
                "            \"logistics_budget\": params.get('budget_logistics', 0),\n" +
                "            \"shelf_space\": params.get('shelf_capacity', 0),\n" +
                "            \"discount_base\": params.get('d_base', 0)\n" +
                "        },\n" +
                "        \"results\": results,\n" +
                "        \"algorithm\": \"genetic_algorithm\"\n" +
                "    }\n" +
                "    with open('ga_detailed_output.json', 'w') as f:\n" +
                "        json.dump(detailed_output, f, indent=2)\n" +
                "    return detailed_output\n";
        
        // Find the right spot to insert the enhancement
        int insertIndex = content.lastIndexOf("if __name__ == \"__main__\":");
        if (insertIndex == -1) {
            // Append to the end if main block not found
            content += enhancementCode;
        } else {
            content = content.substring(0, insertIndex) + enhancementCode + content.substring(insertIndex);
        }
        
        // Add call to the function in the main block
        String mainEnhancement = "\n    # Export detailed data for Gemini\n" +
                "    detailed_data = export_detailed_data(df, {\n" +
                "        'budget_production': args.bp,\n" +
                "        'budget_marketing': args.bm,\n" +
                "        'budget_logistics': args.bl,\n" +
                "        'shelf_capacity': args.s_max,\n" +
                "        'd_base': args.d_base\n" +
                "    }, results)\n";
        
        // Find print(json.dumps(results)) and add our code after it
        int printIndex = content.indexOf("print(json.dumps(results))");
        if (printIndex != -1) {
            content = content.substring(0, printIndex + 25) + mainEnhancement + content.substring(printIndex + 25);
        }
        
        // Write the enhanced script
        Files.write(gaPath, content.getBytes(), StandardOpenOption.TRUNCATE_EXISTING);
    }
    
    private void enhanceAntScript(String scriptDir) throws IOException {
        Path antPath = Paths.get(scriptDir, "ant.py");
        if (!Files.exists(antPath)) {
            throw new IOException("ant.py not found at: " + antPath);
        }
        
        // Similar enhancement as GA.py but for ant.py
        // Read the script content
        String content = new String(Files.readAllBytes(antPath));
        
        // Check if already enhanced
        if (content.contains("# GEMINI ENHANCEMENT")) {
            return; // Already enhanced
        }
        
        // Add detailed data export function
        String enhancementCode = "\n\n# GEMINI ENHANCEMENT\n" +
                "def export_detailed_data(data_df, params, results):\n" +
                "    \"\"\"Export all data, parameters, and results in a format Gemini can process\"\"\"\n" +
                "    detailed_output = {\n" +
                "        \"input_data\": data_df.to_dict(orient=\"records\"),\n" +
                "        \"parameters\": {\n" +
                "            \"production_budget\": params.get('budget_production', 0),\n" +
                "            \"marketing_budget\": params.get('budget_marketing', 0),\n" +
                "            \"logistics_budget\": params.get('budget_logistics', 0),\n" +
                "            \"shelf_space\": params.get('shelf_capacity', 0),\n" +
                "            \"discount_base\": params.get('d_base', 0)\n" +
                "        },\n" +
                "        \"results\": results,\n" +
                "        \"algorithm\": \"ant_colony_optimization\"\n" +
                "    }\n" +
                "    with open('aco_detailed_output.json', 'w') as f:\n" +
                "        json.dump(detailed_output, f, indent=2)\n" +
                "    return detailed_output\n";
        
        // Find the right spot to insert the enhancement
        int insertIndex = content.lastIndexOf("if __name__ == \"__main__\":");
        if (insertIndex == -1) {
            // Append to the end if main block not found
            content += enhancementCode;
        } else {
            content = content.substring(0, insertIndex) + enhancementCode + content.substring(insertIndex);
        }
        
        // Add call to the function in the main block
        String mainEnhancement = "\n    # Export detailed data for Gemini\n" +
                "    detailed_data = export_detailed_data(df, {\n" +
                "        'budget_production': args.bp,\n" +
                "        'budget_marketing': args.bm,\n" +
                "        'budget_logistics': args.bl,\n" +
                "        'shelf_capacity': args.s_max,\n" +
                "        'd_base': args.d_base\n" +
                "    }, results)\n";
        
        // Find print(json.dumps(results)) and add our code after it
        int printIndex = content.indexOf("print(json.dumps(results))");
        if (printIndex != -1) {
            content = content.substring(0, printIndex + 25) + mainEnhancement + content.substring(printIndex + 25);
        }
        
        // Write the enhanced script
        Files.write(antPath, content.getBytes(), StandardOpenOption.TRUNCATE_EXISTING);
    }
    
    /**
     * Reads the detailed output JSON files produced by the Python scripts
     */
    public Map<String, String> readDetailedOutputFiles(String scriptDir) {
        Map<String, String> outputs = new HashMap<>();
        
        try {
            Path gaOutputPath = Paths.get(scriptDir, "ga_detailed_output.json");
            if (Files.exists(gaOutputPath)) {
                outputs.put("ga", new String(Files.readAllBytes(gaOutputPath)));
            }
            
            Path acoOutputPath = Paths.get(scriptDir, "aco_detailed_output.json");
            if (Files.exists(acoOutputPath)) {
                outputs.put("aco", new String(Files.readAllBytes(acoOutputPath)));
            }
        } catch (IOException e) {
            // Log error but continue
            System.err.println("Error reading detailed output files: " + e.getMessage());
        }
        
        return outputs;
    }
    
    /**
     * Validates the Python environment
     */
    public void validatePythonEnvironment(String scriptDir) throws IOException {
        // Check if directory exists
        Path dir = Paths.get(scriptDir);
        if (!Files.exists(dir) || !Files.isDirectory(dir)) {
            throw new IOException("Script directory does not exist: " + scriptDir);
        }
        
        // Check if Python scripts exist
        Path gaPath = dir.resolve("GA.py");
        Path antPath = dir.resolve("ant.py");
        
        if (!Files.exists(gaPath)) {
            throw new IOException("GA.py not found in: " + scriptDir);
        }
        
        if (!Files.exists(antPath)) {
            throw new IOException("ant.py not found in: " + scriptDir);
        }
        
        // Test Python execution
        ProcessBuilder pb = new ProcessBuilder("python", "--version");
        try {
            Process process = pb.start();
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new IOException("Python execution failed with exit code: " + exitCode);
            }
        } catch (Exception e) {
            throw new IOException("Error executing Python: " + e.getMessage());
        }
    }
}
