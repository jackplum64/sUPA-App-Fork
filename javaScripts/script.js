/* Constants */
const batteryEnergy = 67.2; // Whr

const airDensities = [
    0.0023769, // 0 ft
    0.0023423, // 500 ft
    0.0023081, // 1000 ft
    0.0022743, // 1500 ft
    0.0022409, // 2000 ft
    0.0022078, // 2500 ft
    0.0021751, // 3000 ft
    0.0021428, // 3500 ft
    0.0021109, // 4000 ft
    0.0020793, // 4500 ft
    0.0020481, // 5000 ft
    0.0020172, // 5500 ft
    0.0019867, // 6000 ft
    0.0019566, // 6500 ft
    0.0019268, // 7000 ft
    0.0018974, // 7500 ft
    0.0018683, // 8000 ft
    0.0018395, // 8500 ft
    0.0018111, // 9000 ft
    0.0017830, // 9500 ft
    0.0017552, // 10000 ft
    0.0017277, // 10500 ft
    0.0017006, // 11000 ft
   /* 0.0016737, // 11500 ft
    0.0016472, // 12000 ft
    0.0016209, // 12500 ft
    0.0015950, // 13000 ft
    0.0015693, // 13500 ft
    0.0015439, // 14000 ft
    0.0015188, // 14500 ft
    0.0014939, // 15000 ft
    0.0014693, // 15500 ft
    0.0014450, // 16000 ft
    0.0014209, // 16500 ft
    0.0013971, // 17000 ft
    0.0013735, // 17500 ft
    0.0013502, // 18000 ft
    0.0013271, // 18500 ft
    0.0013043, // 19000 ft
    0.0012817, // 19500 ft
    0.0012593, // 20000 ft
    0.0012372, // 20500 ft
    0.0012153, // 21000 ft
    0.0011936, // 21500 ft
    0.0011721, // 22000 ft
    0.0011508, // 22500 ft
    0.0011297, // 23000 ft
    0.0011088, // 23500 ft
    0.0010881, // 24000 ft
    0.0010676, // 24500 ft
    0.0010473  // 25000 ft */
];





/* DATA GATHERING */
function pullFormData() {
    try {
        // Gather form inputs
        const S = parseFloat(document.getElementById("planformArea").value);
        const dryWeight = parseFloat(document.getElementById("weight").value);
        const payloadWeight = parseFloat(document.getElementById("pWeight").value);
        
        // Check if CSV mode is enabled
        const csvMode = document.getElementById("csvModeToggle").checked;
        
        // get motor data
        const motorToggle = document.getElementById("uploadToggle").checked;
        let motorNum = 0;
        if (motorToggle) {
            motorNum = parseInt(document.getElementById("motoNum").value);
        }

        return [S, csvMode, dryWeight, payloadWeight, motorToggle, motorNum];

    } catch (error) {
        console.error("Error in pullFormData:", error);
        window.alert("Error in analysis:" + error.message);
        return null;
    }
}



function parseAerodynamicCSV() {
    return new Promise((resolve, reject) => {
        const fileInput = document.getElementById("aeroCSVInput"); // New input element
        const file = fileInput.files[0];
        
        if (!file) {
            reject("No aerodynamic CSV file selected");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const lines = e.target.result.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                
                const aeroData = {};
                
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => parseFloat(v.trim()));
                    if (values.length < 8 || isNaN(values[0])) continue;
                    
                    const velocity = values[0];
                    aeroData[velocity] = {
                        lSlope: values[1],
                        lIntercept: values[2],
                        dC1: values[3],
                        dC2: values[4],
                        dC3: values[5],
                        dC4: values[6],
                        dC5: values[7]
                    };
                }
                
                resolve(aeroData);
            } catch (error) {
                reject("Error parsing aerodynamic CSV: " + error.message);
            }
        };
        
        reader.onerror = () => reject("Error reading file");
        reader.readAsText(file);
    });
}



