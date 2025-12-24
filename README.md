# Bandit Lab

Bandit Lab is a web-based simulator that visualizes how different bandit algorithms tackle the exploration-exploitation tradeoff. 

## Algorithms

- **Random** - Baseline: selects arms uniformly at random
- **UCB** - Upper Confidence Bound: balances exploration and exploitation by selecting arms with the highest estimated reward plus an uncertainty bonus
- **ε-Greedy** - Explores randomly with probability ε, otherwise exploits
- **Thompson Sampling** - Bayesian approach using Beta distribution sampling