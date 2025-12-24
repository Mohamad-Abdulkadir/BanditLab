// ===== Chart.js Global Configuration - Light Theme =====
Chart.defaults.color = '#4F5D75';
Chart.defaults.borderColor = 'rgba(45, 49, 66, 0.1)';
Chart.defaults.font.family = "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif";

// ===== DOM Elements =====
const elements = {
    numArms: document.getElementById('numArms'),
    numSteps: document.getElementById('numSteps'),
    probsContainer: document.getElementById('probsContainer'),
    randomizeProbs: document.getElementById('randomizeProbs'),

    // Algorithm toggles
    toggleRandom: document.querySelector('[data-algorithm="random"]'),
    toggleUCB: document.querySelector('[data-algorithm="ucb"]'),
    toggleEpsilon: document.querySelector('[data-algorithm="epsilon"]'),
    toggleThompson: document.querySelector('[data-algorithm="thompson"]'),

    // UCB params
    ucbC: document.getElementById('ucbC'),
    ucbCValue: document.getElementById('ucbCValue'),
    ucbParams: document.getElementById('ucbParams'),

    // Epsilon params
    epsilon: document.getElementById('epsilon'),
    epsilonValue: document.getElementById('epsilonValue'),
    epsilonParams: document.getElementById('epsilonParams'),

    // Thompson params
    priorAlpha: document.getElementById('priorAlpha'),
    priorAlphaValue: document.getElementById('priorAlphaValue'),
    priorBeta: document.getElementById('priorBeta'),
    priorBetaValue: document.getElementById('priorBetaValue'),
    thompsonParams: document.getElementById('thompsonParams'),

    // Actions
    runSimulation: document.getElementById('runSimulation'),
    resetSimulation: document.getElementById('resetSimulation'),

    // Results
    slotMachinesDisplay: document.getElementById('slotMachinesDisplay'),
    slotMachinesRow: document.getElementById('slotMachinesRow'),
    winnerDisplay: document.getElementById('winnerDisplay'),
    summaryCards: document.getElementById('summaryCards'),
    armCharts: document.getElementById('armCharts'),

    // Charts
    rewardsChart: document.getElementById('rewardsChart'),
    regretChart: document.getElementById('regretChart'),
    explorationChart: document.getElementById('explorationChart')
};

// Agent display names
const agentInfo = {
    'Random': { title: 'Baseline' },
    'UCB': { title: 'Upper Confidence Bound' },
    'ε-Greedy': { title: 'Epsilon-Greedy' },
    'Thompson': { title: 'Thompson Sampling' }
};

// ===== State =====
let state = {
    numArms: 5,
    probs: [0.1, 0.3, 0.5, 0.7, 0.9],
    charts: {
        rewards: null,
        regret: null,
        exploration: null,
        armDistribution: {}
    }
};

// ===== Initialize =====
function init() {
    setupEventListeners();
    updateProbsInputs();
    updateSliderDisplays();
    updateParamVisibility();
}

// ===== Event Listeners =====
function setupEventListeners() {
    // Number of arms change
    elements.numArms.addEventListener('change', handleArmsChange);

    // Randomize probabilities
    elements.randomizeProbs.addEventListener('click', randomizeProbabilities);

    // Algorithm toggles
    document.querySelectorAll('.toggle-item').forEach(toggle => {
        toggle.addEventListener('click', handleToggleClick);
    });

    // Slider updates
    elements.ucbC.addEventListener('input', () => {
        elements.ucbCValue.textContent = parseFloat(elements.ucbC.value).toFixed(1);
    });

    elements.epsilon.addEventListener('input', () => {
        elements.epsilonValue.textContent = parseFloat(elements.epsilon.value).toFixed(2);
    });

    elements.priorAlpha.addEventListener('input', () => {
        elements.priorAlphaValue.textContent = parseFloat(elements.priorAlpha.value).toFixed(1);
    });

    elements.priorBeta.addEventListener('input', () => {
        elements.priorBetaValue.textContent = parseFloat(elements.priorBeta.value).toFixed(1);
    });

    // Run simulation
    elements.runSimulation.addEventListener('click', runSimulationHandler);

    // Reset
    elements.resetSimulation.addEventListener('click', resetSimulationHandler);
}

