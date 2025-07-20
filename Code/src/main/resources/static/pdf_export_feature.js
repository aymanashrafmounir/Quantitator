/**
 * Data-Driven PDF Export Feature for Fashion Pricing Optimizer
 * 
 * This script adds "Export to PDF" buttons to the results section
 * and handles PDF generation by using in-memory data (avoiding CORS issues)
 * and creating a well-formatted PDF using jsPDF and chart.js
 * 
 * Version 2.1: Fixed chart rendering issues to ensure visualizations appear in PDF
 */

// Add these script tags to your HTML file (index.html) before your closing </body> tag:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>

document.addEventListener("DOMContentLoaded", function() {
    // Add export buttons to each algorithm results tab
    addExportButton("ga-tab", "ga-results", "Genetic Algorithm");
    addExportButton("aco-tab", "aco-results", "Ant Colony Optimization");
    addExportButton("comparison-tab", "comparison-results", "Comparison");
});

/**
 * Adds an export button to the specified results section
 * @param {string} tabId - The ID of the tab element
 * @param {string} sectionId - The ID of the results section
 * @param {string} algorithmName - The name of the algorithm for the PDF title
 */
function addExportButton(tabId, sectionId, algorithmName) {
    const tab = document.getElementById(tabId);
    if (!tab) return;
    
    // Create export button
    const exportButton = document.createElement("button");
    exportButton.innerHTML = '<i class="fas fa-file-pdf"></i>';
    exportButton.className = "export-pdf-button";
    exportButton.style.cssText = `
        background-color: #4472C4;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-left: 10px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: bold;
        font-size: 0.9rem;
    `;
    
    // Add button next to the tab
    tab.parentNode.insertBefore(exportButton, tab.nextSibling);
    
    // Add click event listener
    exportButton.addEventListener("click", function() {
        generatePDFFromData(sectionId, algorithmName);
    });
}

/**
 * Gets the simulation results from in-memory data
 * @returns {Object|null} The combined simulation results or null if not available
 */
function getSimulationResults() {
    // Check if we have results in the currentSimResults variable (from script.js)
    if (window.currentSimResults) {
        console.log("Using in-memory simulation results");
        return window.currentSimResults;
    }
    
    // If not available in memory, check if there's a results element with data attributes
    const resultsElement = document.getElementById('results-content-wrapper');
    if (resultsElement && resultsElement.dataset.results) {
        try {
            console.log("Using data attribute simulation results");
            return JSON.parse(resultsElement.dataset.results);
        } catch (e) {
            console.error("Error parsing results from data attribute:", e);
        }
    }
    
    // As a last resort, try to extract data from the UI elements
    console.log("Attempting to extract results from UI elements");
    return extractResultsFromUI();
}

/**
 * Extracts simulation results from UI elements as a fallback
 * @returns {Object} The extracted simulation results
 */
function extractResultsFromUI() {
    // Create a basic structure for the results
    const results = {
        gaResult: {
            totalProfit: parseFloat(document.getElementById('ga-total-profit')?.textContent?.replace('$', '').replace(',', '') || '0'),
            productCount: parseInt(document.getElementById('ga-products-count')?.textContent || '0'),
            products: []
        },
        antColonyResult: {
            totalProfit: parseFloat(document.getElementById('aco-total-profit')?.textContent?.replace('$', '').replace(',', '') || '0'),
            productCount: parseInt(document.getElementById('aco-products-count')?.textContent || '0'),
            products: []
        }
    };
    
    // Extract GA products from table
    const gaTable = document.getElementById('ga-results-table-actual');
    if (gaTable) {
        const rows = gaTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                results.gaResult.products.push({
                    name: cells[0].textContent,
                    quantity: parseInt(cells[1].textContent),
                    price: parseFloat(cells[2].textContent.replace('$', '').replace(',', '')),
                    unitCost: parseFloat(cells[3].textContent.replace('$', '').replace(',', '')),
                    profitPerUnit: parseFloat(cells[4].textContent.replace('$', '').replace(',', '')),
                    totalProfit: parseFloat(cells[5].textContent.replace('$', '').replace(',', '')),
                    totalCost: parseFloat(cells[6].textContent.replace('$', '').replace(',', ''))
                });
            }
        });
    }
    
    // Extract ACO products from table
    const acoTable = document.getElementById('aco-results-table-actual');
    if (acoTable) {
        const rows = acoTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 7) {
                results.antColonyResult.products.push({
                    name: cells[0].textContent,
                    quantity: parseInt(cells[1].textContent),
                    price: parseFloat(cells[2].textContent.replace('$', '').replace(',', '')),
                    unitCost: parseFloat(cells[3].textContent.replace('$', '').replace(',', '')),
                    profitPerUnit: parseFloat(cells[4].textContent.replace('$', '').replace(',', '')),
                    totalProfit: parseFloat(cells[5].textContent.replace('$', '').replace(',', '')),
                    totalCost: parseFloat(cells[6].textContent.replace('$', '').replace(',', ''))
                });
            }
        });
    }
    
    return results;
}

