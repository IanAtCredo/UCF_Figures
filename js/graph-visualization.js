// Constants

const colorMap = {
    'Privacy': '#006400',
    'Fairness & Bias': '#4b0082',
    'Human-AI Interaction': '#ff0000',
    'Performance & Robustness': '#ffa500',
    'Malicious Use': '#ffff00',
    'Environmental Harm': '#0000ff',
    'Societal Impact': '#6495ed',
    'AI Agency': '#ff1493',
    'Harmful Content': '#98fb98',
    'Explainability & Transparency': '#ffb6c1'
};

// Text color map for risk type labels
const textColorMap = {
    'Privacy': '#ffffff', // Dark green gets white text
    'Fairness & Bias': '#ffffff', // Dark purple gets white text  
    'Human-AI Interaction': '#ffffff', // Red gets white text
    'Performance & Robustness': '#000000', // Orange gets black text
    'Malicious Use': '#000000', // Yellow gets black text
    'Environmental Harm': '#ffffff', // Blue gets white text
    'Societal Impact': '#000000', // Light blue gets black text
    'AI Agency': '#ffffff', // Hot pink gets white text
    'Harmful Content': '#000000', // Light green gets black text
};

// Variables
let currentSimulation = null;
let currentContainer = null;
let currentNodes = null;
let currentLinks = null;
let currentNodeGroup = null;
let currentLinkGroup = null;
let width = window.innerWidth;
let height = window.innerHeight;
let isSimulationPaused = false;
let zoom;
// Add these new functions for filtering
let visibleRiskTypes = new Set(Object.keys(colorMap));
let visibleNodeTypes = new Set(['risk', 'control', 'policy']);
let edgeVisibilityRatio = 1.0; // Default to show all edges
let visibleEdgeIndices = new Set();
let edgeWidth = 4;
let edgeWidthSmall = 1;

// Force parameters
let parameters = {
    force: {
        linkDistance: 200,
        charge: -950,
        collisionRadius: 2
    },
    bipartite: {
        xSeparation: 0.5,
        forceStrength: 1.5
    }
};

function getControlNumber(controlId) {
    return controlId.split('-')[1];
}

function updateForceParameter(param, value) {
    const layoutType = document.getElementById('layout-select').value;
    value = parseFloat(value);

    // Get the value display element
    const valueDisplay = document.getElementById(`${param}-value`);
    if (valueDisplay) {
        valueDisplay.textContent = value;
    }

    // Update the parameter based on layout type
    if (layoutType === 'force') {
        if (param in parameters.force) {
            parameters.force[param] = value;
        }
    } else if (layoutType === 'bipartite') {
        if (param in parameters.bipartite) {
            parameters.bipartite[param] = value;
        }
    }

    // Only reapply layout if we have an active simulation
    if (currentSimulation) {
        // Stop the current simulation
        currentSimulation.stop();

        // Create new simulation based on layout type
        if (layoutType === 'force') {
            currentSimulation = applyForceLayout(currentNodes, currentLinks);
        } else {
            currentSimulation = applyBipartiteLayout(currentNodes, currentLinks);
        }

        // Set up the tick function
        currentSimulation.on("tick", () => {
            currentLinkGroup
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            currentNodeGroup
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Restart the simulation
        currentSimulation.alpha(1).restart();
    }
}

// Initialize parameter values
function initializeParameters() {
    // Force parameters
    document.getElementById('link-distance').value = parameters.force.linkDistance;
    document.getElementById('charge-strength').value = parameters.force.charge;
    document.getElementById('collision-radius').value = parameters.force.collisionRadius;

    // Bipartite parameters
    document.getElementById('x-separation').value = parameters.bipartite.xSeparation;
    document.getElementById('force-strength').value = parameters.bipartite.forceStrength;

    // Update displays
    updateForceParameter('linkDistance', parameters.force.linkDistance);
    updateForceParameter('charge', parameters.force.charge);
    updateForceParameter('collisionRadius', parameters.force.collisionRadius);
    updateForceParameter('xSeparation', parameters.bipartite.xSeparation);
    updateForceParameter('forceStrength', parameters.bipartite.forceStrength);
}

function applyForceLayout(nodes, links) {
    // Use seeded random for initial positions
    nodes.forEach(node => {
        node.x = width * seededRandom();
        node.y = height * seededRandom();
    });

    return d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links)
            .id(d => d.id)
            .distance(parameters.force.linkDistance))
        .force("charge", d3.forceManyBody()
            .strength(parameters.force.charge))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(d => d.radius * parameters.force.collisionRadius));
}