// ===== Handlers =====
function handleArmsChange() {
    const newNumArms = parseInt(elements.numArms.value);
    if (newNumArms < 2) elements.numArms.value = 2;
    if (newNumArms > 10) elements.numArms.value = 10;

    state.numArms = parseInt(elements.numArms.value);

    // Adjust probabilities array
    if (state.probs.length < state.numArms) {
        while (state.probs.length < state.numArms) {
            state.probs.push(Math.random().toFixed(2));
        }
    } else {
        state.probs = state.probs.slice(0, state.numArms);
    }

    updateProbsInputs();
}

function handleToggleClick(e) {
    const toggle = e.currentTarget;
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    toggle.classList.toggle('active', checkbox.checked);
    updateParamVisibility();
}

function randomizeProbabilities() {
    state.probs = Array.from({ length: state.numArms }, () =>
        parseFloat((Math.random() * 0.9 + 0.05).toFixed(2))
    );
    updateProbsInputs();

    elements.randomizeProbs.style.transform = 'scale(0.95)';
    setTimeout(() => {
        elements.randomizeProbs.style.transform = '';
    }, 100);
}

function runSimulationHandler() {
    // Add lever pull animation
    const leverBtn = elements.runSimulation;
    leverBtn.style.transform = 'translateY(4px)';
    setTimeout(() => {
        leverBtn.style.transform = '';
    }, 200);

    // Gather configuration
    const config = {
        probs: gatherProbabilities(),
        numSteps: parseInt(elements.numSteps.value),
        algorithms: {
            random: elements.toggleRandom.querySelector('input').checked,
            ucb: elements.toggleUCB.querySelector('input').checked,
            epsilon: elements.toggleEpsilon.querySelector('input').checked,
            thompson: elements.toggleThompson.querySelector('input').checked
        },
        ucbC: parseFloat(elements.ucbC.value),
        epsilon: parseFloat(elements.epsilon.value),
        priorAlpha: parseFloat(elements.priorAlpha.value),
        priorBeta: parseFloat(elements.priorBeta.value),
        seed: Date.now()
    };

    // Validate at least one algorithm is selected
    if (!Object.values(config.algorithms).some(v => v)) {
        alert('Please select at least one player to compete!');
        return;
    }

    // Run simulation
    const results = window.BanditCore.runSimulation(config);

    // Update visualizations
    updateSlotMachinesDisplay(results);
    updateWinnerDisplay(results);
    updateSummaryCards(results);
    updateCharts(results);
    updateArmDistribution(results);

    // Show variance note if any algorithm exceeds optimal expected reward
    const optimalReward = Math.round(results.config.bestProb * results.config.numSteps);
    const maxReward = Math.max(...Object.values(results.plotData).map(d => d.totalReward));
    const varianceNote = document.getElementById('varianceNote');
    if (varianceNote) {
        varianceNote.style.display = maxReward > optimalReward ? 'block' : 'none';
    }

    // Scroll to slot machines display
    elements.slotMachinesDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetSimulationHandler() {
    // Reset charts
    if (state.charts.rewards) state.charts.rewards.destroy();
    if (state.charts.regret) state.charts.regret.destroy();
    if (state.charts.exploration) state.charts.exploration.destroy();

    Object.values(state.charts.armDistribution).forEach(chart => {
        if (chart) chart.destroy();
    });

    state.charts = {
        rewards: null,
        regret: null,
        exploration: null,
        armDistribution: {}
    };

    // Hide and clear slot machines display
    elements.slotMachinesDisplay.classList.remove('visible');
    elements.slotMachinesRow.innerHTML = '';

    // Clear UI
    elements.summaryCards.innerHTML = '';
    elements.armCharts.innerHTML = '';

    // Reset winner display
    elements.winnerDisplay.innerHTML = `
        <div class="winner-content">
            <span class="trophy">🏆</span>
            <span class="winner-text">Run simulation to see results!</span>
        </div>
    `;

    // Reset to initial state
    state.numArms = 5;
    state.probs = [0.1, 0.3, 0.5, 0.7, 0.9];
    elements.numArms.value = 5;
    elements.numSteps.value = 1000;

    updateProbsInputs();
}

// ===== UI Updates =====
function updateProbsInputs() {
    elements.probsContainer.innerHTML = '';

    state.probs.forEach((prob, i) => {
        const group = document.createElement('div');
        group.className = 'prob-input-group';
        group.innerHTML = `
            <span>S${i + 1}:</span>
            <input type="number" min="0" max="1" step="0.01" value="${prob}" data-arm="${i}">
        `;

        group.querySelector('input').addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (val < 0) val = 0;
            if (val > 1) val = 1;
            e.target.value = val;
            state.probs[i] = val;
        });

        elements.probsContainer.appendChild(group);
    });
}

