// ===== Seeded Random Number Generator =====

class SeededRNG {
    constructor(seed = Date.now()) {
        this.seed = seed >>> 0;
        this.state = this.seed;
    }

    reset() {
        this.state = this.seed;
    }

    setSeed(seed) {
        this.seed = seed >>> 0;
        this.state = this.seed;
    }

    // LCG-based random number generator
    random() {
        this.state = (1664525 * this.state + 1013904223) >>> 0;
        return this.state / 0x100000000;
    }

    // Standard normal using Box-Muller transform
    standardNormal() {
        const u1 = this.random();
        const u2 = this.random();
        const r = Math.sqrt(-2 * Math.log(u1));
        const theta = 2 * Math.PI * u2;
        return r * Math.cos(theta);
    }

    // Gamma(alpha, 1) using Marsaglia & Tsang method
    gammaSample(alpha) {
        if (alpha <= 0) {
            throw new Error("alpha must be > 0 for Gamma distribution");
        }

        if (alpha < 1) {
            const u = this.random();
            return this.gammaSample(alpha + 1) * Math.pow(u, 1 / alpha);
        }

        const d = alpha - 1 / 3;
        const c = 1 / Math.sqrt(9 * d);

        while (true) {
            let x, v;
            do {
                x = this.standardNormal();
                v = 1 + c * x;
            } while (v <= 0);

            v = v * v * v;
            const u = this.random();

            if (u < 1 - 0.0331 * (x ** 4)) {
                return d * v;
            }

            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
                return d * v;
            }
        }
    }

    // Beta(alpha, beta) via Gamma samples
    betaSample(alpha, beta) {
        const x = this.gammaSample(alpha);
        const y = this.gammaSample(beta);
        return x / (x + y);
    }

    // Random integer in [0, max)
    randInt(max) {
        return Math.floor(this.random() * max);
    }
}

// Global RNG instance
const rng = new SeededRNG(42);

// ===== Utility Functions =====

function cumulativeSum(arr) {
    const result = new Array(arr.length);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
        sum += arr[i];
        result[i] = sum;
    }
    return result;
}

function bincount(arr, minLen) {
    const counts = new Array(minLen).fill(0);
    for (const x of arr) {
        if (x >= 0 && x < minLen) counts[x]++;
    }
    return counts;
}

function argmax(arr) {
    let maxIdx = 0;
    let maxVal = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] > maxVal) {
            maxVal = arr[i];
            maxIdx = i;
        }
    }
    return maxIdx;
}

// ===== Bernoulli Bandit Environment =====

class BernoulliBandit {
    constructor(probs) {
        this.probs = probs.map(Number);
        this.nArms = this.probs.length;
        this.bestArm = argmax(this.probs);
        this.bestProb = Math.max(...this.probs);
    }

    pull(arm) {
        const p = this.probs[arm];
        return rng.random() < p ? 1 : 0;
    }
}

// ===== Policy Classes =====

/**
 * Random Policy - selects arms uniformly at random
 */
class RandomPolicy {
    constructor(nArms) {
        this.nArms = nArms;
        this.name = "Random";
        this.color = "#ff6b6b";
        this.explorationHistory = [];
    }

    reset() {
        this.explorationHistory = [];
    }

    selectArm() {
        this.explorationHistory.push(true);
        return rng.randInt(this.nArms);
    }

    update(arm, reward) {
    }

    getStats() {
        return {
            name: this.name,
            totalExploration: this.explorationHistory.length,
            totalExploitation: 0
        };
    }
}

/**
 * Upper Confidence Bound (UCB) Policy
 */
class UCB {
    constructor(nArms, c = 1.0) {
        this.nArms = nArms;
        this.c = c;
        this.name = "UCB";
        this.color = "#00f5d4";

        this.pulls = new Array(nArms).fill(0);
        this.avgRewards = new Array(nArms).fill(0);
        this.totalPulls = 0;
        this.explorationHistory = [];
    }

    reset() {
        this.pulls = new Array(this.nArms).fill(0);
        this.avgRewards = new Array(this.nArms).fill(0);
        this.totalPulls = 0;
        this.explorationHistory = [];
    }

