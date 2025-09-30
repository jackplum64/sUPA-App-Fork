let motorToggle = localStorage.getItem("motorToggle");
let allPropResults = {};
let propSummary = {};
let propList = [];
let currentProp = null;
let currentMode = 'single';
let chartInstances = {};

const requirements = [
    [30, 45], // Flight time, minutes
    [6000, 9000], // Max Cruise Altitude (asl)
    [25, 20], // Stall speed
    [45, 50] // Max Speed
];

document.addEventListener("DOMContentLoaded", function () {
    initializeElements();
    loadResults();
    setupEventListeners();
});

function initializeElements() {
    window.elements = {
        propSelect: document.getElementById("propSelect"),
        altitudeSelect: document.getElementById("altitudeSelect"),
        showAllProps: document.getElementById("showAllProps"),
        showComparison: document.getElementById("showComparison"),
        toggleTable: document.getElementById("toggleTable"),
        downloadTable: document.getElementById("downloadTable"),
        resultsTable: document.getElementById("resultsTable"),
        bestPropSection: document.getElementById("bestPropSection"),
        propSummarySection: document.getElementById("propSummarySection"),
        comparisonSection: document.getElementById("comparisonSection"),
        individualChartsSection: document.getElementById("individualChartsSection"),
        motorInformationBar: document.getElementById("motorInformationBar"),
        resultLog: document.getElementById("resultLog"),
        altitudeInformation: document.getElementById("altitudeInformation"),
        requirements: {
            req1: document.getElementById("requirement1"),
            req2: document.getElementById("requirement2"),
            req3: document.getElementById("requirement3"),
            req4: document.getElementById("requirement4")
        }
    };
}

function setupEventListeners() {
    elements.propSelect.addEventListener("change", function() {
        currentProp = this.value;
        currentMode = 'single';
        updateDisplay();
    });

    elements.altitudeSelect.addEventListener("change", function() {
        updateDisplay();
    });

    elements.showAllProps.addEventListener("click", function() {
        currentMode = 'all';
        updateDisplay();
    });

    elements.showComparison.addEventListener("click", function() {
        currentMode = 'comparison';
        updateDisplay();
    });

    elements.toggleTable.addEventListener("click", function() {
        if (elements.resultsTable.classList.contains("hidden")) {
            elements.resultsTable.classList.remove("hidden");
            this.textContent = "Hide Table";
        } else {
            elements.resultsTable.classList.add("hidden");
            this.textContent = "Show Table";
        }
    });

    elements.downloadTable.addEventListener("click", downloadTableData);
}

function loadResults() {
    if (motorToggle === "true") {
        loadMotorResults();
    } else {
        loadAeroOnlyResults();
    }
}

function loadMotorResults() {
    allPropResults = JSON.parse(localStorage.getItem("allPropResults")) || {};
    propSummary = JSON.parse(localStorage.getItem("propSummary")) || {};
    propList = JSON.parse(localStorage.getItem("propList")) || [];
    const bestProp = localStorage.getItem("bestProp");
    const motorInfo = JSON.parse(localStorage.getItem("motorInfo")) || {};
    const totalWeight = localStorage.getItem("totalWeight");

    if (propList.length === 0) {
        elements.motorInformationBar.innerHTML = "No propeller data found.";
        return;
    }

    currentProp = bestProp || propList[0];

    const firstPropData = allPropResults[currentProp];
    elements.motorInformationBar.innerHTML = 
        `Motor(s): ${motorInfo.motoNum} ${motorInfo.motor} | Battery: ${motorInfo.battery} | Weight: ${totalWeight}lbs`;

    populatePropSelect();
    populateAltitudeSelect();
    showBestPropRecommendation(bestProp);
    showPropSummaryCards();
    updateDisplay();
}

function loadAeroOnlyResults() {
    const results = JSON.parse(localStorage.getItem("analysisResultsNoThrust")) || {};
    const maxResults = JSON.parse(localStorage.getItem("maxResults")) || {};
    
    elements.motorInformationBar.innerHTML = `Weight: ${maxResults.weight}lbs | Aerodynamic Analysis Only`;
    
    elements.bestPropSection.style.display = "none";
    elements.propSummarySection.style.display = "none";
    elements.comparisonSection.style.display = "none";
    
    updateRequirementsAeroOnly(maxResults);
    
    for (let altitude in results) {
        let option = document.createElement("option");
        option.value = altitude;
        option.textContent = altitude + " ft";
        elements.altitudeSelect.appendChild(option);
    }
    
    elements.resultLog.innerHTML = `Min stall speed is ${maxResults.minSpeed?.minCalcVelocity || 'N/A'} mph.`;
}