function updateSliderDisplays() {
    elements.ucbCValue.textContent = parseFloat(elements.ucbC.value).toFixed(1);
    elements.epsilonValue.textContent = parseFloat(elements.epsilon.value).toFixed(2);
    elements.priorAlphaValue.textContent = parseFloat(elements.priorAlpha.value).toFixed(1);
    elements.priorBetaValue.textContent = parseFloat(elements.priorBeta.value).toFixed(1);
}

function updateParamVisibility() {
    const ucbActive = elements.toggleUCB.querySelector('input').checked;
    const epsilonActive = elements.toggleEpsilon.querySelector('input').checked;
    const thompsonActive = elements.toggleThompson.querySelector('input').checked;

    elements.ucbParams.style.display = ucbActive ? 'block' : 'none';
    elements.epsilonParams.style.display = epsilonActive ? 'block' : 'none';
    elements.thompsonParams.style.display = thompsonActive ? 'block' : 'none';
}

function gatherProbabilities() {
    const inputs = elements.probsContainer.querySelectorAll('input');
    return Array.from(inputs).map(input => parseFloat(input.value));
}

// ===== Slot Machines Visual Display =====
function updateSlotMachinesDisplay(results) {
    const { config } = results;
    const { probs, bestProb, nArms } = config;

    // Show the display
    elements.slotMachinesDisplay.classList.add('visible');

    // Clear previous content
    elements.slotMachinesRow.innerHTML = '';

    // Create slot machine visual for each arm
    probs.forEach((prob, i) => {
        const isBest = prob === bestProb;

        const slotMachine = document.createElement('div');
        slotMachine.className = `slot-machine-visual${isBest ? ' best-slot' : ''}`;
        slotMachine.innerHTML = `
            <div class="slot-number">Slot ${i + 1}</div>
            <div class="slot-svg-container">
                <img src="assets/slot.svg" alt="Slot Machine ${i + 1}" class="slot-svg-icon" />
            </div>
            <div class="slot-probability">
                <div class="prob-value">${(prob * 100).toFixed(0)}%</div>
                <div class="prob-label">true probability</div>
            </div>
        `;

        elements.slotMachinesRow.appendChild(slotMachine);
    });
}

// ===== Winner Display =====
function updateWinnerDisplay(results) {
    const { plotData, config } = results;

    // Find the winner (highest total reward)
    let winner = null;
    let maxReward = -Infinity;

    for (const [name, data] of Object.entries(plotData)) {
        if (data.totalReward > maxReward) {
            maxReward = data.totalReward;
            winner = name;
        }
    }

    const info = agentInfo[winner] || { emoji: '🏆', title: winner };
    const optimalReward = Math.round(config.bestProb * config.numSteps);
    const efficiency = ((maxReward / optimalReward) * 100).toFixed(1);

    elements.winnerDisplay.innerHTML = `
        <div class="winner-content">
            <span class="trophy">🏆</span>
            <span class="winner-text">
                <strong>${winner}</strong> with ${maxReward} total reward
                <small>(${efficiency}% of optimal)</small>
            </span>
        </div>
    `;
}

// ===== Summary Cards =====
function updateSummaryCards(results) {
    const { plotData, config } = results;

    elements.summaryCards.innerHTML = '';

    // Sort by total reward
    const sortedEntries = Object.entries(plotData).sort((a, b) => b[1].totalReward - a[1].totalReward);

    sortedEntries.forEach(([name, data], index) => {
        const card = document.createElement('div');
        card.className = 'summary-card';
        card.style.setProperty('--card-accent', data.color);

        const info = agentInfo[name] || { emoji: '🤖', title: name };
        const explorationPct = data.explorationRate
            ? (data.explorationRate[data.explorationRate.length - 1] * 100).toFixed(1)
            : '100';

        const medal = index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : '';

        card.innerHTML = `
            <h4>
                <span class="card-icon"></span>
                ${medal} ${name}
            </h4>
            <div class="value">${data.totalReward}</div>
            <div class="subtitle">
                ${explorationPct}% exploration rate
            </div>
        `;

        elements.summaryCards.appendChild(card);
    });

    // Add optimal comparison card
    const optimalCard = document.createElement('div');
    optimalCard.className = 'summary-card';
    optimalCard.style.setProperty('--card-accent', '#2A9D8F');

    const optimalReward = Math.round(config.bestProb * config.numSteps);
    optimalCard.innerHTML = `
        <h4>
            <span class="card-icon"></span>
            Optimal
        </h4>
        <div class="value">${optimalReward}</div>
        <div class="subtitle">
            Best arm: ${(config.bestProb * 100).toFixed(0)}% probability
        </div>
    `;

    elements.summaryCards.appendChild(optimalCard);
}