    selectArm() {
        // Ensure each arm is played at least once
        for (let arm = 0; arm < this.nArms; arm++) {
            if (this.pulls[arm] === 0) {
                this.explorationHistory.push(true);
                return arm;
            }
        }

        const t = Math.max(1, this.totalPulls);
        const ucbValues = new Array(this.nArms);

        for (let arm = 0; arm < this.nArms; arm++) {
            const N = this.pulls[arm];
            const u = this.avgRewards[arm];
            const bonus = this.c * Math.sqrt((2 * Math.log(t)) / N);
            ucbValues[arm] = u + bonus;
        }

        const bestArm = argmax(ucbValues);
        const greedyArm = argmax(this.avgRewards);
        const isExploration = bestArm !== greedyArm;
        this.explorationHistory.push(isExploration);

        return bestArm;
    }

    update(arm, reward) {
        this.totalPulls += 1;
        this.pulls[arm] += 1;

        const n = this.pulls[arm];
        const prev = this.avgRewards[arm];
        this.avgRewards[arm] = prev + (reward - prev) / n;
    }

    getStats() {
        const explores = this.explorationHistory.filter(x => x).length;
        return {
            name: this.name,
            c: this.c,
            totalExploration: explores,
            totalExploitation: this.explorationHistory.length - explores
        };
    }
}

/**
 * Epsilon-Greedy Policy
 */
class EpsilonGreedy {
    constructor(nArms, epsilon = 0.1, decay = false, minEpsilon = 0.0) {
        this.nArms = nArms;
        this.initialEpsilon = epsilon;
        this.epsilon = epsilon;
        this.decay = decay;
        this.minEpsilon = minEpsilon;
        this.name = "ε-Greedy";
        this.color = "#ffd93d";

        this.pulls = new Array(nArms).fill(0);
        this.avgRewards = new Array(nArms).fill(0);
        this.totalPulls = 0;
        this.explorationHistory = [];
    }

    reset() {
        this.epsilon = this.initialEpsilon;
        this.pulls = new Array(this.nArms).fill(0);
        this.avgRewards = new Array(this.nArms).fill(0);
        this.totalPulls = 0;
        this.explorationHistory = [];
    }

    selectArm() {
        // Ensure each arm is played at least once
        for (let arm = 0; arm < this.nArms; arm++) {
            if (this.pulls[arm] === 0) {
                this.explorationHistory.push(true);
                return arm;
            }
        }

        if (rng.random() < this.epsilon) {
            // Explore
            this.explorationHistory.push(true);
            return rng.randInt(this.nArms);
        } else {
            // Exploit
            this.explorationHistory.push(false);
            return argmax(this.avgRewards);
        }
    }

    update(arm, reward) {
        this.totalPulls += 1;
        this.pulls[arm] += 1;

        if (this.decay) {
            this.epsilon = Math.max(
                this.minEpsilon,
                this.initialEpsilon / Math.sqrt(this.totalPulls)
            );
        }

        const n = this.pulls[arm];
        const prev = this.avgRewards[arm];
        this.avgRewards[arm] = prev + (reward - prev) / n;
    }

    getStats() {
        const explores = this.explorationHistory.filter(x => x).length;
        return {
            name: this.name,
            epsilon: this.initialEpsilon,
            decay: this.decay,
            minEpsilon: this.minEpsilon,
            currentEpsilon: this.epsilon,
            totalExploration: explores,
            totalExploitation: this.explorationHistory.length - explores
        };
    }
}

/**
 * Thompson Sampling Policy
 */
class ThompsonSampling {
    constructor(nArms, priorAlpha = 1.0, priorBeta = 1.0) {
        this.nArms = nArms;
        this.priorAlpha = priorAlpha;
        this.priorBeta = priorBeta;
        this.name = "Thompson";
        this.color = "#9b5de5";

        this.alphas = new Array(nArms).fill(priorAlpha);
        this.betas = new Array(nArms).fill(priorBeta);
        this.explorationHistory = [];
    }

    reset() {
        this.alphas = new Array(this.nArms).fill(this.priorAlpha);
        this.betas = new Array(this.nArms).fill(this.priorBeta);
        this.explorationHistory = [];
    }

    selectArm() {
        // Posterior means
        const means = this.alphas.map((a, i) => {
            const b = this.betas[i];
            return a / (a + b);
        });
        const greedyArm = argmax(means);

        // Sample from each posterior
        const samples = this.alphas.map((a, i) => {
            const b = this.betas[i];
            return rng.betaSample(a, b);
        });
        const bestArm = argmax(samples);

        const isExploration = bestArm !== greedyArm;
        this.explorationHistory.push(isExploration);

        return bestArm;
    }