function applyBipartiteLayout(nodes, links) {
    // Use seeded random for initial y positions
    nodes.forEach(node => {
        node.y = height * seededRandom();
    });

    return d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(200))
        .force("charge", d3.forceManyBody().strength(-500))
        .force("y", d3.forceY(height / 2))
        .force("x", d3.forceX(d => d.type === 'control' ?
            width * 0.05 :
            width * 0.95)
            .strength(parameters.bipartite.forceStrength))
        .force("collision", d3.forceCollide().radius(d => d.radius * 2));
}

function changeLayout() {
    const layoutType = document.getElementById('layout-select').value;
    if (!currentNodes || !currentLinks) return;

    // Update parameter visibility
    document.getElementById('force-parameters').style.display =
        layoutType === 'force' ? 'block' : 'none';
    document.getElementById('bipartite-parameters').style.display =
        layoutType === 'bipartite' ? 'block' : 'none';

    // Stop the current simulation
    if (currentSimulation) currentSimulation.stop();

    // Update node sizes and labels
    currentNodeGroup.each(function (d) {
        const node = d3.select(this);
        if (d.type === 'risk') {
            // Update square size
            node.select("path")
                .attr("d", d => {
                    const size = d.radius;
                    return `M${-size},${-size} L${size},${-size} L${size},${size} L${-size},${size} Z`;
                });
            // Update risk label position
            node.select("text")
                .attr("dy", d => d.radius + 15);
        } else {
            // Update circle size
            node.select("circle")
                .attr("r", d => d.radius);
            // Update control label
            node.select("text.control-label")
                .text(d => getControlNumber(d.id));
        }
    });

    // Create new simulation based on layout type
    switch (layoutType) {
        case 'force':
            currentSimulation = applyForceLayout(currentNodes, currentLinks);
            break;
        case 'bipartite':
            currentSimulation = applyBipartiteLayout(currentNodes, currentLinks);
            break;
    }

    // Set up the tick function for the new simulation
    currentSimulation.on("tick", () => {
        currentLinkGroup
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        currentNodeGroup
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Set up drag behavior for the new simulation
    currentNodeGroup.call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Restart the simulation
    currentSimulation.alpha(1).restart();
}

async function initializeGraph() {
    const data = await processData();
    if (!data) {
        console.error('Failed to load data');
        return;
    }

    // Initialize side panels
    initializeSidePanels(data);

    // Create the legend
    createLegend();

    // Initialize parameters before setting up the graph
    initializeParameters();

    const { riskData, controlData, policyData, relationships } = data;

    // Calculate control degrees (number of connections)
    const controlDegrees = new Map();
    relationships.forEach(rel => {
        const count = controlDegrees.get(rel.target) || 0;
        controlDegrees.set(rel.target, count + 1);
    });

    // Get max connections for scaling
    const maxConnections = Math.max(...controlDegrees.values());

    // Create a map for faster lookups
    const nodeMap = new Map();

    // Process data into D3 format
    const nodes = [
        ...riskData.map(d => {
            const node = { ...d, type: 'risk', radius: 30 };
            nodeMap.set(d.id, node);
            return node;
        }),
        ...controlData.map(d => {
            const connections = controlDegrees.get(d.id) || 0;
            const radius = 20 + (connections / maxConnections * 60);
            const node = { ...d, type: 'control', radius, connections };
            nodeMap.set(d.id, node);
            return node;
        }),
        ...policyData.map(p => {
            const node = {
                ...p,
                type: 'policy',
                radius: 70
            };
            nodeMap.set(p.id, node);
            return node;
        })
    ];

    currentNodes = nodes;

    // Create links using the node map
    console.log(relationships);
    const links = relationships
        .map(d => ({
            source: nodeMap.get(d.source),
            target: nodeMap.get(d.target),
            type: d.type
        }))
        .filter(d => d.source && d.target);

    currentLinks = links;

    // Set up the SVG
    const svg = d3.select("#graph")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Create zoom behavior
    zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Create a container for the graph
    const container = svg.append("g");
    currentContainer = container;

    // Create the force simulation
    currentSimulation = applyForceLayout(nodes, links);

    // Create the links
    currentLinkGroup = container.append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", d => `link ${d.type}-link`);  // Add type-specific class

    // Create the nodes
    currentNodeGroup = container.append("g")
        .selectAll(".node")
        .data(nodes)
        .join("g")
        .attr("class", "node")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Add shapes to nodes
    currentNodeGroup.each(function (d) {
        const node = d3.select(this);
        if (d.type === 'risk') {
            // Add square for risks
            node.append("path")
                .attr("d", d => {
                    const size = d.radius;
                    return `M${-size},${-size} L${size},${-size} L${size},${size} L${-size},${size} Z`;
                })
                .attr("fill", d => riskTypeColor(d.riskType));

            // Add risk label below
            node.append("text")
                .attr("dy", d => d.radius + 15)
                .attr("class", "risk-label")
                .text(d => d.name.substring(0, 20) + (d.name.length > 20 ? '...' : ''));
        } else if (d.type === 'control') {
            // Add circle for controls
            node.append("circle")
                .attr("r", d => d.radius)
                .attr("class", "control-node");

            // Add control number inside circle
            node.append("text")
                .attr("class", "control-label")
                .text(d => getControlNumber(d.id));

            // Add arcs for risk type distribution
            updateControlArcs.call(this, d);
        } else if (d.type === 'policy') {
            // Add pentagon for policy nodes
            node.append("path")
                .attr("d", d => {
                    const size = d.radius;
                    const angle = 2 * Math.PI / 5; // Pentagon has 5 sides
                    return Array.from({ length: 5 }, (_, i) => {
                        const a = i * angle - Math.PI / 2; // Start from top point
                        const x = size * Math.cos(a);
                        const y = size * Math.sin(a);
                        return (i === 0 ? "M" : "L") + x + "," + y;
                    }).join("") + "Z";
                })
                .attr("class", "policy-node");

            node.append("text")
                .attr("class", "policy-label")
                .attr("text-anchor", "middle")
                .attr("alignment-baseline", "middle")
                .text(d => d.id);
        }
    });

    // Add tooltips
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    currentNodeGroup.on("mouseover", function (event, d) {
        this.parentNode.appendChild(this);

        tooltip.transition()
            .duration(200)
            .style("opacity", .9);
        tooltip.html(getTooltipContent(d))
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px");

        const connectedNodes = new Set();
        links.forEach(l => {
            if (l.source === d) connectedNodes.add(l.target);
            if (l.target === d) connectedNodes.add(l.source);
        });

        currentNodeGroup.style("opacity", n => connectedNodes.has(n) || n === d ? 1 : 0.1);
        currentLinkGroup.style("opacity", l => l.source === d || l.target === d ? 1 : 0.1)
            .style("stroke-width", l => l.source === d || l.target === d ? edgeWidth + 1 : edgeWidthSmall);
    })
        .on("mouseout", function (d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);

            currentNodeGroup.style("opacity", 1);
            currentLinkGroup.style("opacity", 0.6)
                .style("stroke-width", edgeWidth);
            updateVisibility();
        });

    // Simulation tick function
    currentSimulation.on("tick", () => {
        currentLinkGroup
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        currentNodeGroup
            .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    updateVisibleEdges();
}

// Drag functions
function dragstarted(event) {
    if (!event.active) {
        // Always restart simulation during drag for smooth movement
        currentSimulation.alphaTarget(0.3).restart();
    }
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    currentNodes.forEach(node => {
        node.fx = null;
        node.fy = null;
    });
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) {
        currentSimulation.alphaTarget(0);
    }

    if (isSimulationPaused) {
        // If paused, fix all nodes in their current positions
        currentNodes.forEach(node => {
            node.fx = node.x;
            node.fy = node.y;
        });
        // Stop the simulation
        currentSimulation.alpha(0);
        currentSimulation.stop();
    } else {
        // If not paused, release all nodes
        currentNodes.forEach(node => {
            node.fx = null;
            node.fy = null;
        });
    }
}

// Helper functions
function riskTypeColor(type) {
    return colorMap[type] || '#999';
}

function createLegend() {
    const legend = d3.select("body")
        .append("div")
        .attr("id", "legend");

    // Add Credo AI Logo
    legend.append("div")
        .attr("id", "legend-logo")
        .style("text-align", "left")
        .style("margin-bottom", "15px")
        .append("img")
        .attr("src", "images/Credo_AI_Logo.png")
        .attr("alt", "Credo AI Logo")
        .style("width", "50%");

    // Add legend title
    legend.append("div")
        .attr("class", "legend-title")
        .style("text-align", "left")
        .text("Legend");

    // Add control section with toggle
    addControlSection(legend);

    // Add policy section with toggle
    addPolicySection(legend);

    // Add Risk Types section with toggle
    addRiskTypesSection(legend);
}

function addControlSection(legend) {
    const controlSection = legend.append("div")
        .attr("class", "legend-section");

    const controlToggle = controlSection.append("div")
        .attr("class", "legend-item")
        .on("change", (event) => toggleNodeType('control', event));

    controlToggle.append("input")
        .attr("type", "checkbox")
        .attr("class", "legend-checkbox")
        .attr("checked", true);

    controlToggle.append("div")
        .attr("class", "legend-color")
        .style("background-color", "#fff")
        .style("border", "2px solid #000")
        .style("border-radius", "50%");

    controlToggle.append("div")
        .text("Controls");

    controlSection.append("div")
        .style("font-size", "11px")
        .style("color", "#666")
        .style("margin", "0 0 15px 23px")
        .text("Size indicates number of risk connections");
}

function addPolicySection(legend) {
    const policySection = legend.append("div")
        .attr("class", "legend-section");

    const policyToggle = policySection.append("div")
        .attr("class", "legend-item")
        .on("change", (event) => toggleNodeType('policy', event));

    policyToggle.append("input")
        .attr("type", "checkbox")
        .attr("class", "legend-checkbox")
        .attr("checked", true);

    policyToggle.append("div")
        .attr("class", "legend-color")
        .style("background-color", "#7c02ca")
        .style("border-radius", "50%");

    policyToggle.append("div")
        .text("Policy Requirements");

    policySection.append("div")
        .style("font-size", "11px")
        .style("color", "#666")
        .style("margin", "0 0 15px 23px")
        .text("Requirements from policy frameworks");
}

function addRiskTypesSection(legend) {
    const riskSection = legend.append("div")
        .attr("class", "legend-section");

    const riskHeader = riskSection.append("div")
        .attr("class", "legend-item")
        .on("change", (event) => toggleNodeType('risk', event));

    riskHeader.append("input")
        .attr("type", "checkbox")
        .attr("class", "legend-checkbox")
        .attr("checked", true);

    riskHeader.append("div")
        .style("font-weight", "bold")
        .text("Risk Types");

    Object.entries(colorMap).forEach(([type, color]) => {
        const item = riskSection.append("div")
            .attr("class", "legend-item")
            .style("margin-left", "20px")
            .on("change", (event) => toggleRiskType(type, event));

        item.append("input")
            .attr("type", "checkbox")
            .attr("class", "legend-checkbox")
            .attr("checked", true);

        item.append("div")
            .attr("class", "legend-color")
            .style("background-color", color);

        item.append("div")
            .text(type);
    });
}

function toggleRiskType(type, event) {
    // Use the event's target directly instead of querying for it
    const checkbox = event.target;

    if (checkbox.checked) {
        visibleRiskTypes.add(type);
    } else {
        visibleRiskTypes.delete(type);
    }
    updateVisibility();
}

function toggleNodeType(type, event) {
    const checkbox = event.target;

    if (checkbox.checked) {
        visibleNodeTypes.add(type);
    } else {
        visibleNodeTypes.delete(type);
    }
    updateVisibility();
}

function updateVisibility() {
    // Update nodes visibility
    currentNodeGroup.style("opacity", d => {
        if (d.type === 'risk') {
            return visibleNodeTypes.has('risk') && visibleRiskTypes.has(d.riskType) ? 1 : 0.05;
        } else if (d.type === 'policy') {
            return visibleNodeTypes.has('policy') ? 1 : 0.1;
        } else {
            return visibleNodeTypes.has('control') ? 1 : 0.1;
        }
    });

    // Update links visibility with edge sampling
    currentLinkGroup.style("opacity", (d, i) => {
        if (!visibleEdgeIndices.has(i)) return 0;

        const sourceVisible = d.source.type === 'risk' ?
            (visibleNodeTypes.has('risk') && visibleRiskTypes.has(d.source.riskType)) :
            visibleNodeTypes.has('control');
        const targetVisible = d.target.type === 'risk' ?
            (visibleNodeTypes.has('risk') && visibleRiskTypes.has(d.target.riskType)) :
            visibleNodeTypes.has('control');
        return sourceVisible && targetVisible ? 0.6 : 0.1;
    });
}

let randomSeed = 42;

function updateRandomSeed(value) {
    randomSeed = parseInt(value);
    // Reinitialize the graph with the new seed
    d3.select("#graph").selectAll("*").remove();
    d3.select("#legend").remove();
    initializeGraph();
}

// Custom random number generator with seed
function seededRandom() {
    let x = Math.sin(randomSeed++) * 10000;
    return x - Math.floor(x);
}

function getTooltipContent(d) {
    if (d.type === 'risk') {
        // Count mitigating controls
        const mitigatingControls = currentLinks.filter(l => l.source === d).length;

        return `<h3>${d.name}</h3>
                        <div class="type">Type: ${d.riskType}</div>
                        <div class="type">Number of Mitigating Controls: ${mitigatingControls}</div>
                        <div class="description-label">Description</div>
                        <div class="description">${d.description}</div>`;
    } else if (d.type === 'control') {
        // Get all connected risks and their types
        const connectedRisks = currentLinks
            .filter(l => l.target === d)
            .map(l => l.source);

        // Count risks by type
        const riskTypeCounts = connectedRisks.reduce((acc, risk) => {
            acc[risk.riskType] = (acc[risk.riskType] || 0) + 1;
            return acc;
        }, {});

        // Sort risk types by count (descending) and name
        const sortedRiskTypes = Object.entries(riskTypeCounts)
            .sort(([typeA, countA], [typeB, countB]) =>
                countB - countA || typeA.localeCompare(typeB));

        const totalRisks = connectedRisks.length;

        return `<h3>${d.id}: ${d.label}</h3>
                        <div class="risk-types">
                            Risk Types Addressed (${totalRisks}):
                            <ul>
                                ${sortedRiskTypes.map(([type, count]) =>
            `<li>${type} (${count})</li>`).join('')}
                            </ul>
                        </div>
                        <div class="description-label">Description</div>
                        <div class="description">${d.description}</div>`;
    } else if (d.type === 'policy') {
        return `<h3>${d.id}</h3>
                <div class="type">Regulation: ${d.regulation}</div>
                <div class="description-label">Requirement</div>
                <div class="description">${d.requirement}</div>`;
    }
}

function createControlArcs(node, connections) {
    const radius = node.radius;
    const arcGenerator = d3.arc()
        .innerRadius(radius - 2)
        .outerRadius(radius);

    // Group connections by risk type
    const riskTypes = new Map();
    connections.forEach(conn => {
        const type = conn.source.riskType;
        if (!riskTypes.has(type)) {
            riskTypes.set(type, 0);
        }
        riskTypes.set(type, riskTypes.get(type) + 1);
    });

    // Convert to array and calculate percentages
    const total = connections.length;
    let startAngle = 0;
    const arcs = [];

    riskTypes.forEach((count, type) => {
        const percentage = count / total;
        const endAngle = startAngle + (percentage * 2 * Math.PI);

        arcs.push({
            startAngle,
            endAngle,
            color: riskTypeColor(type)
        });

        startAngle = endAngle;
    });

    return arcs;
}

function updateControlArcs(node) {
    // Find all connections for this control
    const connections = currentLinks.filter(l => l.target === node);

    // Create arcs data
    const arcs = createControlArcs(node, connections);

    // Create or update arcs
    const arcGroup = d3.select(this).selectAll(".control-arc")
        .data(arcs);

    // Remove old arcs
    arcGroup.exit().remove();

    // Add new arcs
    const arcGenerator = d3.arc()
        .innerRadius(node.radius - node.radius * 0.1)
        .outerRadius(node.radius);

    arcGroup.enter()
        .append("path")
        .merge(arcGroup)
        .attr("class", "control-arc")
        .attr("d", d => arcGenerator(d))
        .style("stroke", d => d.color)
        .style("stroke-width", node.radius * 0.15);
}

function toggleSimulation() {
    const button = document.getElementById('pause-button');
    isSimulationPaused = !isSimulationPaused;

    if (isSimulationPaused) {
        button.textContent = 'Resume';
        button.classList.add('active');
        if (currentSimulation) {
            // Fix all nodes in their current positions
            currentNodes.forEach(node => {
                node.fx = node.x;
                node.fy = node.y;
            });
            currentSimulation.alpha(0);
            currentSimulation.stop();
        }
    } else {
        button.textContent = 'Pause';
        button.classList.remove('active');
        // Release all fixed positions
        currentNodes.forEach(node => {
            node.fx = null;
            node.fy = null;
        });
        if (currentSimulation) {
            currentSimulation.alpha(0.3).restart();
        }
    }
}

function updateVisibleEdges() {
    // Reset the set of visible edges
    visibleEdgeIndices.clear();

    // If showing all edges, make all indices visible
    if (edgeVisibilityRatio >= 1) {
        for (let i = 0; i < currentLinks.length; i++) {
            visibleEdgeIndices.add(i);
        }
        return;
    }

    // Calculate how many edges to show
    const numEdgesToShow = Math.floor(currentLinks.length * edgeVisibilityRatio);

    // Create array of indices and shuffle it using seededRandom
    let indices = Array.from({ length: currentLinks.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Take the first n indices
    for (let i = 0; i < numEdgesToShow; i++) {
        visibleEdgeIndices.add(indices[i]);
    }
}

// Initialize the graph when the page loads
window.addEventListener('load', initializeGraph);

// Add these new functions at the end of the script section
function initializeSidePanels(data) {
    const { riskData, controlData, policyData } = data;

    // Populate tables
    populateControlsTable(controlData);
    populateRisksTable(riskData);
    populatePolicyTable(policyData);

    // Add click handlers for panel tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const panel = this.parentElement;
            const otherPanel = document.querySelector('.side-panel.active');

            if (otherPanel && otherPanel !== panel) {
                otherPanel.classList.remove('active');
                clearHighlightAndSelection();
            }

            panel.classList.toggle('active');
            if (!panel.classList.contains('active')) {
                clearHighlightAndSelection();
            }
            if (panel.classList.contains('active')) {
                panel.focus();
            }
        });
    });

    // Add click handler to document to close panels when clicking outside
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.side-panel') && !e.target.closest('.panel-tab')) {
            document.querySelectorAll('.side-panel.active').forEach(panel => {
                panel.classList.remove('active');
                clearHighlightAndSelection();
            });
        }
    });

    // Add click handlers for close buttons
    document.querySelectorAll('.close-panel').forEach(closeBtn => {
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const panel = this.closest('.side-panel');
            panel.classList.remove('active');
            clearHighlightAndSelection();
        });
    });
}