// ===== Charts =====
function updateCharts(results) {
    const { plotData, config } = results;

    // Destroy existing charts
    if (state.charts.rewards) state.charts.rewards.destroy();
    if (state.charts.regret) state.charts.regret.destroy();
    if (state.charts.exploration) state.charts.exploration.destroy();

    // Common chart options - Light theme, full width optimized
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    font: {
                        size: 13,
                        weight: '600'
                    },
                    color: '#2D3142'
                }
            },
            tooltip: {
                backgroundColor: '#2D3142',
                titleColor: '#fff',
                bodyColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                usePointStyle: true,
                titleFont: { weight: '700' },
                bodyFont: { weight: '500' }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(45, 49, 66, 0.06)'
                },
                ticks: {
                    maxTicksLimit: 12,
                    color: '#4F5D75',
                    font: { weight: '500' }
                }
            },
            y: {
                grid: {
                    color: 'rgba(45, 49, 66, 0.06)'
                },
                ticks: {
                    color: '#4F5D75',
                    font: { weight: '500' }
                }
            }
        },
        elements: {
            line: {
                tension: 0.3,
                borderWidth: 3
            },
            point: {
                radius: 0,
                hoverRadius: 6,
                hoverBorderWidth: 2
            }
        }
    };

    // Prepare datasets
    const names = Object.keys(plotData);
    const timesteps = plotData[names[0]].timesteps;

    // Sample data points for performance (max 500 points)
    const sampleRate = Math.max(1, Math.floor(timesteps.length / 500));
    const sampledTimesteps = timesteps.filter((_, i) => i % sampleRate === 0 || i === timesteps.length - 1);

    // Cumulative Rewards Chart
    const rewardsDatasets = names.map(name => ({
        label: name,
        data: plotData[name].cumRewards.filter((_, i) => i % sampleRate === 0 || i === plotData[name].cumRewards.length - 1),
        borderColor: plotData[name].color,
        backgroundColor: plotData[name].color + '15',
        fill: false,
        hidden: name === 'Random' // Hide Random by default
    }));

    // Add optimal line
    const optimalRewards = sampledTimesteps.map(t => t * config.bestProb);
    rewardsDatasets.push({
        label: 'Perfect',
        data: optimalRewards,
        borderColor: '#2A9D8F',
        borderDash: [6, 4],
        backgroundColor: 'transparent',
        fill: false,
        borderWidth: 2
    });

    state.charts.rewards = new Chart(elements.rewardsChart, {
        type: 'line',
        data: {
            labels: sampledTimesteps,
            datasets: rewardsDatasets
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Total Coins',
                        color: '#2D3142',
                        font: { weight: '700', size: 13 }
                    }
                },
                x: {
                    ...commonOptions.scales.x,
                    title: {
                        display: true,
                        text: 'Pull #',
                        color: '#2D3142',
                        font: { weight: '700', size: 13 }
                    }
                }
            }
        }
    });

    // Cumulative Regret Chart
    const regretDatasets = names.map(name => ({
        label: name,
        data: plotData[name].cumRegret.filter((_, i) => i % sampleRate === 0 || i === plotData[name].cumRegret.length - 1),
        borderColor: plotData[name].color,
        backgroundColor: plotData[name].color + '15',
        fill: false,
        hidden: name === 'Random' // Hide Random by default
    }));

    state.charts.regret = new Chart(elements.regretChart, {
        type: 'line',
        data: {
            labels: sampledTimesteps,
            datasets: regretDatasets
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    title: {
                        display: true,
                        text: 'Missed Coins',
                        color: '#2D3142',
                        font: { weight: '700', size: 13 }
                    }
                },
                x: {
                    ...commonOptions.scales.x,
                    title: {
                        display: true,
                        text: 'Pull #',
                        color: '#2D3142',
                        font: { weight: '700', size: 13 }
                    }
                }
            }
        }
    });

    // Exploration Rate Chart
    const explorationDatasets = names
        .filter(name => plotData[name].explorationRate)
        .map(name => ({
            label: name,
            data: plotData[name].explorationRate.filter((_, i) => i % sampleRate === 0 || i === plotData[name].explorationRate.length - 1),
            borderColor: plotData[name].color,
            backgroundColor: plotData[name].color + '15',
            fill: false,
            hidden: name === 'Random' // Hide Random by default
        }));

    state.charts.exploration = new Chart(elements.explorationChart, {
        type: 'line',
        data: {
            labels: sampledTimesteps,
            datasets: explorationDatasets
        },
        options: {
            ...commonOptions,
            scales: {
                ...commonOptions.scales,
                y: {
                    ...commonOptions.scales.y,
                    min: 0,
                    max: 1,
                    title: {
                        display: true,
                        text: 'Exploration %',
                        color: '#2D3142',
                        font: { weight: '700', size: 13 }
                    },
                    ticks: {
                        callback: (value) => (value * 100).toFixed(0) + '%',
                        color: '#4F5D75',
                        font: { weight: '500' }
                    }
                },
                x: {
                    ...commonOptions.scales.x,
                    title: {
                        display: true,
                        text: 'Pull #',
                        color: '#2D3142',
                        font: { weight: '700', size: 13 }
                    }
                }
            }
        }
    });
}