/**
 * Generates a PDF from the data available in memory
 * @param {string} sectionId - The ID of the results section (for determining which results to show)
 * @param {string} algorithmName - The name of the algorithm for the PDF title
 */
function generatePDFFromData(sectionId, algorithmName) {
    // Show loading indicator
    showLoading(true);
    
    try {
        // Get the simulation results from memory
        const results = getSimulationResults();
        if (!results) {
            throw new Error('No simulation results available. Please run a simulation first.');
        }
        
        // Determine which results to use based on the section ID
        let dataToUse;
        let comparisonMode = false;
        
        if (sectionId === 'ga-results') {
            dataToUse = results.gaResult;
        } else if (sectionId === 'aco-results') {
            dataToUse = results.antColonyResult;
        } else if (sectionId === 'comparison-results') {
            dataToUse = {
                gaResult: results.gaResult,
                antColonyResult: results.antColonyResult
            };
            comparisonMode = true;
        }
        
        if (!dataToUse) {
            throw new Error('Invalid section or no data available');
        }
        
        // Generate charts first, then create PDF
        if (comparisonMode) {
            generateChartsForComparison(dataToUse, function(chartImages) {
                createComparisonPDF(dataToUse, algorithmName, chartImages);
            });
        } else {
            generateChartsForAlgorithm(dataToUse, function(chartImages) {
                createAlgorithmPDF(dataToUse, algorithmName, chartImages);
            });
        }
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        showLoading(false);
        alert('Error generating PDF: ' + error.message);
    }
}

/**
 * Generates charts for a single algorithm and calls the callback when done
 * @param {Object} data - The algorithm results data
 * @param {Function} callback - Function to call with chart images when done
 */
