document.addEventListener("DOMContentLoaded", () => {
    // Configuration
    const API_URL = "http://localhost:8080/api/simulate";
    const FETCH_TIMEOUT = 30000;

    // --- DOM Elements ---
    const navLinks = document.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll(".section");
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("file-input");
    const fileInfoDiv = document.getElementById("file-info");
    const fileNameSpan = document.getElementById("filename");
    const rowCountSpan = document.getElementById("row-count");
    const columnMappingDiv = document.getElementById("column-mapping");
    const runSimulationButton = document.getElementById("run-simulation");
    const buttonText = runSimulationButton.querySelector(".button-text");
    const buttonSpinner = runSimulationButton.querySelector(".spinner"); // Spinner for the button itself
    const generalUploadFeedback = document.getElementById("general-upload-feedback");
    const formValidationSummary = document.getElementById("form-validation-summary");

    // Global Loader
    const globalLoaderOverlay = document.getElementById("global-loader-overlay");

    // Results section elements
    const resultsContentWrapper = document.getElementById("results-content-wrapper");
    const resultsMessageArea = document.getElementById("results-message-area");
    const resultsMessageText = document.getElementById("results-message-text");
    const resultsTablePlaceholder = document.getElementById("results-table-placeholder"); // This is inside results-content-wrapper
    const resultsTableActual = document.getElementById("results-table-actual");
    const resultsTableBody = resultsTableActual.querySelector("tbody");

    // KPI Elements (inside results-content-wrapper)
    const totalProfitEl = document.getElementById("total-profit");
    const productsCountEl = document.getElementById("products-count");
    const totalUnitsProducedEl = document.getElementById("total-units-produced");
    const avgProfitPerProductEl = document.getElementById("avg-profit-per-product");
    const avgQuantityPerProductEl = document.getElementById("avg-quantity-per-product");
    const topProfitProductNameEl = document.getElementById("top-profit-product-name");
    const topProfitProductValueEl = document.getElementById("top-profit-product-value");
    const topQuantityProductNameEl = document.getElementById("top-quantity-product-name");
    const topQuantityProductValueEl = document.getElementById("top-quantity-product-value");
    const topProfitProductCard = document.getElementById("top-profit-product-card");
    const topQuantityProductCard = document.getElementById("top-quantity-product-card");

    // Dashboard metrics (to keep in sync)
    const dashboardProfitMetricEl = document.getElementById("profit-metric");
    const dashboardProductsMetricEl = document.getElementById("products-metric");

    let uploadedData = [];

    // --- Chart Instances ---
    let productionChart, profitContributionChart, costProfitChart;
    const productionChartCtx = document.getElementById("productionChart").getContext("2d");
    const profitContributionChartCtx = document.getElementById("profitContributionChart").getContext("2d");
    const costProfitChartCtx = document.getElementById("costProfitChart").getContext("2d");

    const chartDefaultOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                ticks: { color: "var(--text-color-secondary)", font: { family: "var(--font-primary)"} },
                grid: { color: "rgba(238, 238, 238, 0.1)" }
            },
            x: {
                ticks: { color: "var(--text-color-secondary)", font: { family: "var(--font-primary)"} },
                grid: { display: false }
            }
        },
        plugins: {
            legend: {
                labels: { 
                    color: "var(--text-color-secondary)", 
                    font: { family: "var(--font-primary)", size: 14 }
                }
            },
            tooltip: {
                backgroundColor: "var(--secondary-bg-color)",
                titleColor: "var(--accent-color-secondary)",
                bodyColor: "var(--text-color-secondary)",
                titleFont: { family: "var(--font-headings)"},
                bodyFont: { family: "var(--font-primary)"}
            }
        }
    };

    // --- SPA Navigation ---
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            sections.forEach(section => section.classList.remove("active"));
            document.getElementById(link.dataset.section).classList.add("active");
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
        });
    });

    // --- File Handling (Identical to previous version, omitted for brevity in thought process, but included in final code) ---
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", handleFileChange);
    ["dragenter", "dragover"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }, false);
    });
    ["dragleave", "drop"].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }, false);
    });
    dropZone.addEventListener("drop", handleFileDrop, false);
    function handleFileChange(e) { const file = e.target.files[0]; if (file) processUploadedFile(file); }
    function handleFileDrop(e) { const files = e.dataTransfer.files; if (files.length) processUploadedFile(files[0]); }
    function processUploadedFile(file) {
        clearGeneralUploadFeedback();
        if (!file.name.endsWith(".csv") && !file.name.endsWith(".xlsx")) {
            showGeneralUploadFeedback("Unsupported file format. Please upload CSV or XLSX.");
            fileInput.value = ""; return;
        }
        fileInfoDiv.classList.remove("hidden");
        fileNameSpan.textContent = file.name;
        const reader = new FileReader();
        reader.onload = (e) => { const data = new Uint8Array(e.target.result); parseFileData(file, data); };
        reader.readAsArrayBuffer(file);
    }
    function parseFileData(file, data) {
        try {
            if (file.name.endsWith(".xlsx")) {
                const workbook = XLSX.read(data, { type: "array" });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                uploadedData = XLSX.utils.sheet_to_json(worksheet);
                updateFileInfoDisplay();
                createColumnMappingUI(XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0]);
            } else if (file.name.endsWith(".csv")) {
                const csvData = new TextDecoder().decode(data);
                const rows = csvData.split("\n").filter(row => row.trim() !== "");
                if (rows.length < 2) throw new Error("CSV file must contain headers and at least one data row.");
                const headers = rows[0].split(",").map(h => h.trim());
                uploadedData = rows.slice(1).map(row => {
                    const values = row.split(",").map(v => v.trim());
                    return headers.reduce((obj, header, index) => { obj[header] = values[index] || ""; return obj; }, {});
                });
                updateFileInfoDisplay();
                createColumnMappingUI(headers);
            }
        } catch (error) {
            console.error("Error processing file:", error);
            showGeneralUploadFeedback(`Error processing file: ${error.message}`);
            fileInfoDiv.classList.add("hidden"); uploadedData = [];
        }
    }
    function updateFileInfoDisplay() { rowCountSpan.textContent = uploadedData.length; }
    function createColumnMappingUI(headers) {
        columnMappingDiv.innerHTML = `
    <h3>Map Data Columns</h3>
    <p style="font-size:0.85rem; color: var(--text-color-secondary); margin-bottom:1rem;">
        Select a column from your uploaded Excel/CSV file for each required parameter.
    </p>`;

        const expectedParams = [
            { key: "product_name", label: "Product Name" },
            { key: "price", label: "Price" },
            { key: "production_cost", label: "Production Cost" },
            { key: "marketing_cost", label: "Marketing Cost" },
            { key: "Logistics_Cost_Per_Unit", label: "Logistics Cost" },
            { key: "Shelf_Space_Cost_Per_Unit", label: "Shelf Space Cost" },
            { key: "Remaining_Products", label: "Remaining Products" },
            { key: "Age", label: "Age" },
            { key: "demand", label: "Demand" },
            { key: "shelf_space", label: "Shelf Space" }
        ];

        expectedParams.forEach(param => {
            const div = document.createElement("div");
            div.className = "mapping-group";

            const firstWord = param.label.toLowerCase().split(/\s+/)[0];

            let matchedHeader = headers.find(header => {
                const headerWords = header.toLowerCase().split(/[\s_]+/);
                return headerWords.includes(firstWord);
            });

            let optionsHtml = "<option value=\"\">-- Select Column --</option>";
            headers.forEach(header => {
                const selected = (header === matchedHeader) ? "selected" : "";
                optionsHtml += `<option value="${header}" ${selected}>${header}</option>`;
            });

            div.innerHTML = `
        <label for="map-${param.key}">${param.label}:</label>
        <select id="map-${param.key}" class="param-select" data-param="${param.key}">
            ${optionsHtml}
        </select>
        `;
            columnMappingDiv.appendChild(div);
        });
    }




    function getColumnMappings() {
        const mappings = {};
        document.querySelectorAll(".param-select").forEach(select => { if (select.value) { mappings[select.dataset.column] = select.value; } });
        return mappings;
    }

    // --- Chart Initialization ---
    function initializeCharts() {
        if (productionChart) productionChart.destroy();
        if (profitContributionChart) profitContributionChart.destroy();
        if (costProfitChart) costProfitChart.destroy();

        productionChart = new Chart(productionChartCtx, {
            type: "bar",
            data: { labels: [], datasets: [{ label: "Optimal Production Quantity", data: [], backgroundColor: "rgba(0, 173, 181, 0.7)", borderColor: "rgba(0, 173, 181, 1)", borderWidth: 1, hoverBackgroundColor: "rgba(0, 173, 181, 0.9)" }] },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });
        profitContributionChart = new Chart(profitContributionChartCtx, {
            type: "pie",
            data: { labels: [], datasets: [{ label: "Profit Contribution", data: [], backgroundColor: ["rgba(0, 173, 181, 0.7)", "rgba(54, 162, 235, 0.7)", "rgba(255, 206, 86, 0.7)", "rgba(75, 192, 192, 0.7)", "rgba(153, 102, 255, 0.7)", "rgba(255, 159, 64, 0.7)", "rgba(255, 99, 132, 0.7)", "rgba(201, 203, 207, 0.7)", "rgba(100, 150, 200, 0.7)", "rgba(220, 120, 80, 0.7)"] }] },
            options: { ...JSON.parse(JSON.stringify(chartDefaultOptions)), scales: {} }
        });
        costProfitChart = new Chart(costProfitChartCtx, {
            type: "bar",
            data: { labels: [], datasets: [{ label: "Total Cost", data: [], backgroundColor: "rgba(255, 99, 132, 0.7)", borderColor: "rgba(255, 99, 132, 1)", borderWidth: 1 }, { label: "Total Profit", data: [], backgroundColor: "rgba(75, 192, 192, 0.7)", borderColor: "rgba(75, 192, 192, 1)", borderWidth: 1 }] },
            options: JSON.parse(JSON.stringify(chartDefaultOptions))
        });
    }
    initializeCharts();

    // --- Input Validation (Identical to previous version, omitted for brevity, but included in final code) ---
    const budgetInputs = [{ id: "production-budget", label: "Production Budget", min: 0 }, { id: "marketing-budget", label: "Marketing Budget", min: 0 }, { id: "logistics-budget", label: "Logistics Budget", min: 0 }, { id: "discount_base", label: "Discount Base", min: 0, max:100, isFloat: true }, { id: "space_storage", label: "Shelf Space Storage", min: 0 }, { id: "bits_number", label: "Chromosome Bits", min: 1 }];
    function validateInputs() {
        clearAllValidationMessages(); let isValid = true; let errorMessages = [];
        budgetInputs.forEach(({ id, label, min, max, isFloat }) => {
            const inputElement = document.getElementById(id); const value = inputElement.value.trim(); const errorElement = document.getElementById(`${id}-error`);
            if (value === "") { showValidationError(inputElement, errorElement, `${label} is required.`); errorMessages.push(`${label} is required.`); isValid = false; return; }
            const numValue = isFloat ? parseFloat(value) : parseInt(value, 10);
            if (isNaN(numValue)) { showValidationError(inputElement, errorElement, `${label} must be a valid number.`); errorMessages.push(`${label} must be a valid number.`); isValid = false; return; }
            if (min !== undefined && numValue < min) { showValidationError(inputElement, errorElement, `${label} must be at least ${min}.`); errorMessages.push(`${label} must be at least ${min}.`); isValid = false; }
            if (max !== undefined && numValue > max) { showValidationError(inputElement, errorElement, `${label} must not exceed ${max}.`); errorMessages.push(`${label} must not exceed ${max}.`); isValid = false; }
        });
        if (!fileInput.files[0]) { showGeneralUploadFeedback("Please upload a product data file (CSV/XLSX)."); errorMessages.push("Product data file is required."); isValid = false; }
        if (!isValid) showFormValidationSummary(errorMessages);
        return isValid;
    }
    function showValidationError(inputElement, errorElement, message) { inputElement.classList.add("invalid"); if (errorElement) errorElement.textContent = message; }
    function clearAllValidationMessages() {
        budgetInputs.forEach(({ id }) => { document.getElementById(id).classList.remove("invalid"); const errorElement = document.getElementById(`${id}-error`); if (errorElement) errorElement.textContent = ""; });
        clearGeneralUploadFeedback(); formValidationSummary.classList.add("hidden"); formValidationSummary.innerHTML = "";
    }
    function showGeneralUploadFeedback(message) { generalUploadFeedback.textContent = message; generalUploadFeedback.style.color = "var(--error-color)"; }
    function clearGeneralUploadFeedback() { generalUploadFeedback.textContent = ""; }
    function showFormValidationSummary(messages) { formValidationSummary.innerHTML = "<strong>Please correct the following errors:</strong><ul>" + messages.map(msg => `<li>${msg}</li>`).join("") + "</ul>"; formValidationSummary.classList.remove("hidden"); }

    // --- UI State Management for Results ---
    function showResultsMessage(message, type = "info") {
        resultsMessageText.textContent = message;
        resultsMessageArea.className = "results-message-area"; // Reset classes
        resultsMessageArea.classList.add(type); // Add type class (info, warning, error)
        resultsMessageArea.classList.remove("hidden");
        resultsContentWrapper.classList.add("hidden"); // Hide actual results content
    }

    function clearResultsDisplay() {
        resultsMessageArea.classList.add("hidden");
        resultsMessageText.textContent = "";
        resultsContentWrapper.classList.add("hidden"); // Ensure results are hidden
        
        // Reset KPIs in the results section to default
        totalProfitEl.textContent = "$0.00";
        productsCountEl.textContent = "0";
        totalUnitsProducedEl.textContent = "0";
        avgProfitPerProductEl.textContent = "$0.00";
        avgQuantityPerProductEl.textContent = "0";
        topProfitProductNameEl.textContent = "N/A";
        topProfitProductValueEl.textContent = "$0.00";
        topProfitProductCard.classList.add("hidden");
        topQuantityProductNameEl.textContent = "N/A";
        topQuantityProductValueEl.textContent = "0 units";
        topQuantityProductCard.classList.add("hidden");

        // Reset charts
        initializeCharts(); 

        // Reset table
        resultsTableBody.innerHTML = "";
        resultsTableActual.classList.add("hidden");
        resultsTablePlaceholder.classList.remove("hidden");
        resultsTablePlaceholder.querySelector("p").textContent = "No results to display yet. Run a simulation to see product details.";
    }

    // --- Simulation Logic ---
    runSimulationButton.addEventListener("click", async () => {
        if (!validateInputs()) return;

        // Show global loader and clear previous results/messages
        globalLoaderOverlay.classList.remove("hidden");
        buttonText.classList.add("hidden"); // Hide button text, show button spinner
        buttonSpinner.classList.remove("hidden");
        runSimulationButton.disabled = true;
        runSimulationButton.classList.add("loading");
        
        clearResultsDisplay(); // Clear previous results and messages from results section
        showResultsMessage("Simulation in progress, please wait...", "info"); // Show waiting message

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);
        budgetInputs.forEach(({ id }) => {
            let backendKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase()); // Fix here
            if (id === "bits_number") backendKey = "chromosomeBits";
            else if (id === "space_storage") backendKey = "shelfSpace";
            else if (id === "discount_base") backendKey = "discountBase";
            formData.append(backendKey, document.getElementById(id).value);
        });
        const mappings = getColumnMappings();
        if (Object.keys(mappings).length > 0) {
            formData.append("columnMappings", JSON.stringify(mappings));
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const response = await fetch(API_URL, {
                method: "POST", body: formData, headers: { "Accept": "application/json" }, signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText || "Unknown server error"}`);
            }

            const results = await response.json();
            if (!results || typeof results.totalProfit !== "number" || !Array.isArray(results.products)) {
                throw new Error("Invalid response format from server.");
            }
            updateResultsUI(results); // This will handle showing results or "Unfeasible"

        } catch (error) {
            console.error("Simulation error:", error);
            let userMessage = `Simulation failed: ${error.message}.`;
            if (error.name === "AbortError") {
                userMessage = "Simulation request timed out. Please try again.";
            }
            // Display error in the form summary AND in the results message area
            showFormValidationSummary([userMessage]); 
            showResultsMessage(userMessage, "error");
        } finally {
            // Hide global loader and reset button state
            globalLoaderOverlay.classList.add("hidden");
            buttonText.classList.remove("hidden");
            buttonSpinner.classList.add("hidden");
            runSimulationButton.disabled = false;
            runSimulationButton.classList.remove("loading");
        }
    });

    // setLoadingState is now integrated into the runSimulationButton listener

    function updateResultsUI(results) {
        const products = results.products || [];
        const overallTotalProfit = results.totalProfit || 0;
        const numOptimizedProducts = products.length;

        // Hide the generic message area first, then decide if we show results or a specific message
        resultsMessageArea.classList.add("hidden");
        resultsContentWrapper.classList.remove("hidden"); // Make results content visible by default

        // Handle Unfeasible scenario (profit is zero)
        if (overallTotalProfit === 0) {
            sections.forEach(section => section.classList.remove("active"));
            document.getElementById("results").classList.add("active");
            navLinks.forEach(l => l.classList.remove("active"));
            document.querySelector(".nav-link[data-section='results']").classList.add("active");

            showResultsMessage(
                "Error: The simulation is infeasible (zero profit or no solution found).",
                "error"
            );
            dashboardProfitMetricEl.textContent = "$0.00";
            dashboardProductsMetricEl.textContent = "0";
            return; // Stop further processing
        }


        // Update dashboard metrics for successful, feasible results
        dashboardProfitMetricEl.textContent = `$${overallTotalProfit.toFixed(2)}`;
        dashboardProductsMetricEl.textContent = numOptimizedProducts;

        // Update results section KPIs
        totalProfitEl.textContent = `$${overallTotalProfit.toFixed(2)}`;
        productsCountEl.textContent = numOptimizedProducts;

        let totalUnits = 0;
        let topProfitProd = { name: "N/A", totalProfit: -Infinity };
        let topQuantityProd = { name: "N/A", quantity: -Infinity };

        if (numOptimizedProducts > 0) {
            products.forEach(p => {
                totalUnits += (p.quantity || 0);
                if ((p.totalProfit || 0) > topProfitProd.totalProfit) {
                    topProfitProd = { name: p.name || "N/A", totalProfit: (p.totalProfit || 0) };
                }
                if ((p.quantity || 0) > topQuantityProd.quantity) {
                    topQuantityProd = { name: p.name || "N/A", quantity: (p.quantity || 0) };
                }
            });
            totalUnitsProducedEl.textContent = totalUnits;
            avgProfitPerProductEl.textContent = `$${(overallTotalProfit / numOptimizedProducts).toFixed(2)}`;
            avgQuantityPerProductEl.textContent = (totalUnits / numOptimizedProducts).toFixed(2);
            
            topProfitProductNameEl.textContent = topProfitProd.name;
            topProfitProductValueEl.textContent = `$${topProfitProd.totalProfit.toFixed(2)}`;
            topProfitProductCard.classList.remove("hidden");

            topQuantityProductNameEl.textContent = topQuantityProd.name;
            topQuantityProductValueEl.textContent = `${topQuantityProd.quantity} units`;
            topQuantityProductCard.classList.remove("hidden");
        } else { // Should ideally be caught by unfeasible or error, but as a fallback
            totalUnitsProducedEl.textContent = "0";
            avgProfitPerProductEl.textContent = "$0.00";
            avgQuantityPerProductEl.textContent = "0";
            topProfitProductCard.classList.add("hidden");
            topQuantityProductCard.classList.add("hidden");
        }

        // Update charts
        productionChart.data.labels = products.map(p => p.name || "N/A");
        productionChart.data.datasets[0].data = products.map(p => p.quantity || 0);
        productionChart.update();

        profitContributionChart.data.labels = products.map(p => p.name || "N/A");
        profitContributionChart.data.datasets[0].data = products.map(p => p.totalProfit || 0);
        profitContributionChart.update();

        costProfitChart.data.labels = products.map(p => p.name || "N/A");
        costProfitChart.data.datasets[0].data = products.map(p => p.totalCost || 0);
        costProfitChart.data.datasets[1].data = products.map(p => p.totalProfit || 0);
        costProfitChart.update();

        // Update table
        resultsTableBody.innerHTML = ""; 
        if (numOptimizedProducts > 0) {
            resultsTablePlaceholder.classList.add("hidden");
            resultsTableActual.classList.remove("hidden");
            products.forEach(p => {
                const row = resultsTableBody.insertRow();
                row.innerHTML = `
                    <td>${p.name || "N/A"}</td>
                    <td>${p.quantity ?? 0}</td>
                    <td>$${(p.price || 0).toFixed(2)}</td>
                    <td>$${(p.unitCost || 0).toFixed(2)}</td>
                    <td>$${(p.profitPerUnit || 0).toFixed(2)}</td>
                    <td>$${(p.totalProfit || 0).toFixed(2)}</td>
                    <td>$${(p.totalCost || 0).toFixed(2)}</td>
                `;
            });
        } else { // This case should be rare if unfeasible is handled above
            resultsTablePlaceholder.querySelector("p").textContent = "Simulation completed, but no optimal products found.";
            resultsTablePlaceholder.classList.remove("hidden");
            resultsTableActual.classList.add("hidden");
            resultsContentWrapper.classList.add("hidden"); // Hide wrapper if no products
            showResultsMessage("Simulation completed, but no optimal products found or data is unfeasible.", "warning");
        }

        // Switch to results section automatically
        sections.forEach(section => section.classList.remove("active"));
        document.getElementById("results").classList.add("active");
        navLinks.forEach(l => l.classList.remove("active"));
        document.querySelector(".nav-link[data-section='results']").classList.add("active");
    }

    // Initial setup: ensure results content is hidden and a placeholder message is shown
    clearResultsDisplay();
    showResultsMessage("Run a simulation to see results and analysis.", "info");

});