// ===== Arm Distribution Charts =====
function updateArmDistribution(results) {
    const { plotData, config } = results;

    // Destroy existing charts
    Object.values(state.charts.armDistribution).forEach(chart => {
        if (chart) chart.destroy();
    });
    state.charts.armDistribution = {};

    elements.armCharts.innerHTML = '';

    // Generate slot labels
    const slotLabels = Array.from({ length: config.nArms }, (_, i) => `Slot ${i + 1}`);

    // Create colors for each slot
    const slotColors = generateSlotColors(config.nArms);

    for (const [name, data] of Object.entries(plotData)) {
        const container = document.createElement('div');
        container.className = 'arm-chart-item';
        container.style.setProperty('--item-color', data.color);

        const info = agentInfo[name] || { title: name };

        container.innerHTML = `
            <h4>${name}</h4>
            <div class="arm-chart-wrapper">
                <canvas id="arm-${name.replace(/[^a-zA-Z0-9]/g, '')}"></canvas>
            </div>
        `;

        elements.armCharts.appendChild(container);

        const canvas = container.querySelector('canvas');

        state.charts.armDistribution[name] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: slotLabels.map((label, i) => `${label} (${(config.probs[i] * 100).toFixed(0)}%)`),
                datasets: [{
                    data: data.armPulls,
                    backgroundColor: slotColors,
                    borderColor: '#FFFFFF',
                    borderWidth: 3,
                    hoverBorderWidth: 4,
                    hoverBorderColor: '#2D3142'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '55%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 10,
                            font: {
                                size: 10,
                                weight: '600'
                            },
                            color: '#4F5D75',
                            generateLabels: (chart) => {
                                const datasets = chart.data.datasets;
                                return chart.data.labels.map((label, i) => ({
                                    text: `${label}: ${datasets[0].data[i]}`,
                                    fillStyle: slotColors[i],
                                    strokeStyle: slotColors[i],
                                    lineWidth: 0,
                                    pointStyle: 'circle',
                                    hidden: false,
                                    index: i
                                }));
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#2D3142',
                        titleColor: '#fff',
                        bodyColor: 'rgba(255, 255, 255, 0.9)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: { weight: '700' },
                        bodyFont: { weight: '500' },
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${context.raw} pulls (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
}

function generateSlotColors(n) {
    // Casino-inspired color palette
    const casinoColors = [
        '#E63946', // Red
        '#FFB703', // Gold
        '#2A9D8F', // Teal
        '#7B2CBF', // Purple
        '#219EBC', // Blue
        '#FB8500', // Orange
        '#8338EC', // Violet
        '#3A86FF', // Bright Blue
        '#FF006E', // Pink
        '#38B000'  // Green
    ];

    return casinoColors.slice(0, n);
}

// ===== Initialize on DOM Ready =====
document.addEventListener('DOMContentLoaded', init);