function populatePropSelect() {
    elements.propSelect.innerHTML = "";
    propList.forEach(propName => {
        let option = document.createElement("option");
        option.value = propName;
        option.textContent = `${propName.replace('_', 'x')} prop`;
        if (propName === currentProp) option.selected = true;
        elements.propSelect.appendChild(option);
    });
}

function populateAltitudeSelect() {
    elements.altitudeSelect.innerHTML = "";
    if (currentProp && allPropResults[currentProp]) {
        const altitudes = Object.keys(allPropResults[currentProp].results).sort((a, b) => Number(a) - Number(b));
        altitudes.forEach(altitude => {
            let option = document.createElement("option");
            option.value = altitude;
            option.textContent = altitude + " ft";
            elements.altitudeSelect.appendChild(option);
        });
    }
}

function showBestPropRecommendation(bestProp) {
    if (!bestProp || !propSummary[bestProp]) {
        elements.bestPropSection.style.display = "none";
        return;
    }

    elements.bestPropSection.style.display = "block";
    const summary = propSummary[bestProp];
    elements.bestPropSection.querySelector("#bestPropInfo").innerHTML = `
        <h3>${bestProp.replace('_', 'x')} Propeller</h3>
        <p><strong>Diameter:</strong> ${summary.diameter}" | <strong>Pitch:</strong> ${summary.pitch}"</p>
        <p><strong>Max Endurance:</strong> ${summary.maxEndurance.toFixed(0)} minutes</p>
        <p><strong>Speed Range:</strong> ${summary.minSpeed} - ${summary.maxSpeed} mph</p>
        <p><strong>Service Ceiling:</strong> ${summary.maxAltitude} ft</p>
    `;
}

function showPropSummaryCards() {
    if (propList.length <= 1) {
        elements.propSummarySection.style.display = "none";
        return;
    }

    elements.propSummarySection.style.display = "block";
    const grid = elements.propSummarySection.querySelector("#propSummaryGrid");
    grid.innerHTML = "";

    propList.forEach(propName => {
        const summary = propSummary[propName];
        const card = document.createElement("div");
        card.className = "prop-card";
        card.innerHTML = `
            <h4>${propName.replace('_', 'x')}</h4>
            <p><strong>Diameter:</strong> ${summary.diameter}"</p>
            <p><strong>Pitch:</strong> ${summary.pitch}"</p>
            <p><strong>Endurance:</strong> ${summary.maxEndurance.toFixed(0)} min</p>
            <p><strong>Max Speed:</strong> ${summary.maxSpeed} mph</p>
            <p><strong>Min Speed:</strong> ${summary.minSpeed} mph</p>
        `;
        
        card.addEventListener('click', () => {
            currentProp = propName;
            currentMode = 'single';
            elements.propSelect.value = propName;
            updateDisplay();
        });
        
        grid.appendChild(card);
    });
}

// NEW FUNCTION: Compute altitude-specific performance metrics
function computeAltitudeSpecificMetrics(propData, altitude) {
    if (!propData.results[altitude]) return null;

    const altResults = propData.results[altitude];
    let maxSpeed = 0;
    let minSpeed = 100;
    let maxEndurance = 0;
    let maxEnduranceSpeed = 0;

    Object.keys(altResults).forEach(velocity => {
        const vel = parseInt(velocity);
        const data = altResults[velocity];
        const aoa = parseFloat(data.AoA);
        const thrust = parseFloat(data.thrust);
        const dragOz = parseFloat(data.dragOz);
        const endurance = parseFloat(data.endurance);

        // Valid flight envelope: AoA < 16 and thrust > drag
        if (aoa < 16 && !isNaN(thrust) && thrust > dragOz) {
            // Track max speed
            if (vel > maxSpeed && aoa < 11) {
                maxSpeed = vel;
            }
            
            // Track min speed (stall speed)
            if (vel < minSpeed) {
                minSpeed = vel;
            }

            // Track max endurance
            if (endurance > maxEndurance && aoa < 7) {
                maxEndurance = endurance;
                maxEnduranceSpeed = vel;
            }
        }
    });

    return {
        maxSpeed: maxSpeed,
        minSpeed: minSpeed,
        maxEndurance: maxEndurance,
        maxEnduranceSpeed: maxEnduranceSpeed
    };
}