function clearHighlightAndSelection() {
    // Clear row selections
    document.querySelectorAll('.clickable-row').forEach(row => {
        row.classList.remove('selected');
    });

    // Clear node highlighting
    currentNodeGroup.style("opacity", 1);
    currentLinkGroup.style("opacity", 0.6)
        .style("stroke-width", edgeWidth);
    currentNodeGroup.classed("highlighted", false);

    // Update visibility based on current filters
    updateVisibility();
}

function highlightAndCenterNode(nodeId) {
    // Find the node in our data
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node) return;

    // Check if the row is already selected
    const selectedRow = document.querySelector(`.clickable-row[data-node-id="${nodeId}"]`);
    if (selectedRow && selectedRow.classList.contains('selected')) {
        // If already selected, clear highlight and selection
        clearHighlightAndSelection();
        return;
    }

    // Clear any previously selected rows
    document.querySelectorAll('.clickable-row').forEach(row => {
        row.classList.remove('selected');
    });

    // Add selected class to the clicked row
    if (selectedRow) {
        selectedRow.classList.add('selected');
    }

    // Highlight the node and its connections
    const connectedNodes = new Set();
    currentLinks.forEach(l => {
        if (l.source.id === nodeId) connectedNodes.add(l.target);
        if (l.target.id === nodeId) connectedNodes.add(l.source);
    });

    currentNodeGroup.style("opacity", n => connectedNodes.has(n) || n.id === nodeId ? 1 : 0.1);
    currentLinkGroup.style("opacity", l => l.source.id === nodeId || l.target.id === nodeId ? 1 : 0.1)
        .style("stroke-width", l => l.source.id === nodeId || l.target.id === nodeId ? edgeWidth + 1 : edgeWidthSmall);

    // Center the node with transition (25% from left, 50% vertical)
    const svg = d3.select("#graph svg");
    const currentTransform = d3.zoomTransform(svg.node());

    // Calculate the translation needed to position the node at 25% from left and 50% vertical
    const dx = width * 0.25 - node.x * currentTransform.k;
    const dy = height * 0.6 - node.y * currentTransform.k;

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity
                .translate(dx, dy)
                .scale(currentTransform.k)
        );

    // Add highlighting style
    currentNodeGroup.classed("highlighted", n => n.id === nodeId);
}