    update(arm, reward) {
        if (reward > 0) {
            this.alphas[arm] += 1;
        } else {
            this.betas[arm] += 1;
        }
    }

    getStats() {
        const explores = this.explorationHistory.filter(x => x).length;
        return {
            name: this.name,
            priorAlpha: this.priorAlpha,
            priorBeta: this.priorBeta,
            totalExploration: explores,
            totalExploitation: this.explorationHistory.length - explores
        };
    }
}

// ===== Simulation Runner =====

function runBandit(env, agent, numSteps) {
    const rewards = new Array(numSteps);
    const chosenArms = new Array(numSteps);

    for (let t = 0; t < numSteps; t++) {
        const arm = agent.selectArm();
        const reward = env.pull(arm);
        agent.update(arm, reward);

        rewards[t] = reward;
        chosenArms[t] = arm;
    }

    return { rewards, chosenArms };
}

// ===== Main Simulation Function =====

function runSimulation(config) {
    const {
        probs,
        numSteps,
        algorithms,
        ucbC,
        epsilon,
        epsilonDecay,
        minEpsilon,
        priorAlpha,
        priorBeta,
        seed
    } = config;

    // Set random seed
    rng.setSeed(seed || Date.now());

    const nArms = probs.length;
    const bestProb = Math.max(...probs);
    const timesteps = Array.from({ length: numSteps }, (_, i) => i + 1);

    const results = {};

    // Run each selected algorithm
    if (algorithms.random) {
        rng.reset();
        const env = new BernoulliBandit(probs);
        const agent = new RandomPolicy(nArms);
        const { rewards, chosenArms } = runBandit(env, agent, numSteps);
        results["Random"] = {
            agent,
            rewards,
            chosenArms,
            color: agent.color
        };
    }

    if (algorithms.ucb) {
        rng.reset();
        const env = new BernoulliBandit(probs);
        const agent = new UCB(nArms, ucbC);
        const { rewards, chosenArms } = runBandit(env, agent, numSteps);
        results["UCB"] = {
            agent,
            rewards,
            chosenArms,
            color: agent.color
        };
    }

    if (algorithms.epsilon) {
        rng.reset();
        const env = new BernoulliBandit(probs);
        const agent = new EpsilonGreedy(nArms, epsilon, epsilonDecay, minEpsilon);
        const { rewards, chosenArms } = runBandit(env, agent, numSteps);
        results["ε-Greedy"] = {
            agent,
            rewards,
            chosenArms,
            color: agent.color
        };
    }

    if (algorithms.thompson) {
        rng.reset();
        const env = new BernoulliBandit(probs);
        const agent = new ThompsonSampling(nArms, priorAlpha, priorBeta);
        const { rewards, chosenArms } = runBandit(env, agent, numSteps);
        results["Thompson"] = {
            agent,
            rewards,
            chosenArms,
            color: agent.color
        };
    }

    // Compute derived metrics for plotting
    const plotData = {};

    for (const [name, data] of Object.entries(results)) {
        const { rewards, chosenArms, agent, color } = data;

        const cumRewards = cumulativeSum(rewards);
        const cumRegret = cumRewards.map((cr, i) => (i + 1) * bestProb - cr);

        let explorationRate = null;
        if (agent.explorationHistory) {
            const flags = agent.explorationHistory.map(x => (x ? 1 : 0));
            const cumExplores = cumulativeSum(flags);
            explorationRate = cumExplores.map((ce, i) => ce / (i + 1));
        }

        const armPulls = bincount(chosenArms, nArms);
        const totalReward = rewards.reduce((a, b) => a + b, 0);

        plotData[name] = {
            timesteps,
            cumRewards,
            cumRegret,
            explorationRate,
            armPulls,
            totalReward,
            color,
            stats: agent.getStats()
        };
    }

    return {
        plotData,
        config: {
            probs,
            numSteps,
            bestProb,
            nArms
        }
    };
}

// Export for use in app.js
window.BanditCore = {
    runSimulation,
    rng,
    BernoulliBandit,
    RandomPolicy,
    UCB,
    EpsilonGreedy,
    ThompsonSampling
};