function updateRequirements() {
    if (!currentProp || !allPropResults[currentProp]) return;

    const selectedAltitude = elements.altitudeSelect.value;
    const propData = allPropResults[currentProp];
    
    // Compute altitude-specific metrics
    const altMetrics = computeAltitudeSpecificMetrics(propData, selectedAltitude);
    const maxVals = propData.maxVals;
    
    // Requirement 1 - Flight time (use altitude-specific if available, otherwise global)
    const enduranceValue = altMetrics ? altMetrics.maxEndurance : (maxVals.endurance?.maxEndurance || 0);
    updateRequirementStatus(elements.requirements.req1, 
        enduranceValue, requirements[0]);
    
    // Requirement 2 - Service ceiling (always global)
    updateRequirementStatus(elements.requirements.req2, 
        maxVals.maxAltitude || 0, requirements[1]);
    
    // Requirement 3 - Min speed (stall speed) - use altitude-specific
    const minSpeedValue = altMetrics ? altMetrics.minSpeed : (maxVals.minSpeed?.minCalcVelocity || 100);
    updateRequirementStatus(elements.requirements.req3, 
        requirements[2][1], [minSpeedValue, minSpeedValue], true);
    
    // Requirement 4 - Max speed - use altitude-specific
    const maxSpeedValue = altMetrics ? altMetrics.maxSpeed : (maxVals.maxSpeed?.maxCalcVelocity || 0);
    updateRequirementStatus(elements.requirements.req4, 
        maxSpeedValue, requirements[3]);
}

function updateRequirementsAeroOnly(maxResults) {
    elements.requirements.req1.innerHTML += "Not Available";
    elements.requirements.req2.innerHTML += "Not Available";
    elements.requirements.req4.innerHTML += "Not Available";
    
    updateRequirementStatus(elements.requirements.req3, 
        requirements[2][1], [maxResults.minSpeed?.minCalcVelocity || 100, maxResults.minSpeed?.minCalcVelocity || 100], true);
}

function updateRequirementStatus(element, value, thresholds, inverse = false) {
    removeClasses(element);
    
    let status;
    if (inverse) {
        if (value < thresholds[1]) status = "objective";
        else if (value < thresholds[0]) status = "threshold";
        else status = "notMet";
    } else {
        if (value >= thresholds[1]) status = "objective";
        else if (value >= thresholds[0]) status = "threshold";
        else status = "notMet";
    }
    
    element.classList.add(status);
    element.innerHTML += status === "objective" ? "Objective" : 
                        status === "threshold" ? "Threshold" : "Not Met";
}

function removeClasses(element) {
    element.classList.remove("notMet", "threshold", "objective");
    element.innerHTML = element.innerHTML.split('<br>')[0] + '<br>Status: ';
}

function updateDisplay() {
    // Update requirements with altitude-specific values
    updateRequirements();
    
    switch (currentMode) {
        case 'single':
            showSinglePropView();
            break;
        case 'comparison':
            showComparisonView();
            break;
        case 'all':
            showAllPropsView();
            break;
    }
}

function showSinglePropView() {
    elements.comparisonSection.style.display = "none";
    elements.individualChartsSection.style.display = "block";
    elements.resultsTable.style.display = "table";

    if (!currentProp || !allPropResults[currentProp]) return;

    const propData = allPropResults[currentProp];
    
    updatePerformanceSummary(propData);
    updateTable(propData);
    updateIndividualCharts(propData);
}

function showComparisonView() {
    elements.comparisonSection.style.display = "block";
    elements.individualChartsSection.style.display = "none";
    elements.resultsTable.style.display = "none";
    
    updateComparisonChart();
}

function showAllPropsView() {
    elements.comparisonSection.style.display = "block";
    elements.individualChartsSection.style.display = "block";
    elements.resultsTable.style.display = "none";
    
    updateComparisonChart();
    if (currentProp) updateIndividualCharts(allPropResults[currentProp]);
}

