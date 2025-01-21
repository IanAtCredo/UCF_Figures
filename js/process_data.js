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
        .filter(c => c && c.startsWith('CONTROL-'));
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
            const isValid = control['Control ID'] && control['Control ID'].startsWith('CONTROL-');
            return isValid;
        })
        .map(control => ({
            id: control['Control ID'],
            label: control['Control Label'],
            description: control['Description']
        }));

    return processedControls;
}

// Process policy requirements
function processPolicyRequirements(content) {
    const policies = parseCSV(content);

    const processedPolicies = policies
        .filter(policy => {
            const isValid = policy['Policy Req Key'] && policy['Regulation'] && policy['Policy Requirement'];
            return isValid;
        })
        .map(policy => {
            const relatedControls = parseRelatedControls(policy['Related Control IDs']);

            return {
                id: policy['Policy Req Key'],
                regulation: policy['Regulation'],
                requirement: policy['Policy Requirement'],
                relatedControls
            };
        });

    return processedPolicies;
}

// Extract relationships
function extractRelationships(risks, policies) {
    const relationships = [];

    // Add risk-control relationships
    risks.forEach(risk => {
        risk.relatedControls.forEach(controlId => {
            relationships.push({
                source: risk.id,
                target: controlId,
                type: 'risk'  // Mark as risk relationship
            });
        });
    });

    // Add policy-control relationships
    policies.forEach(policy => {
        policy.relatedControls.forEach(controlId => {
            relationships.push({
                source: policy.id,
                target: controlId,
                type: 'policy'  // Mark as policy relationship
            });
        });
    });

    return relationships;
}

// Main processing function
async function processData() {
    try {
        // Load all data files
        const [riskResponse, controlResponse, policyResponse] = await Promise.all([
            fetch('data/risk_library.csv'),
            fetch('data/control_library.csv'),
            fetch('data/policy_requirements.csv')
        ]);

        const [riskContent, controlContent, policyContent] = await Promise.all([
            riskResponse.text(),
            controlResponse.text(),
            policyResponse.text()
        ]);

        const riskData = processRiskLibrary(riskContent);
        const controlData = processControlLibrary(controlContent);
        const policyData = processPolicyRequirements(policyContent);
        const relationships = extractRelationships(riskData, policyData);

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
                })),
                ...policyData.map(p => ({
                    id: p.id,
                    type: 'policy',
                    regulation: p.regulation
                }))
            ],
            links: relationships
        };

        console.log('Graph structure:', {
            totalNodes: graph.nodes.length,
            riskNodes: graph.nodes.filter(n => n.type === 'risk').length,
            controlNodes: graph.nodes.filter(n => n.type === 'control').length,
            policyNodes: graph.nodes.filter(n => n.type === 'policy').length,
            links: graph.links.length
        });

        return {
            riskData,
            controlData,
            policyData,
            relationships
        };
    } catch (error) {
        console.error('Error processing data:', error);
        return null;
    }
}

const testRiskCSV = `Risk Scenario,Risk Type,Description,Related Controls
RISK-001,Strategic,A test risk scenario,"CONTROL-001\n- CONTROL-002"
RISK-002,Operational,Another test scenario,"CONTROL-003"
INVALID-RISK,,Empty description,
RISK-003,Financial,Third scenario,"CONTROL-001\n- CONTROL-004\n- CONTROL-005"`;

const testPolicyCSV = `Policy Req Key,Regulation,Policy Requirement,Related Control IDs
POL-001,NIST,Data encryption requirement,"CONTROL-001\n- CONTROL-002"
POL-002,ISO27001,Access control policy,"CONTROL-003"
INVALID-POL,,Empty requirement,
POL-003,GDPR,Data protection measures,"CONTROL-001\n- CONTROL-004"`;

// Add this test function
function runTests() {
    console.log('=== Testing Risk Library Processing ===');
    const processedRisks = processRiskLibrary(testRiskCSV);
    console.log('\nFinal processed risks:', JSON.stringify(processedRisks, null, 2));

    console.log('\n=== Testing Policy Requirements Processing ===');
    const processedPolicies = processPolicyRequirements(testPolicyCSV);
    console.log('\nFinal processed policies:', JSON.stringify(processedPolicies, null, 2));
}

// Call the test function
runTests();