function interpolateAeroCoefficients(velocity, aeroData) {
    const velocities = Object.keys(aeroData).map(Number).sort((a, b) => a - b);
    
    // Find bounding velocities
    let lowerVel = velocities[0];
    let upperVel = velocities[velocities.length - 1];
    
    for (let i = 0; i < velocities.length - 1; i++) {
        if (velocity >= velocities[i] && velocity <= velocities[i + 1]) {
            lowerVel = velocities[i];
            upperVel = velocities[i + 1];
            break;
        }
    }
    
    // If exact match, return directly
    if (aeroData[velocity]) {
        return aeroData[velocity];
    }
    
    // Linear interpolation
    const ratio = (velocity - lowerVel) / (upperVel - lowerVel);
    const lower = aeroData[lowerVel];
    const upper = aeroData[upperVel];
    
    return {
        lSlope: lower.lSlope + ratio * (upper.lSlope - lower.lSlope),
        lIntercept: lower.lIntercept + ratio * (upper.lIntercept - lower.lIntercept),
        dC1: lower.dC1 + ratio * (upper.dC1 - lower.dC1),
        dC2: lower.dC2 + ratio * (upper.dC2 - lower.dC2),
        dC3: lower.dC3 + ratio * (upper.dC3 - lower.dC3),
        dC4: lower.dC4 + ratio * (upper.dC4 - lower.dC4),
        dC5: lower.dC5 + ratio * (upper.dC5 - lower.dC5)
    };
}




function pullMotorData(motoNum) {
    return new Promise((resolve, reject) => {
        const files = document.getElementById("folderInput").files;
        if (!files.length) {
            reject("No files found");
            return;
        }
        
        // Group files by propeller (directory name)
        const propGroups = {};
        
        [...files].forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            if (pathParts.length >= 2) {
                const propName = pathParts[pathParts.length - 2]; // Directory name like "11_4.5"
                if (!propGroups[propName]) {
                    propGroups[propName] = [];
                }
                propGroups[propName].push(file);
            }
        });
        
        const allPropsData = {};
        const propPromises = Object.keys(propGroups).map(propName => {
            return processPropData(propGroups[propName], propName, motoNum);
        });
        
        Promise.all(propPromises).then(results => {
            results.forEach(result => {
                allPropsData[result.propName] = result.data;
            });
            
            resolve({
                allPropsData,
                batteryEnergy: results[0]?.batteryEnergy || 0,
                batteryCells: results[0]?.batteryCells || 0
            });
        }).catch(reject);
    });
}

function processPropData(files, propName, motoNum) {
    return new Promise((resolve, reject) => {
        const airspeedValues = [...Array(66).keys()];
        let lookupTable = {};
        let batteryEnergy = 0;
        let batteryCells = 0;
        let motor = '', battery = '', propeller = '';
        
        // Parse prop diameter and pitch from name
        const propParts = propName.split('_');
        const propDiameter = parseFloat(propParts[0]);
        const propPitch = parseFloat(propParts[1]);
        
        airspeedValues.forEach(speed => lookupTable[speed] = {});
        
        const filePromises = files.map(file => {
            return new Promise((fileResolve) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const lines = e.target.result.split('\n');
                    let altitude = 0;
                    let dataStart = 0;
                    
                    // Parse file header
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.includes('Motor:')) motor = line.split(': ')[1].split(';')[0].trim();
                        if (line.includes('Battery:')) {
                            battery = line.split(': ')[1].split(';')[0].trim();
                            batteryEnergy = parseFloat(line.split(';')[2].split('@')[0].split('mAh')[0].trim());
                            batteryCells = parseInt(line.split(';')[1].split('cells')[0].trim(), 10);
                        }
                        if (line.includes('ft above Sea Level')) altitude = parseInt(line.split('ft')[0].trim(), 10);
                        if (i >= 12 && line.match(/\d/)) { dataStart = i; break; }
                    }
                    
                    const density = airDensities[altitude] || airDensities[0];
                    let throttle = file.name.split('.')[0];
                    let shift = 0;
                    
                    // Parse data rows
                    for (let i = dataStart; i < lines.length; i++) {
                        const columns = lines[i].trim().split(/\s+/);
                        if (columns.length < 10) break;
                        if (columns.length < 12) shift = -2;
                        
                        let [airspeed, thrust, efficiency, propEfficiency, rpm, current] = [
                            parseFloat(columns[0]), parseFloat(columns[12 + shift]),
                            parseFloat(columns[16 + shift]), parseFloat(columns[15 + shift]),
                            parseInt(columns[11 + shift]), parseFloat(columns[3 + shift])
                        ];
                        
                        if (!lookupTable[airspeed]) lookupTable[airspeed] = {};
                        
                        let Ct = rpm !== 0 ? thrust / (propDiameter ** 4 * rpm ** 2 * density) : 0;
                        
                        lookupTable[airspeed][throttle] = {
                            thrust, efficiency, propEfficiency, rpm, Ct,
                            diameter: propDiameter,
                            pitch: propPitch,
                            current
                        };
                    }
                    fileResolve();
                };
                reader.readAsText(file);
            });
        });
        
        Promise.all(filePromises).then(() => {
            // Clean empty entries
            Object.keys(lookupTable).forEach(airspeed => {
                if (Object.keys(lookupTable[airspeed]).length === 0) {
                    delete lookupTable[airspeed];
                }
            });
            
            resolve({
                propName,
                data: {
                    lookupTable,
                    motor,
                    battery,
                    batteryEnergy,
                    batteryCells,
                    propDiameter,
                    propPitch
                }
            });
        });
    });
}