function updatePerformanceSummary(propData) {
    const maxVals = propData.maxVals;
    const selectedAltitude = elements.altitudeSelect.value;
    const altMetrics = computeAltitudeSpecificMetrics(propData, selectedAltitude);
    const batteryEnergy = localStorage.getItem("batteryEnergy");
    
    if (maxVals.endurance) {
        const batteryThreshold = calcBatt(30, maxVals.endurance.maxEnduranceAmps);
        const batteryObjective = calcBatt(45, maxVals.endurance.maxEnduranceAmps);
        
        elements.resultLog.innerHTML = `
            <strong>Global Performance:</strong><br>
            Max endurance is ${maxVals.endurance.maxEndurance.toFixed(0)} minutes at ${maxVals.endurance.maxEnduranceVelocity} mph 
            at ${maxVals.endurance.maxEnduranceAltitude} ft (msl) pulling ${maxVals.endurance.maxEnduranceAmps.toFixed(2)} amps.<br>
            Battery capacity required for: Threshold: ${batteryThreshold.toFixed(0)}mAh, Objective: ${batteryObjective.toFixed(0)}mAh.<br>
            Max speed is ${maxVals.maxSpeed.maxCalcVelocity} mph at ${maxVals.maxSpeed.maxCalcVelocityAltitude} ft (msl).<br>
            Min stall speed is ${maxVals.minSpeed.minCalcVelocity} mph at ${maxVals.minSpeed.minCalcVelocityAltitude} ft (msl).<br>
            Maximum calculated altitude is ${maxVals.maxAltitude} ft (msl).<br><br>
            <strong>Performance at ${selectedAltitude} ft:</strong><br>
            Max speed: ${altMetrics.maxSpeed} mph<br>
            Min speed (stall): ${altMetrics.minSpeed} mph<br>
            Max endurance: ${altMetrics.maxEndurance.toFixed(0)} minutes at ${altMetrics.maxEnduranceSpeed} mph
        `;
    }

    if (selectedAltitude && propData.altResults && propData.altResults[selectedAltitude]) {
        const altInfo = propData.altResults[selectedAltitude];
        elements.altitudeInformation.innerHTML = 
            `Maximum climb rate at ${selectedAltitude} ft (msl) is ${altInfo.maxROC} ft/min flying at 
             ${altInfo.maxROCSpeed} mph at an angle of ${altInfo.maxROCAngle} degrees`;
    }
}

