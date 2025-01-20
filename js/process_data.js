function parseCSV(content) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    console.log('CSV Headers:', headers);
    const data = [];

    let currentRow = [];
    let currentValue = '';
    let inQuotes = false;

    // Process each line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim() && !inQuotes) continue;

        // Process each character in the line
        for (let j = 0; j < line.length; j++) {
            const char = line[j];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                currentRow.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }

        // Handle end of line
        if (!inQuotes) {
            // End of a row
            currentRow.push(currentValue.trim());

            // Create object from values if we have enough values
            if (currentRow.length >= headers.length) {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = currentRow[index] ?
                        currentRow[index].replace(/^"|"$/g, '').trim() : '';
                });
                data.push(obj);
            }

            // Reset for next row
            currentRow = [];
            currentValue = '';
        } else {
            // Inside quotes, add the newline
            currentValue += '\n';
        }
    }

    return data;
}

// Helper function to parse related controls
function parseRelatedControls(controlsStr) {
    if (!controlsStr) return [];

    // First split by newlines to handle multiple controls
    return controlsStr
        .split('\n')
        .map(line => line.trim())
        // Remove the leading hyphen if present
        .map(line => line.replace(/^-\s*/, ''))
        .filter(c => c && c.startsWith('CREDO-'));
}

// Process risk library
function processRiskLibrary(content) {
    const risks = parseCSV(content);

    const processedRisks = risks
        .filter(risk => {
            const isValid = risk['Risk Scenario'] && risk['Risk Type'] && risk['Description'];
            return isValid;
        })
        .map(risk => {
            const relatedControls = parseRelatedControls(risk['Related Controls']);

            return {
                id: risk['Risk Scenario'],
                name: risk['Risk Scenario'],
                riskType: risk['Risk Type'],
                description: risk['Description'],
                relatedControls
            };
        });

    return processedRisks;
}

// Process control library
function processControlLibrary(content) {
    const controls = parseCSV(content);

    const processedControls = controls
        .filter(control => {
            const isValid = control['Control ID'] && control['Control ID'].startsWith('CREDO-');
            return isValid;
        })
        .map(control => ({
            id: control['Control ID'],
            label: control['Control Label'],
            description: control['Description']
        }));

    return processedControls;
}

// Extract relationships
function extractRelationships(risks) {
    const relationships = [];

    risks.forEach(risk => {
        if (!risk.relatedControls || risk.relatedControls.length === 0) {
            return;
        }

        risk.relatedControls.forEach(controlId => {
            relationships.push({
                source: risk.id,
                target: controlId
            });
        });
    });

    return relationships;
}

// Main processing function
async function processData() {
    try {

        const riskResponse = await fetch('data/risk_library.csv');
        const controlResponse = await fetch('data/control_library.csv');

        const riskContent = await riskResponse.text();
        const controlContent = await controlResponse.text();


        const riskData = processRiskLibrary(riskContent);
        const controlData = processControlLibrary(controlContent);
        const relationships = extractRelationships(riskData);

        // Create a graph structure for inspection
        const graph = {
            nodes: [
                ...riskData.map(r => ({
                    id: r.id,
                    type: 'risk',
                    riskType: r.riskType,
                    controls: r.relatedControls
                })),
                ...controlData.map(c => ({
                    id: c.id,
                    type: 'control'
                }))
            ],
            links: relationships.map(r => ({
                source: r.source,
                target: r.target
            }))
        };

        console.log('Graph structure:', {
            totalNodes: graph.nodes.length,
            riskNodes: graph.nodes.filter(n => n.type === 'risk').length,
            controlNodes: graph.nodes.filter(n => n.type === 'control').length,
            links: graph.links.length
        });

        return {
            riskData,
            controlData,
            relationships
        };
    } catch (error) {
        console.error('Error processing data:', error);
        return null;
    }
}

const testRiskCSV = `Risk Scenario,Risk Type,Description,Related Controls
RISK-001,Strategic,A test risk scenario,"CREDO-001\n- CREDO-002"
RISK-002,Operational,Another test scenario,"CREDO-003"
INVALID-RISK,,Empty description,
RISK-003,Financial,Third scenario,"CREDO-001\n- CREDO-004\n- CREDO-005"`;

// Add this test function
function runTests() {
    console.log('=== Testing Risk Library Processing ===');
    const processedRisks = processRiskLibrary(testRiskCSV);
    console.log('\nFinal processed risks:', JSON.stringify(processedRisks, null, 2));
}

// Call the test function
runTests();