function generateChartsForAlgorithm(data, callback) {
    const chartImages = {
        productionQuantity: null,
        profitContribution: null,
        costProfit: null
    };
    let chartsCompleted = 0;
    
    // Create hidden container for charts
    const chartContainer = document.createElement('div');
    chartContainer.style.position = 'absolute';
    chartContainer.style.left = '-9999px';
    chartContainer.style.top = '-9999px';
    document.body.appendChild(chartContainer);
    
    // Production Quantity Chart
    const quantityCanvas = document.createElement('canvas');
    quantityCanvas.width = 750;
    quantityCanvas.height = 400;
    quantityCanvas.id = 'temp-quantity-chart';
    chartContainer.appendChild(quantityCanvas);
    
    // Sort products by quantity (descending) and take top 10
    const topQuantityProducts = [...data.products]
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
    
    // Prepare chart data
    const quantityChartData = {
        labels: topQuantityProducts.map(p => p.name),
        datasets: [{
            label: 'Production Quantity',
            data: topQuantityProducts.map(p => p.quantity),
            backgroundColor: 'rgba(66, 114, 196, 0.7)'
        }]
    };
    
    // Create chart
    const quantityCtx = quantityCanvas.getContext('2d');
    const quantityChart = new Chart(quantityCtx, {
        type: 'bar',
        data: quantityChartData,
        options: {
            responsive: false,
            animation: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Optimal Production Quantity per Product',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Products'
                    }
                }
            }
        }
    });
    
    // Wait for chart to render, then capture image
    setTimeout(function() {
        chartImages.productionQuantity = quantityCanvas.toDataURL('image/png');
        chartsCompleted++;
        checkAllChartsCompleted();
    }, 500);
    
    // Profit Contribution Chart
    const profitCanvas = document.createElement('canvas');
    profitCanvas.width = 750;
    profitCanvas.height = 400;
    profitCanvas.id = 'temp-profit-chart';
    chartContainer.appendChild(profitCanvas);
    
    // Sort products by profit (descending) and take top 10
    const topProfitProducts = [...data.products]
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 10);
    
    // Prepare chart data
    const profitChartData = {
        labels: topProfitProducts.map(p => p.name),
        datasets: [{
            label: 'Profit Contribution',
            data: topProfitProducts.map(p => p.totalProfit),
            backgroundColor: [
                'rgba(66, 114, 196, 0.7)',
                'rgba(91, 155, 213, 0.7)',
                'rgba(112, 173, 71, 0.7)',
                'rgba(255, 192, 0, 0.7)',
                'rgba(237, 125, 49, 0.7)',
                'rgba(165, 165, 165, 0.7)',
                'rgba(68, 84, 106, 0.7)',
                'rgba(91, 155, 213, 0.5)',
                'rgba(112, 173, 71, 0.5)',
                'rgba(255, 192, 0, 0.5)'
            ]
        }]
    };
    
    // Create chart
    const profitCtx = profitCanvas.getContext('2d');
    const profitChart = new Chart(profitCtx, {
        type: 'pie',
        data: profitChartData,
        options: {
            responsive: false,
            animation: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Profit Contribution by Product',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'right'
                }
            }
        }
    });
    
    // Wait for chart to render, then capture image
    setTimeout(function() {
        chartImages.profitContribution = profitCanvas.toDataURL('image/png');
        chartsCompleted++;
        checkAllChartsCompleted();
    }, 500);
    
    // Cost vs Profit Chart
    const costProfitCanvas = document.createElement('canvas');
    costProfitCanvas.width = 750;
    costProfitCanvas.height = 400;
    costProfitCanvas.id = 'temp-cost-profit-chart';
    chartContainer.appendChild(costProfitCanvas);
    
    // Prepare chart data
    const costProfitChartData = {
        labels: topProfitProducts.map(p => p.name),
        datasets: [
            {
                label: 'Total Cost',
                data: topProfitProducts.map(p => p.totalCost),
                backgroundColor: 'rgba(237, 125, 49, 0.7)'
            },
            {
                label: 'Total Profit',
                data: topProfitProducts.map(p => p.totalProfit),
                backgroundColor: 'rgba(66, 114, 196, 0.7)'
            }
        ]
    };
    
    // Create chart
    const costProfitCtx = costProfitCanvas.getContext('2d');
    const costProfitChart = new Chart(costProfitCtx, {
        type: 'bar',
        data: costProfitChartData,
        options: {
            responsive: false,
            animation: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Cost vs. Profit per Product',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount ($)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Products'
                    }
                }
            }
        }
    });
    
    // Wait for chart to render, then capture image
    setTimeout(function() {
        chartImages.costProfit = costProfitCanvas.toDataURL('image/png');
        chartsCompleted++;
        checkAllChartsCompleted();
    }, 500);
    
    // Check if all charts are completed
    function checkAllChartsCompleted() {
        if (chartsCompleted === 3) {
            // Clean up
            document.body.removeChild(chartContainer);
            
            // Call callback with chart images
            callback(chartImages);
        }
    }
}

/**
 * Generates charts for comparison and calls the callback when done
 * @param {Object} data - The combined results data
 * @param {Function} callback - Function to call with chart images when done
 */