/* DATA PROCCESSING */
function calculateThrustRequired(velocity, rho, aeroData, weight, planformArea) {
    const velocityFPS = velocity * 5280 / 3600;
    
    // Get velocity-specific coefficients
    const coeffs = interpolateAeroCoefficients(velocity, aeroData);
    
    // Calculate q and cl 
    const dynamicPressure = 0.5 * rho * velocityFPS * velocityFPS;  
    const coefficientLift = weight / (dynamicPressure * planformArea);
    const AoA = (coefficientLift - coeffs.lIntercept) / coeffs.lSlope;
    
    const coefficientDrag = coeffs.dC1 * AoA**4 + coeffs.dC2 * AoA**3 + 
                           coeffs.dC3 * AoA**2 + coeffs.dC4 * AoA + coeffs.dC5;
    
    let dragLb = coefficientDrag * dynamicPressure * planformArea;
    if (dragLb < 0) {
        dragLb = -dragLb;
    }
    let dragOz = dragLb * 16;
    const lOverD = weight / dragLb;
    const cLThreeHalfD = coefficientLift**(3/2) / coefficientDrag;

    return [dynamicPressure, coefficientLift, AoA, coefficientDrag, dragLb, dragOz, lOverD, cLThreeHalfD];
}

function caclulateEndurance(batteryEnergy, currentDraw) {
    //let enduranceCalculated = (batteryEnergy * 2655.25 * (efficiency/100) * clcdRatio * (rho * planformArea)**0.5) / (2**0.5 * weight**(3/2)) / 60; //minutes
    let enduranceCalculated = batteryEnergy * 60 / (currentDraw * 1000); // minutes
    return enduranceCalculated;
}

function interpolate(x,x1,x2, y1,y2) {
    return y1 + (x - x1) * ((y2 - y1) / (x2 - x1));
}


