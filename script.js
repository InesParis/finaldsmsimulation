// MIT-styled, behavior-corrected DSM Simulation
// Correct log-log convex-to-linear behavior from McNerney et al. (2011)

document.addEventListener("DOMContentLoaded", () => {
  let chart;
  const history = [];

  document.getElementById("runSimulation").addEventListener("click", () => {
    const componentsInput = document.getElementById("components");
    const dependenciesInput = document.getElementById("dependencies");
    const modeInput = document.getElementById("outDegreeMode");

    let components = parseInt(componentsInput.value);
    let dependencies = parseInt(dependenciesInput.value);
    const mode = modeInput.value;

    if (
      isNaN(components) ||
      isNaN(dependencies) ||
      components < 2 ||
      dependencies < 1
    ) {
      alert("Enter valid numbers for components and dependencies.");
      return;
    }
    if (dependencies >= components) {
      dependencies = components - 1;
      dependenciesInput.value = dependencies;
    }

    const DSM = generateDSM(components, dependencies, mode);
    renderDSM(DSM);
    const simSteps = 10000;
    const simSeries = runSimulation(DSM, simSteps);

    history.push({ components, dependencies, data: simSeries });
    updateChart(history, simSteps);
  });

  function generateDSM(n, d, mode) {
    const DSM = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      DSM[i][i] = 1;
      let outDegree = mode === "fixed" ? d : Math.floor(Math.random() * d) + 1;
      outDegree = Math.min(outDegree, n - 1);

      const targets = [...Array(n).keys()].filter((j) => j !== i);
      for (let k = targets.length - 1; k > 0; k--) {
        const swap = Math.floor(Math.random() * (k + 1));
        [targets[k], targets[swap]] = [targets[swap], targets[k]];
      }
      for (let k = 0; k < outDegree; k++) {
        DSM[i][targets[k]] = 1;
      }
    }
    return DSM;
  }

  function renderDSM(DSM) {
    const container = document.getElementById("dsm");
    container.innerHTML = "";
    container.style.setProperty("--dsm-size", DSM.length);
    const table = document.createElement("table");
    DSM.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.style.backgroundColor = cell ? "#A31F34" : "#fff";
        td.style.border = "1px solid #ccc";
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    container.appendChild(table);
  }

  function runSimulation(DSM, steps) {
    const n = DSM.length;
    let costs = Array(n).fill(1 - 1e-3); // Start slightly below 1 to avoid y=1
    const totalCosts = [];
    let lastTotal = costs.reduce((a, b) => a + b, 0);

    for (let t = 1; t <= steps; t++) {
      const i = Math.floor(Math.random() * n);
      const A_i = DSM[i]
        .map((val, j) => (val ? j : -1))
        .filter((j) => j !== -1);

      const d = A_i.length;
      if (d === 0) {
        totalCosts.push(lastTotal);
        continue;
      }

      const newCosts = [...costs];
      let newTotal = 0;
      for (let j of A_i) {
        // Use a small epsilon to avoid zero, and convexity for low d
        const sampled = Math.max(Math.pow(Math.random(), Math.max(d, 1)), 1e-6);
        newCosts[j] = sampled;
        newTotal += sampled;
      }

      const oldTotal = A_i.reduce((sum, j) => sum + costs[j], 0);
      if (newTotal < oldTotal) {
        for (let j of A_i) costs[j] = newCosts[j];
        const total = Math.max(
          costs.reduce((a, b) => a + b, 0),
          1e-6 * n
        );
        // Only push if strictly less than last value (no repeats)
        if (total < lastTotal - 1e-9) {
          totalCosts.push(total);
          lastTotal = total;
        }
      }
    }
    // Ensure the first value is always present
    if (totalCosts.length === 0 || totalCosts[0] !== n * (1 - 1e-3)) {
      totalCosts.unshift(n * (1 - 1e-3));
    }
    return totalCosts;
  }

  function updateChart(history, simSteps) {
    const ctx = document.getElementById("costChart").getContext("2d");
    const colors = ["#A31F34", "#888", "#555", "#ccc"];

    const datasets = history.map((run, idx) => {
      const data = run.data.map((y, i) => ({
        x: i + 1,
        y: Math.max(y, 0.001),
      }));
      return {
        label: `Run ${idx + 1}: C=${run.components}, D=${run.dependencies}`,
        data,
        borderColor: colors[idx % colors.length],
        fill: false,
        tension: 0,
        pointRadius: 3,
        pointHoverRadius: 5,
      };
    });

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "logarithmic",
            title: { display: true, text: "Improvement Attempts" },
            // min/max removed for autoscale
            ticks: {
              callback: (val) => `10^${Math.round(Math.log10(val))}`,
            },
          },
          y: {
            type: "logarithmic",
            // min/max removed for autoscale
            title: { display: true, text: "Cost" },
            ticks: {
              callback: (val) => `10^${Math.round(Math.log10(val))}`,
            },
          },
        },
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });
  }
});