function generateChartsForComparison(data, callback) {
    const { gaResult, antColonyResult } = data;
    
    const chartImages = {
        profitComparison: null,
        quantityComparison: null
    };
    let chartsCompleted = 0;
    
    // Create hidden container for charts
    const chartContainer = document.createElement('div');
    chartContainer.style.position = 'absolute';
    chartContainer.style.left = '-9999px';
    chartContainer.style.top = '-9999px';
    document.body.appendChild(chartContainer);
    
    // Create a map of all products for profit comparison
    const allProductsProfit = new Map();
    
    // Add GA products to the map
    gaResult.products.forEach(product => {
        allProductsProfit.set(product.name, {
            name: product.name,
            gaProfit: product.totalProfit,
            acoProfit: 0
        });
    });
    
    // Add or update ACO products in the map
    antColonyResult.products.forEach(product => {
        if (allProductsProfit.has(product.name)) {
            const existingProduct = allProductsProfit.get(product.name);
            existingProduct.acoProfit = product.totalProfit;
        } else {
            allProductsProfit.set(product.name, {
                name: product.name,
                gaProfit: 0,
                acoProfit: product.totalProfit
            });
        }
    });
    
    // Convert map to array and sort by combined profit
    const profitComparisonData = Array.from(allProductsProfit.values())
        .sort((a, b) => (b.gaProfit + b.acoProfit) - (a.gaProfit + a.acoProfit))
        .slice(0, 8); // Take top 8 products
    
    // Profit Comparison Chart
    const profitComparisonCanvas = document.createElement('canvas');
    profitComparisonCanvas.width = 750;
    profitComparisonCanvas.height = 400;
    profitComparisonCanvas.id = 'temp-profit-comparison-chart';
    chartContainer.appendChild(profitComparisonCanvas);
    
    // Prepare chart data
    const profitComparisonChartData = {
        labels: profitComparisonData.map(p => p.name),
        datasets: [
            {
                label: 'Genetic Algorithm',
                data: profitComparisonData.map(p => p.gaProfit),
                backgroundColor: 'rgba(66, 114, 196, 0.7)'
            },
            {
                label: 'Ant Colony Optimization',
                data: profitComparisonData.map(p => p.acoProfit),
                backgroundColor: 'rgba(237, 125, 49, 0.7)'
            }
        ]
    };
    
    // Create chart
    const profitComparisonCtx = profitComparisonCanvas.getContext('2d');
    const profitComparisonChart = new Chart(profitComparisonCtx, {
        type: 'bar',
        data: profitComparisonChartData,
        options: {
            responsive: false,
            animation: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Profit Comparison by Product',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Profit ($)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Products'
                    }
                }
            }
        }
    });
    
    // Wait for chart to render, then capture image
    setTimeout(function() {
        chartImages.profitComparison = profitComparisonCanvas.toDataURL('image/png');
        chartsCompleted++;
        checkAllChartsCompleted();
    }, 500);
    
    // Create a map of all products for quantity comparison
    const allProductsQuantity = new Map();
    
    // Add GA products to the map
    gaResult.products.forEach(product => {
        allProductsQuantity.set(product.name, {
            name: product.name,
            gaQuantity: product.quantity,
            acoQuantity: 0
        });
    });
    
    // Add or update ACO products in the map
    antColonyResult.products.forEach(product => {
        if (allProductsQuantity.has(product.name)) {
            const existingProduct = allProductsQuantity.get(product.name);
            existingProduct.acoQuantity = product.quantity;
        } else {
            allProductsQuantity.set(product.name, {
                name: product.name,
                gaQuantity: 0,
                acoQuantity: product.quantity
            });
        }
    });
    
    // Convert map to array and sort by combined quantity
    const quantityComparisonData = Array.from(allProductsQuantity.values())
        .sort((a, b) => (b.gaQuantity + b.acoQuantity) - (a.gaQuantity + a.acoQuantity))
        .slice(0, 8); // Take top 8 products
    
    // Quantity Comparison Chart
    const quantityComparisonCanvas = document.createElement('canvas');
    quantityComparisonCanvas.width = 750;
    quantityComparisonCanvas.height = 400;
    quantityComparisonCanvas.id = 'temp-quantity-comparison-chart';
    chartContainer.appendChild(quantityComparisonCanvas);
    
    // Prepare chart data
    const quantityComparisonChartData = {
        labels: quantityComparisonData.map(p => p.name),
        datasets: [
            {
                label: 'Genetic Algorithm',
                data: quantityComparisonData.map(p => p.gaQuantity),
                backgroundColor: 'rgba(66, 114, 196, 0.7)'
            },
            {
                label: 'Ant Colony Optimization',
                data: quantityComparisonData.map(p => p.acoQuantity),
                backgroundColor: 'rgba(237, 125, 49, 0.7)'
            }
        ]
    };
    
    // Create chart
    const quantityComparisonCtx = quantityComparisonCanvas.getContext('2d');
    const quantityComparisonChart = new Chart(quantityComparisonCtx, {
        type: 'bar',
        data: quantityComparisonChartData,
        options: {
            responsive: false,
            animation: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Quantity Comparison by Product',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Quantity'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Products'
                    }
                }
            }
        }
    });
    
    // Wait for chart to render, then capture image
    setTimeout(function() {
        chartImages.quantityComparison = quantityComparisonCanvas.toDataURL('image/png');
        chartsCompleted++;
        checkAllChartsCompleted();
    }, 500);
    
    // Check if all charts are completed
    function checkAllChartsCompleted() {
        if (chartsCompleted === 2) {
            // Clean up
            document.body.removeChild(chartContainer);
            
            // Call callback with chart images
            callback(chartImages);
        }
    }
}