function runAnalysis(event) {
    event.preventDefault();

    const formData = pullFormData();
    console.log(formData);
    if (!formData) {
        console.error("Form data could not be retrieved.");
        return;
    }
    const [S, csvMode, dryWeight, payloadWeight, motorToggle, motorNum] = formData;
    const totalWeight = dryWeight + payloadWeight;

    function getAeroData() {
        return new Promise((resolve, reject) => {
            if (csvMode) {
                parseAerodynamicCSV().then(aeroData => {
                    resolve(aeroData);
                }).catch(reject);
            } else {
                const lSlopeConstants = [
                    parseFloat(document.getElementById("lSlope").value),
                    parseFloat(document.getElementById("lIntercept").value)
                ];
                const dSlopeConstants = [
                    parseFloat(document.getElementById("dC1").value),
                    parseFloat(document.getElementById("dC2").value),
                    parseFloat(document.getElementById("dC3").value),
                    parseFloat(document.getElementById("dC4").value),
                    parseFloat(document.getElementById("dC5").value)
                ];
                
                const aeroData = {};
                for (let vel = 0; vel <= 65; vel++) {
                    aeroData[vel] = {
                        lSlope: lSlopeConstants[0],
                        lIntercept: lSlopeConstants[1],
                        dC1: dSlopeConstants[0],
                        dC2: dSlopeConstants[1],
                        dC3: dSlopeConstants[2],
                        dC4: dSlopeConstants[3],
                        dC5: dSlopeConstants[4]
                    };
                }
                resolve(aeroData);
            }
        });
    }

    getAeroData().then(aeroData => {
        if (motorToggle) {
            pullMultiPropMotorData(motorNum).then(({allPropsData, batteryEnergy, batteryCells, motorInfo}) => {
                
                const allPropResults = {};
                const propSummary = {};
                let bestOverallProp = null;
                let bestOverallEndurance = 0;
                
                // Process each propeller
                Object.keys(allPropsData).forEach(propName => {
                    const propData = allPropsData[propName];
                    const results = runAnalysisForProp(propData, aeroData, totalWeight, S, motorNum);
                    allPropResults[propName] = results;
                    
                    // Track best overall performance
                    if (results.maxVals.endurance && results.maxVals.endurance.maxEndurance > bestOverallEndurance) {
                        bestOverallEndurance = results.maxVals.endurance.maxEndurance;
                        bestOverallProp = propName;
                    }
                    
                    // Create summary for this prop
                    propSummary[propName] = {
                        diameter: propData.propDiameter,
                        pitch: propData.propPitch,
                        maxEndurance: results.maxVals.endurance?.maxEndurance || 0,
                        maxSpeed: results.maxVals.maxSpeed?.maxCalcVelocity || 0,
                        minSpeed: results.maxVals.minSpeed?.minCalcVelocity || 100,
                        maxAltitude: results.maxVals.maxAltitude || 0
                    };
                });

                // Store comprehensive results
                localStorage.setItem("allPropResults", JSON.stringify(allPropResults));
                localStorage.setItem("propSummary", JSON.stringify(propSummary));
                localStorage.setItem("propList", JSON.stringify(Object.keys(allPropsData)));
                localStorage.setItem("bestProp", bestOverallProp);
                localStorage.setItem("motorInfo", JSON.stringify(motorInfo));
                localStorage.setItem("motorToggle", true);
                localStorage.setItem("batteryEnergy", batteryEnergy);
                localStorage.setItem("totalWeight", totalWeight);

                console.log("Successfully uploaded multi-prop results");
                window.location.href = "results.html";
            });
        } else {
            // Single aerodynamic analysis (no motor data)
            const airspeedValues = [...Array(66).keys()];
            let results = {};
            let minCalcVelocity = 100;
            let minCalcVelocityAltitude = 0;

            for (let i = 0; i < airDensities.length; i++) {
                let rho = airDensities[i];
                let altitude = i * 500;

                if (!results[altitude]) {
                    results[altitude] = {};
                }

                for (let airspeed in airspeedValues) {
                    const velocity = airspeed;
                    const [dynamicPressure, coefficientLift, AoA, coefficientDrag, dragLb, dragOz, lOverD, cLThreeHalfD] =
                        calculateThrustRequired(velocity, rho, aeroData, totalWeight, S);

                    if (AoA < 10.5 && airspeed < minCalcVelocity) {
                        minCalcVelocity = airspeed;
                        minCalcVelocityAltitude = altitude;
                    }

                    if (airspeed >= 10) {
                        results[altitude][airspeed] = {
                            dynamicPressure: dynamicPressure.toFixed(2),
                            coefficientLift: coefficientLift.toFixed(2),
                            coefficientDrag: coefficientDrag.toFixed(2),
                            AoA: AoA.toFixed(0),
                            dragOz: dragOz.toFixed(2),
                            lOverD: lOverD.toFixed(2),
                            cLThreeHalfD: cLThreeHalfD.toFixed(2),
                        }
                    }
                }
            }

            const maxVals = {
                minSpeed: {
                    minCalcVelocity: minCalcVelocity,
                    minCalcVelocityAltitude: minCalcVelocityAltitude
                },
                weight: totalWeight
            };

            localStorage.setItem("analysisResultsNoThrust", JSON.stringify(results));
            localStorage.setItem("maxResults", JSON.stringify(maxVals));
            localStorage.setItem("motorToggle", false);

            console.log("Successfully uploaded aerodynamic-only results");
            window.location.href = "results.html";
        }
    }).catch(error => {
        console.error("Error loading aerodynamic data:", error);
        alert("Error loading aerodynamic data: " + error);
    });
}

