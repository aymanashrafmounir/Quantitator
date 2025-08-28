# Quantitator: Revolutionize Your Fashion Pricing with AI-Powered Optimization! 🚀

![Quantitator Logo](https://via.placeholder.com/150x50?text=Quantitator)  <!-- Placeholder; replace with actual logo if available -->

**Unlock Maximum Profitability in Fashion Retail – Smart, Fast, and Effortless!**  
Tired of guesswork in pricing and inventory? Quantitator uses cutting-edge Genetic Algorithms (GA) and Ant Colony Optimization (ACO) to supercharge your e-commerce strategy. Predict profits, optimize production, and dominate the market – all in minutes! 💰📈

## Why Quantitator? Spark Your Business Growth! ✨
- **AI-Driven Insights**: Harness powerful algorithms for real-time pricing optimization and profit maximization.
- **User-Friendly Interface**: Intuitive dashboard, easy uploads, and interactive AI chat for seamless experience.
- **Real-Time Progress & Estimates**: Watch your simulations evolve with progress bars and time predictions – no more waiting in the dark!
- **Robust Error Handling**: Smart detections for invisible solutions, shelf space issues, and more, with helpful guidance to fix them.
- **Proven Results**: From total profits to per-product breakdowns, get actionable data visualized beautifully.

Whether you're a fashion startup or a retail giant, Quantitator turns data into dollars. Ready to optimize? Let's dive in! 👗🛒

## Screenshots: See the Magic in Action! 📸
Check out these glimpses of Quantitator's sleek interface and powerful features:

![Dashboard Overview](Screenshots/screenshot1.png)  
*The main dashboard showing predicted profits and optimal products – your gateway to smarter pricing!*

![AI Chat Assistant](Screenshots/screenshot2.png)  
*Chat with our FashionOpt AI for instant help and insights – like having an expert on speed dial!*

![Simulation Setup](Screenshots/screenshot3.png)  
*Upload your data and tweak parameters effortlessly – budgets, discounts, and more at your fingertips!*

![Simulation Results](Screenshots/screenshot4.png)  
*Detailed analysis with GA results: profits, units, top products – data that drives decisions!*

![Visual Analytics](Screenshots/screenshot5.png)  
*Stunning charts for production quantities, profit contributions, and cost vs. profit – visualize success!*

## Overview: The Ultimate E-Commerce Booster 🔧
This enhanced project transforms fashion pricing with AI. We've added real-time tracking, smart validations, and user-centric features to make optimization a breeze.

## Epic New Features That'll Blow Your Mind! 🌟

### 1. Time Estimation and Progress Tracking ⏱️
- **Real-time Progress Display**: Both GA and ACO algorithms now show progress percentage and estimated time remaining.
- **Initial Time Estimates**: When simulation starts, users see initial time estimates (typically 2 minutes).
- **Dynamic Updates**: Time estimates are updated based on actual algorithm progress.
- **Progress Bars**: Visual progress bars in the frontend show completion status.

### 2. Enhanced Error Handling 🛡️
- **Python Script Errors**: Better detection and reporting of Python script errors.
- **Missing Dependencies**: Specific error messages for missing Python modules.
- **JSON Parsing Errors**: Improved handling of malformed output from Python scripts.
- **Traceback Detection**: Automatic detection of Python tracebacks and error reporting.

### 3. Edge Case Handling: We've Got Your Back! ⚠️

#### Invisible Solution
- **Detection**: When *either* algorithm returns zero or negative profit.
- **Message**: "Invisible Solution - One or both algorithms returned zero or negative profit".
- **Guidance**: Suggests parameter adjustment or data review.
- **Status**: Special "INVISIBLE_SOLUTION" status in the system.

#### Shelf Space Validation
- **Pre-validation**: Checks if required shelf space exceeds available capacity before starting simulation.
- **Calculation**: Automatically calculates total required shelf space from uploaded data.
- **Error Message**: "No Space in total shelf space - Required: X, Available: Y".
- **Early Termination**: Prevents unnecessary algorithm execution when space is insufficient.

#### Input Validation
- **Discount Base**: Must be between 0.1 and 0.5 (inclusive).
- **Chromosome Bits**: Must be between 10 and 100 (inclusive).
- **Error Message**: Specific messages for invalid input ranges.
- **Early Termination**: Prevents simulation from starting with invalid parameters.

### 4. Improved Frontend Experience 🎨
- **Status Messages**: Clear, user-friendly status messages for different scenarios.
- **Time Display**: Shows estimated time remaining during simulation.
- **Error Categorization**: Different message types (info, warning, error, success).
- **Better Visual Feedback**: Enhanced progress indicators and status displays.

## Technical Enhancements: Under the Hood 🛠️

### Backend Changes
1. **SimulationStatusService**:
   - Added `checkForSpecialCases()` method for edge case detection.
   - Added `validateShelfSpace()` method for pre-validation.
   - Added `setShelfSpaceError()` method for shelf space error handling.

2. **GAService & AntColonyService**:
   - Enhanced error detection and reporting.
   - Better time estimation logic.
   - Improved Python script output parsing.
   - Added support for progress message parsing.

3. **SimulationController**:
   - Added shelf space validation before simulation start.
   - Added initial time estimate setting.
   - Enhanced error handling for setup failures.

### Frontend Changes
1. **Enhanced Status Processing**:
   - Support for new status types: "INVISIBLE_SOLUTION", "SHELF_SPACE_ERROR".
   - Improved time estimation display.
   - Better error message categorization.

2. **User Experience**:
   - More informative status messages.
   - Visual progress indicators.
   - Contextual guidance for different scenarios.

### Python Script Enhancements
1. **Progress Reporting**:
   - Added progress output in format: `[PROGRESS] GA/ACO: X% completed, estimated Ys remaining`.
   - Real-time progress calculation based on generation/iteration count.
   - Dynamic time estimation based on elapsed time.

2. **Better Error Handling**:
   - Improved error detection and reporting.
   - Flush output for real-time progress updates.

## Installation and Usage: Get Started in Minutes! 🚀

### Prerequisites
- Java 17 or higher.
- Python 3.11 with required packages (pandas, numpy, etc.).
- Maven for building the project.

### Building the Project
```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./mvnw compile
./mvnw spring-boot:run
```

### Running the Application
1. Start the Spring Boot application.
2. Open your browser to `http://localhost:8080`.
3. Upload your CSV/Excel file with product data.
4. Configure simulation parameters.
5. Run the simulation and monitor progress in real-time.

## New Status Types: Know What's Happening 📊
### COMPLETED
- Both algorithms finished successfully.
- Results are available for viewing.

### INVISIBLE_SOLUTION
- Both algorithms returned zero profit.
- Suggests parameter adjustment or data review.

### SHELF_SPACE_ERROR
- Required shelf space exceeds available capacity.
- Simulation terminated early to save resources.

### ERROR
- One or more algorithms failed.
- Detailed error messages provided.

## File Structure: Organized for Success 📂
```
enhanced_project/
├── src/main/java/com/fashionopt/
│   ├── controller/
│   │   └── SimulationController.java (enhanced)
│   ├── service/
│   │   ├── SimulationStatusService.java (enhanced)
│   │   ├── GAService.java (enhanced)
│   │   └── AntColonyService.java (enhanced)
│   └── dto/ (unchanged)
├── src/main/resources/static/
│   └── script.js (enhanced)
├── GA.py (enhanced with progress reporting)
├── ant.py (enhanced with progress reporting)
├── Screenshots/
│   ├── screenshot1.png
│   ├── screenshot2.png
│   ├── screenshot3.png
│   ├── screenshot4.png
│   └── screenshot5.png
└── README.md (this file)
```

## Backward Compatibility: Smooth as Silk 🔄
All existing functionality has been preserved. The enhancements are additive and do not break existing features.

## Future Improvements: The Sky's the Limit! ☁️
- More granular progress reporting.
- Advanced error recovery mechanisms.
- Additional validation rules.
- Performance optimizations.

## Python Environment Configuration: Set Up for Success 🐍

### 1. Python Installation
Ensure you have Python 3.x installed on your system. The application will attempt to use `python3.11`, `python3`, or `python` in that order. You can download Python from the official website: [https://www.python.org/downloads/](https://www.python.org/downloads/)

### 2. Add Python to PATH (if not already)
During Python installation, make sure to check the option "Add Python to PATH" or manually add it to your system's environment variables. This allows the Java application to find the Python executable.

### 3. Install Required Python Packages
Navigate to the `enhanced_project` directory (where `GA.py` and `ant.py` are located) in your terminal and install the necessary packages using pip:

```bash
pip install pandas openpyxl numpy
```

These packages are essential for the Python algorithms to function correctly.

**Ready to Transform Your Fashion Business? Clone, Run, and Profit!** 💥  
Questions? Drop a line or contribute – let's make Quantitator even better together! 🌍