/**
 * Creates a PDF for a single algorithm's results using pre-generated chart images
 * @param {Object} data - The algorithm results data
 * @param {string} algorithmName - The name of the algorithm
 * @param {Object} chartImages - Object containing chart images as data URLs
 */
function createAlgorithmPDF(data, algorithmName, chartImages) {
    try {
        // Create PDF with jsPDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Add title
        pdf.setFontSize(16);
        pdf.setTextColor(66, 114, 196); // Blue color
        const title = `Fashion Pricing Optimizer - ${algorithmName} Results`;
        pdf.text(title, pdf.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        
        // Add date
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100); // Gray color
        const date = new Date().toLocaleDateString();
        pdf.text(`Generated on: ${date}`, pdf.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        
        // Add summary section
        pdf.setFontSize(14);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Summary', 14, 30);
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Total Profit: $${data.totalProfit.toFixed(2)}`, 14, 38);
        pdf.text(`Total Products: ${data.productCount}`, 14, 44);
        
        // Calculate additional metrics
        const totalUnits = data.products.reduce((sum, product) => sum + product.quantity, 0);
        const avgProfitPerProduct = data.totalProfit / data.products.length;
        const avgQuantityPerProduct = totalUnits / data.products.length;
        
        pdf.text(`Total Units Produced: ${totalUnits}`, 14, 50);
        pdf.text(`Average Profit per Product: $${avgProfitPerProduct.toFixed(2)}`, 14, 56);
        pdf.text(`Average Quantity per Product: ${avgQuantityPerProduct.toFixed(2)}`, 14, 62);
        
        // Find top product by profit
        const topProfitProduct = [...data.products].sort((a, b) => b.totalProfit - a.totalProfit)[0];
        pdf.text(`Top Product by Profit: ${topProfitProduct.name} ($${topProfitProduct.totalProfit.toFixed(2)})`, 14, 68);
        
        // Find top product by quantity
        const topQuantityProduct = [...data.products].sort((a, b) => b.quantity - a.quantity)[0];
        pdf.text(`Top Product by Quantity: ${topQuantityProduct.name} (${topQuantityProduct.quantity} units)`, 14, 74);
        
        // Add product table
        pdf.setFontSize(14);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Product Details', 14, 84);
        
        // Prepare table data
        const tableColumn = ["Product", "Quantity", "Price", "Unit Cost", "Profit/Unit", "Total Profit", "Total Cost"];
        const tableRows = data.products.map(product => [
            product.name,
            product.quantity,
            `$${product.price.toFixed(2)}`,
            `$${product.unitCost.toFixed(2)}`,
            `$${product.profitPerUnit.toFixed(2)}`,
            `$${product.totalProfit.toFixed(2)}`,
            `$${product.totalCost.toFixed(2)}`
        ]);
        
        // Add the table
        pdf.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 88,
            theme: 'grid',
            headStyles: {
                fillColor: [66, 114, 196],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240]
            },
            margin: { top: 88 }
        });
        
        // Add charts on a new page
        pdf.addPage();
        
        // Add title for charts page
        pdf.setFontSize(14);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Data Visualizations', 14, 15);
        
        // Add production quantity chart
        pdf.setFontSize(12);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Optimal Production Quantity per Product', 14, 25);
        
        if (chartImages.productionQuantity) {
            pdf.addImage(chartImages.productionQuantity, 'PNG', 14, 30, 180, 80);
        } else {
            pdf.setTextColor(255, 0, 0);
            pdf.text('Chart generation failed', 14, 50);
        }
        
        // Add profit contribution chart
        pdf.setFontSize(12);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Profit Contribution by Product', 14, 120);
        
        if (chartImages.profitContribution) {
            pdf.addImage(chartImages.profitContribution, 'PNG', 14, 125, 180, 80);
        } else {
            pdf.setTextColor(255, 0, 0);
            pdf.text('Chart generation failed', 14, 145);
        }
        
        // Add cost vs profit chart on a new page
        pdf.addPage();
        
        pdf.setFontSize(14);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Cost vs. Profit Analysis', 14, 15);
        
        if (chartImages.costProfit) {
            pdf.addImage(chartImages.costProfit, 'PNG', 14, 25, 180, 80);
        } else {
            pdf.setTextColor(255, 0, 0);
            pdf.text('Chart generation failed', 14, 50);
        }
        
        // Save the PDF
        pdf.save(`fashion_optimizer_${algorithmName.toLowerCase().replace(/\s+/g, '_')}_results.pdf`);
        
        // Hide loading indicator
        showLoading(false);
        
    } catch (error) {
        console.error('Error creating PDF:', error);
        showLoading(false);
        alert('Error creating PDF: ' + error.message);
    }
}

/**
 * Creates a PDF for comparison between GA and ACO results using pre-generated chart images
 * @param {Object} data - The combined results data
 * @param {string} algorithmName - The title for the PDF
 * @param {Object} chartImages - Object containing chart images as data URLs
 */
function createComparisonPDF(data, algorithmName, chartImages) {
    try {
        const { gaResult, antColonyResult } = data;
        
        // Create PDF with jsPDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Add title
        pdf.setFontSize(16);
        pdf.setTextColor(66, 114, 196); // Blue color
        pdf.text(`Fashion Pricing Optimizer - Algorithm Comparison`, pdf.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
        
        // Add date
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100); // Gray color
        const date = new Date().toLocaleDateString();
        pdf.text(`Generated on: ${date}`, pdf.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
        
        // Add comparison section
        pdf.setFontSize(14);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Algorithm Comparison', 14, 30);
        
        // Prepare comparison table
        const profitDiff = Math.abs(gaResult.totalProfit - antColonyResult.totalProfit);
        const betterAlgo = gaResult.totalProfit > antColonyResult.totalProfit ? 
            "Genetic Algorithm" : "Ant Colony Optimization";
        
        const comparisonTableColumn = ["Algorithm", "Total Profit", "Total Products", "Better Algorithm"];
        const comparisonTableRows = [
            ["Genetic Algorithm", `$${gaResult.totalProfit.toFixed(2)}`, gaResult.productCount.toString(), betterAlgo],
            ["Ant Colony Optimization", `$${antColonyResult.totalProfit.toFixed(2)}`, antColonyResult.productCount.toString(), `Diff: $${profitDiff.toFixed(2)}`]
        ];
        
        // Add the comparison table
        pdf.autoTable({
            head: [comparisonTableColumn],
            body: comparisonTableRows,
            startY: 35,
            theme: 'grid',
            headStyles: {
                fillColor: [66, 114, 196],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240]
            },
            margin: { top: 35 }
        });
        
        // Add profit comparison chart
        pdf.setFontSize(12);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Profit Comparison by Product', 14, 70);
        
        if (chartImages.profitComparison) {
            pdf.addImage(chartImages.profitComparison, 'PNG', 14, 75, 180, 60);
        } else {
            pdf.setTextColor(255, 0, 0);
            pdf.text('Chart generation failed', 14, 90);
        }
        
        // Add quantity comparison chart
        pdf.setFontSize(12);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Quantity Comparison by Product', 14, 145);
        
        if (chartImages.quantityComparison) {
            pdf.addImage(chartImages.quantityComparison, 'PNG', 14, 150, 180, 60);
        } else {
            pdf.setTextColor(255, 0, 0);
            pdf.text('Chart generation failed', 14, 165);
        }
        
        // Add detailed comparison on a new page
        pdf.addPage();
        
        // Add title for detailed comparison
        pdf.setFontSize(14);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Detailed Product Comparison', 14, 15);
        
        // Prepare detailed comparison table
        const detailedTableColumn = ["Product", "GA Quantity", "ACO Quantity", "GA Profit", "ACO Profit", "Difference"];
        
        // Create a map of all products
        const allProducts = new Map();
        
        // Add GA products to the map
        gaResult.products.forEach(product => {
            allProducts.set(product.name, {
                name: product.name,
                gaQuantity: product.quantity,
                acoQuantity: 0,
                gaProfit: product.totalProfit,
                acoProfit: 0
            });
        });
        
        // Add or update ACO products in the map
        antColonyResult.products.forEach(product => {
            if (allProducts.has(product.name)) {
                const existingProduct = allProducts.get(product.name);
                existingProduct.acoQuantity = product.quantity;
                existingProduct.acoProfit = product.totalProfit;
            } else {
                allProducts.set(product.name, {
                    name: product.name,
                    gaQuantity: 0,
                    acoQuantity: product.quantity,
                    gaProfit: 0,
                    acoProfit: product.totalProfit
                });
            }
        });
        
        // Convert map to array and sort by profit difference
        const detailedComparisonData = Array.from(allProducts.values())
            .map(product => {
                product.difference = product.gaProfit - product.acoProfit;
                return product;
            })
            .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
        
        // Create table rows
        const detailedTableRows = detailedComparisonData.map(product => [
            product.name,
            product.gaQuantity,
            product.acoQuantity,
            `$${product.gaProfit.toFixed(2)}`,
            `$${product.acoProfit.toFixed(2)}`,
            `$${product.difference.toFixed(2)}`
        ]);
        
        // Add the detailed comparison table
        pdf.autoTable({
            head: [detailedTableColumn],
            body: detailedTableRows,
            startY: 20,
            theme: 'grid',
            headStyles: {
                fillColor: [66, 114, 196],
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [240, 240, 240]
            },
            margin: { top: 20 }
        });
        
        // Add conclusion
        const tableEndY = pdf.previousAutoTable.finalY + 10;
        
        pdf.setFontSize(14);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Conclusion', 14, tableEndY);
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        
        const profitDiffPercent = (profitDiff / Math.min(gaResult.totalProfit, antColonyResult.totalProfit)) * 100;
        
        const conclusionText = `Based on the optimization results, the ${betterAlgo} performed better with a profit difference of $${profitDiff.toFixed(2)} (${profitDiffPercent.toFixed(2)}%). This algorithm should be preferred for production planning and pricing optimization.`;
        
        pdf.text(conclusionText, 14, tableEndY + 8, {
            maxWidth: 180,
            align: 'justify'
        });
        
        // Add recommendations
        pdf.setFontSize(12);
        pdf.setTextColor(66, 114, 196);
        pdf.text('Key Recommendations:', 14, tableEndY + 25);
        
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        
        // Get top 3 products from better algorithm
        const topProducts = betterAlgo === "Genetic Algorithm" ?
            [...gaResult.products].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 3) :
            [...antColonyResult.products].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 3);
        
        let recommendationY = tableEndY + 32;
        
        topProducts.forEach((product, index) => {
            pdf.text(`${index + 1}. Focus production on ${product.name} with an optimal quantity of ${product.quantity} units, which contributes $${product.totalProfit.toFixed(2)} to total profit.`, 14, recommendationY, {
                maxWidth: 180
            });
            recommendationY += 10;
        });
        
        pdf.text(`4. Implement the ${betterAlgo} for future production planning to maximize profitability.`, 14, recommendationY, {
            maxWidth: 180
        });
        
        pdf.text(`5. Regularly update the model with new market data to maintain optimization accuracy.`, 14, recommendationY + 10, {
            maxWidth: 180
        });
        
        // Save the PDF
        pdf.save(`fashion_optimizer_algorithm_comparison_results.pdf`);
        
        // Hide loading indicator
        showLoading(false);
        
    } catch (error) {
        console.error('Error creating PDF:', error);
        showLoading(false);
        alert('Error creating PDF: ' + error.message);
    }
}

/**
 * Shows or hides a loading indicator
 * @param {boolean} show - Whether to show or hide the loading indicator
 */
function showLoading(show) {
    // Use the existing global loader if available
    const loader = document.getElementById('global-loader-overlay');
    if (loader) {
        if (show) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }
        return;
    }
    
    // Create a temporary loader if the global one doesn't exist
    if (show) {
        const tempLoader = document.createElement('div');
        tempLoader.id = 'temp-loader';
        tempLoader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        const loaderContent = document.createElement('div');
        loaderContent.style.cssText = `
            background-color: white;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
        `;
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner-large';
        
        const text = document.createElement('p');
        text.textContent = 'Generating PDF, please wait...';
        
        loaderContent.appendChild(spinner);
        loaderContent.appendChild(text);
        tempLoader.appendChild(loaderContent);
        document.body.appendChild(tempLoader);
    } else {
        const tempLoader = document.getElementById('temp-loader');
        if (tempLoader) {
            tempLoader.remove();
        }
    }
}