function populateControlsTable(controlData) {
    const tbody = document.getElementById('controls-table-body');
    tbody.innerHTML = controlData.map(control => `
                <tr class="clickable-row" data-node-id="${control.id}">
                    <td>${control.id}</td>
                    <td>${control.label}</td>
                    <td>${control.description}</td>
                </tr>
            `).join('');

    // Add click handlers to rows
    tbody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', function () {
            const nodeId = this.dataset.nodeId;
            highlightAndCenterNode(nodeId);
        });
    });
}

function populateRisksTable(riskData) {
    const tbody = document.getElementById('risks-table-body');
    tbody.innerHTML = riskData.map(risk => `
                <tr class="clickable-row" data-node-id="${risk.id}">
                    <td>${risk.name}</td>
                    <td>
                        <span class="risk-type-cell" style="background-color: ${colorMap[risk.riskType] || '#999'}; color: ${textColorMap[risk.riskType] || '#000000'};">
                            ${risk.riskType}
                        </span>
                    </td>
                    <td>${risk.description}</td>
                </tr>
            `).join('');

    // Add click handlers to rows
    tbody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', function () {
            const nodeId = this.dataset.nodeId;
            highlightAndCenterNode(nodeId);
        });
    });
}

function populatePolicyTable(policyData) {
    const tbody = document.getElementById('policy-table-body');
    tbody.innerHTML = policyData.map(policy => `
                <tr class="clickable-row" data-node-id="${policy.id}">
                    <td>${policy.id}</td>
                    <td>${policy.regulation}</td>
                    <td>${policy.requirement}</td>
                </tr>
            `).join('');

    // Add click handlers to rows
    tbody.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', function () {
            const nodeId = this.dataset.nodeId;
            highlightAndCenterNode(nodeId);
        });
    });
}