function pullMultiPropMotorData(motoNum) {
    return new Promise((resolve, reject) => {
        const files = document.getElementById("folderInput").files;
        if (!files.length) {
            reject("No files found");
            return;
        }

        // Group files by propeller directory
        const propGroups = {};
        [...files].forEach(file => {
            const pathParts = file.webkitRelativePath.split('/');
            if (pathParts.length >= 2) {
                const propName = pathParts[pathParts.length - 2];
                if (!propGroups[propName]) {
                    propGroups[propName] = [];
                }
                propGroups[propName].push(file);
            }
        });

        const allPropsData = {};
        let batteryEnergy = 0;
        let batteryCells = 0;
        let motorInfo = {};

        const propPromises = Object.keys(propGroups).map(propName => {
            return processPropData(propGroups[propName], propName, motoNum);
        });

        Promise.all(propPromises).then(results => {
            results.forEach(result => {
                allPropsData[result.propName] = result.data;
                if (!batteryEnergy) {
                    batteryEnergy = result.data.batteryEnergy;
                    batteryCells = result.data.batteryCells;
                    motorInfo = {
                        motor: result.data.motor,
                        battery: result.data.battery,
                        motoNum: motoNum
                    };
                }
            });

            resolve({
                allPropsData,
                batteryEnergy,
                batteryCells,
                motorInfo
            });
        }).catch(reject);
    });
}

function processPropData(files, propName, motoNum) {
    return new Promise((resolve, reject) => {
        const airspeedValues = [...Array(66).keys()];
        let lookupTable = {};
        let batteryEnergy = 0;
        let batteryCells = 0;
        let motor = '', battery = '';

        const propParts = propName.split('_');
        const propDiameter = parseFloat(propParts[0]);
        const propPitch = parseFloat(propParts[1]);

        airspeedValues.forEach(speed => lookupTable[speed] = {});

        const filePromises = files.map(file => {
            return new Promise((fileResolve) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const lines = e.target.result.split('\n');
                    let altitude = 0;
                    let dataStart = 0;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.includes('Motor:')) motor = line.split(': ')[1].split(';')[0].trim();
                        if (line.includes('Battery:')) {
                            battery = line.split(': ')[1].split(';')[0].trim();
                            batteryEnergy = parseFloat(line.split(';')[2].split('@')[0].split('mAh')[0].trim());
                            batteryCells = parseInt(line.split(';')[1].split('cells')[0].trim(), 10);
                        }
                        if (line.includes('ft above Sea Level')) altitude = parseInt(line.split('ft')[0].trim(), 10);
                        if (i >= 12 && line.match(/\d/)) { dataStart = i; break; }
                    }

                    const density = airDensities[altitude] || airDensities[0];
                    let throttle = file.name.split('.')[0];
                    let shift = 0;

                    for (let i = dataStart; i < lines.length; i++) {
                        const columns = lines[i].trim().split(/\s+/);
                        if (columns.length < 10) break;
                        if (columns.length < 12) shift = -2;

                        let [airspeed, thrust, efficiency, propEfficiency, rpm, current] = [
                            parseFloat(columns[0]), parseFloat(columns[12 + shift]),
                            parseFloat(columns[16 + shift]), parseFloat(columns[15 + shift]),
                            parseInt(columns[11 + shift]), parseFloat(columns[3 + shift])
                        ];

                        if (!lookupTable[airspeed]) lookupTable[airspeed] = {};

                        let Ct = rpm !== 0 ? thrust / (propDiameter ** 4 * rpm ** 2 * density) : 0;

                        lookupTable[airspeed][throttle] = {
                            thrust, efficiency, propEfficiency, rpm, Ct,
                            diameter: propDiameter,
                            pitch: propPitch,
                            current
                        };
                    }
                    fileResolve();
                };
                reader.readAsText(file);
            });
        });

        Promise.all(filePromises).then(() => {
            Object.keys(lookupTable).forEach(airspeed => {
                if (Object.keys(lookupTable[airspeed]).length === 0) {
                    delete lookupTable[airspeed];
                }
            });

            resolve({
                propName,
                data: {
                    lookupTable,
                    motor,
                    battery,
                    batteryEnergy,
                    batteryCells,
                    propDiameter,
                    propPitch
                }
            });
        });
    });
}