function updateTable(propData) {
    const selectedAltitude = elements.altitudeSelect.value;
    const tableBody = elements.resultsTable.querySelector("tbody");
    tableBody.innerHTML = "";

    if (!selectedAltitude || !propData.results[selectedAltitude]) return;

    const results = propData.results[selectedAltitude];
    Object.keys(results).sort((a, b) => Number(a) - Number(b)).forEach(velocity => {
        const data = results[velocity];
        
        if (data.AoA > 16 || (isNaN(data.throttle) && motorToggle === "true")) return;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${velocity}</td>
            <td>${data.dynamicPressure}</td>
            <td>${data.coefficientLift}</td>
            <td>${data.AoA}</td>
            <td>${data.coefficientDrag}</td>
            <td>${data.dragOz}</td>
            <td>${data.thrust || 'N/A'}</td>
            <td>${data.lOverD}</td>
            <td>${data.endurance || 'N/A'}</td>
            <td>${data.current || 'N/A'}</td>
            <td>${data.throttle || 'N/A'}</td>
        `;
        tableBody.appendChild(row);
    });
}

function updateIndividualCharts(propData) {
    const selectedAltitude = elements.altitudeSelect.value;
    if (!selectedAltitude || !propData.results[selectedAltitude]) return;

    const results = propData.results[selectedAltitude];
    const airspeed = [];
    const ldRatio = [];
    const cLThreeHalfD = [];
    const thrustAvailable = [];
    const thrustRequired = [];
    const current = [];

    Object.keys(results).sort((a, b) => Number(a) - Number(b)).forEach(velocity => {
        if (velocity < 10) return;
        const data = results[velocity];
        
        airspeed.push(parseFloat(velocity));
        ldRatio.push(parseFloat(data.lOverD));
        cLThreeHalfD.push(parseFloat(data.cLThreeHalfD));
        if (data.thrust) {
            thrustAvailable.push(parseFloat(data.thrust));
            current.push(parseFloat(data.current));
        }
        thrustRequired.push(parseFloat(data.dragOz));
    });

    updateChart("ldChart", {
        type: "line",
        data: {
            labels: airspeed,
            datasets: [{
                label: "L/D Ratio",
                data: ldRatio,
                borderColor: "blue",
                borderWidth: 2,
                fill: false,
                pointRadius: 3
            }, {
                label: "cL^(3/2)/cD Ratio",
                data: cLThreeHalfD,
                borderColor: "green",
                borderWidth: 2,
                fill: false,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: { title: { display: true, text: "Airspeed (mph)" }},
                y: { title: { display: true, text: "L/D Ratio" }}
            }
        }
    });

    const thrustDatasets = [{
        label: "Thrust Required",
        data: thrustRequired,
        borderColor: "red",
        borderWidth: 2,
        fill: false,
        pointRadius: 3
    }];

    if (motorToggle === "true") {
        thrustDatasets.push({
            label: "Max Thrust Available",
            data: thrustAvailable,
            borderColor: "blue",
            borderWidth: 2,
            fill: false,
            pointRadius: 3
        });

        thrustDatasets.push({
            label: "Current Draw",
            data: current,
            borderColor: "green",
            borderWidth: 2,
            fill: false,
            pointRadius: 3,
            yAxisID: "y1"
        });
    }

    const thrustChartOptions = {
        responsive: true,
        scales: {
            x: { title: { display: true, text: "Airspeed (mph)" }},
            y: { title: { display: true, text: "Thrust (oz)" }}
        }
    };

    if (motorToggle === "true") {
        thrustChartOptions.scales.y1 = {
            title: { display: true, text: "Current (A)" },
            position: "right",
            grid: { drawOnChartArea: false }
        };
    }

    updateChart("TaTrChart", {
        type: "line",
        data: { labels: airspeed, datasets: thrustDatasets },
        options: thrustChartOptions
    });
}

function updateComparisonChart() {
    const selectedAltitude = elements.altitudeSelect.value;
    if (!selectedAltitude) return;

    const datasets = [];
    const colors = ['#ff0000', '#0000ff', '#00ff00', '#ff8800', '#8800ff', '#00ffff', '#ff00ff'];
    
    propList.forEach((propName, index) => {
        const propData = allPropResults[propName];
        if (!propData.results[selectedAltitude]) return;

        const results = propData.results[selectedAltitude];
        const airspeed = [];
        const maxThrust = [];

        Object.keys(results).sort((a, b) => Number(a) - Number(b)).forEach(velocity => {
            if (velocity < 10) return;
            const data = results[velocity];
            airspeed.push(parseFloat(velocity));
            maxThrust.push(parseFloat(data.thrust) || 0);
        });

        datasets.push({
            label: `${propName.replace('_', 'x')} (${propSummary[propName].diameter}"x${propSummary[propName].pitch}")`,
            data: maxThrust,
            borderColor: colors[index % colors.length],
            borderWidth: 2,
            fill: false,
            pointRadius: 2
        });
    });

    updateChart("propComparisonChart", {
        type: "line",
        data: { labels: datasets[0]?.data.map((_, i) => i + 10) || [], datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: "Airspeed (mph)" }},
                y: { title: { display: true, text: "Max Thrust Available (oz)" }}
            },
            plugins: {
                title: {
                    display: true,
                    text: `Propeller Thrust Comparison at ${selectedAltitude} ft`
                }
            }
        }
    });
}

function updateChart(chartId, config) {
    const ctx = document.getElementById(chartId);
    if (!ctx) return;

    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
    }
    
    chartInstances[chartId] = new Chart(ctx.getContext("2d"), config);
}

function downloadTableData() {
    const table = elements.resultsTable;
    let csvContent = "data:text/csv;charset=utf-8,";
    let fileName = prompt("Enter file name: ", `${currentProp}_results.csv`);
    
    if (!fileName) return;

    let headers = [];
    table.querySelectorAll("thead th").forEach(th => {
        headers.push(th.innerText);
    });
    csvContent += headers.join(",") + "\n";

    table.querySelectorAll("tbody tr").forEach(row => {
        let rowData = [];
        row.querySelectorAll("td").forEach(td => {
            rowData.push(td.innerText);
        });
        csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function calcBatt(time, current) {
    return (time / 60) * current * 1000;
}

if (motorToggle === "false") {
    document.addEventListener("DOMContentLoaded", function() {
        elements.bestPropSection.style.display = "none";
        elements.propSummarySection.style.display = "none";
        elements.comparisonSection.style.display = "none";
        elements.showAllProps.style.display = "none";
        elements.showComparison.style.display = "none";
        elements.propSelect.parentElement.style.display = "none";
    });
}