function runAnalysisForProp(propData, aeroData, totalWeight, S, motorNum) {
    const lookupTable = propData.lookupTable;
    let results = {};
    let maxEndurance = 0;
    let maxEnduranceVelocity = 0;
    let maxEnduranceAltitude = 0;
    let maxEnduranceAmps = 0;
    let maxCalcVelocity = 0;
    let maxCalcVelocityAltitude = 0;
    let minCalcVelocity = 100;
    let minCalcVelocityAltitude = 0;
    let maxAltitude = 0;
    let altResults = {};

    for (let i = 0; i < airDensities.length; i++) {
        let rho = airDensities[i];
        let altitude = i * 500;

        if (!results[altitude]) {
            results[altitude] = {};
        }

        let maxRateOfClimb = 0;
        let maxRateOfClimbAngle = 0;
        let maxRateOfClimbSpeed = 0;

        for (let airspeed in lookupTable) {
            const velocity = parseInt(airspeed);
            const [dynamicPressure, coefficientLift, AoA, coefficientDrag, dragLb, dragOz, lOverD, cLThreeHalfD] =
                calculateThrustRequired(velocity, rho, aeroData, totalWeight, S);

            let lowerThrottle = null;
            let upperThrottle = null;

            let throttleKeys = Object.keys(lookupTable[airspeed])
                .map(Number)
                .sort((a, b) => a - b);

            for (let i = 0; i < throttleKeys.length; i++) {
                let throttle = throttleKeys[i];
                let thrust = lookupTable[airspeed][throttle].Ct * rho * lookupTable[airspeed][throttle].rpm**2 * lookupTable[airspeed][throttle].diameter**4;
                thrust = thrust * motorNum;
                if (thrust < dragOz) {
                    lowerThrottle = throttle;
                } else {
                    upperThrottle = throttle;
                    break;
                }
            }

            let maxThrust = lookupTable[airspeed]["100"].Ct * rho * lookupTable[airspeed]["100"].rpm**2 * lookupTable[airspeed]["100"].diameter**4;
            maxThrust = maxThrust * motorNum;

            if (lowerThrottle === null) lowerThrottle = throttleKeys[0];
            if (upperThrottle === null) upperThrottle = throttleKeys[throttleKeys.length - 1];

            let throttleSetting = interpolate(dragOz / motorNum, lookupTable[airspeed][lowerThrottle].thrust, lookupTable[airspeed][upperThrottle].thrust, lowerThrottle, upperThrottle);
            let efficiencySetting = interpolate(throttleSetting, lowerThrottle, upperThrottle, lookupTable[airspeed][lowerThrottle].efficiency, lookupTable[airspeed][upperThrottle].efficiency);
            let currentNeeded = interpolate(throttleSetting, lowerThrottle, upperThrottle, lookupTable[airspeed][lowerThrottle].current, lookupTable[airspeed][upperThrottle].current);
            currentNeeded = currentNeeded * motorNum;

            let velocityFPM = velocity * 5280 / 60;
            let ROC = parseFloat((maxThrust * velocityFPM - dragOz * velocityFPM) / (totalWeight * 16));
            let ROCAngle = velocity != 0 ? Math.asin(ROC / velocityFPM) * (180 / Math.PI) : 0;

            let endurance = caclulateEndurance(propData.batteryEnergy, currentNeeded);
            if (isNaN(endurance) || endurance < 0) {
                endurance = 0;
            }

            if (endurance > maxEndurance && AoA < 7) {
                maxEndurance = endurance;
                maxEnduranceVelocity = airspeed;
                maxEnduranceAltitude = altitude;
                maxEnduranceAmps = currentNeeded;
            }

            if (AoA < 16 && velocity < minCalcVelocity && dragOz < maxThrust) {
                minCalcVelocity = airspeed;
                minCalcVelocityAltitude = altitude;
            }

            if (velocity > minCalcVelocity && ROC > maxRateOfClimb && ROCAngle < 10) {
                maxRateOfClimb = ROC;
                maxRateOfClimbSpeed = velocity;
                maxRateOfClimbAngle = ROCAngle;
            }

            if (AoA < 11 && airspeed > maxCalcVelocity && dragOz < maxThrust) {
                maxCalcVelocity = airspeed;
                maxCalcVelocityAltitude = altitude;
            }

            if (dragOz > maxThrust) {
                throttleSetting = NaN;
            } else {
                maxAltitude = altitude;
            }

            if (velocity >= 10) {
                results[altitude][airspeed] = {
                    throttle: throttleSetting.toFixed(0),
                    efficiency: efficiencySetting.toFixed(1),
                    dynamicPressure: dynamicPressure.toFixed(2),
                    coefficientLift: coefficientLift.toFixed(2),
                    coefficientDrag: coefficientDrag.toFixed(2),
                    AoA: AoA.toFixed(0),
                    dragOz: dragOz.toFixed(2),
                    lOverD: lOverD.toFixed(2),
                    cLThreeHalfD: cLThreeHalfD.toFixed(2),
                    endurance: endurance.toFixed(0),
                    thrust: maxThrust.toFixed(2),
                    current: currentNeeded.toFixed(2),
                    ROC: ROC.toFixed(0)
                };
            }
        }

        altResults[altitude] = {
            maxROC: maxRateOfClimb.toFixed(0),
            maxROCAngle: maxRateOfClimbAngle.toFixed(0),
            maxROCSpeed: maxRateOfClimbSpeed,
        };
    }

    const maxVals = {
        endurance: {
            maxEndurance: maxEndurance,
            maxEnduranceVelocity: maxEnduranceVelocity,
            maxEnduranceAltitude: maxEnduranceAltitude,
            maxEnduranceAmps: maxEnduranceAmps
        },
        maxSpeed: {
            maxCalcVelocity: maxCalcVelocity,
            maxCalcVelocityAltitude: maxCalcVelocityAltitude
        },
        minSpeed: {
            minCalcVelocity: minCalcVelocity,
            minCalcVelocityAltitude: minCalcVelocityAltitude
        },
        maxAltitude: maxAltitude,
        weight: totalWeight
    };

    return {
        results,
        maxVals,
        altResults
    };
}


document.getElementById("inputForm").addEventListener("submit", runAnalysis);


document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("inputForm");

    form.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault(); // Prevent form submission
            
            // Get all input fields in the form
            const inputs = Array.from(form.querySelectorAll("input[type='text']"));
            
            // Find the current active input field
            const currentIndex = inputs.indexOf(document.activeElement);

            if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                // Move focus to the next input field
                inputs[currentIndex + 1].focus();
            }
        }
    });
});
