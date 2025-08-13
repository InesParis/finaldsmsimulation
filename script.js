// MIT-styled, behavior-corrected DSM Simulation
// Correct log-log convex-to-linear behavior from McNerney et al. (2011)

document.addEventListener("DOMContentLoaded", () => {
  let chart;
  const history = [];

  document.getElementById("runSimulation").addEventListener("click", () => {
    const componentsInput = document.getElementById("components");
    const dependenciesInput = document.getElementById("dependencies");
    const modeInput = document.getElementById("outDegreeMode");

    // Enforce max values
    let components = Math.min(parseInt(componentsInput.value), 15);
    let dependencies = Math.min(parseInt(dependenciesInput.value), 14);
    const mode = modeInput.value;

    // Prevent more dependencies than components-1
    if (dependencies >= components) {
      dependencies = components - 1;
    }
    // Update UI to reflect enforced values
    componentsInput.value = components;
    dependenciesInput.value = dependencies;

    if (
      isNaN(components) ||
      isNaN(dependencies) ||
      components < 2 ||
      dependencies < 1
    ) {
      alert("Enter valid numbers for components and dependencies.");
      return;
    }

    const DSM = generateDSM(components, dependencies, mode);
    renderDSM(DSM);
    const simSteps = 10000000; // Show even longer lines (5,000,000 steps)
    const simSeries = runSimulation(DSM, simSteps);

    history.push({ components, dependencies, data: simSeries });
    updateChart(history, simSteps);
  });

  // Add clear chart functionality
  document.getElementById("clearChart").addEventListener("click", () => {
    history.length = 0;
    if (chart) {
      chart.destroy();
      chart = null;
    }
    // Optionally clear DSM display as well:
    // document.getElementById("dsm").innerHTML = "";
  });

  // Prevent manual input above max/min in the UI
  document.getElementById("components").addEventListener("input", (e) => {
    if (parseInt(e.target.value) > 15) e.target.value = 15;
    if (parseInt(e.target.value) < 2) e.target.value = 2;
    // Adjust dependencies if needed
    const depInput = document.getElementById("dependencies");
    if (parseInt(depInput.value) >= parseInt(e.target.value)) {
      depInput.value = parseInt(e.target.value) - 1;
    }
  });
  document.getElementById("dependencies").addEventListener("input", (e) => {
    if (parseInt(e.target.value) > 14) e.target.value = 14;
    if (parseInt(e.target.value) < 1) e.target.value = 1;
    // Adjust dependencies if needed
    const compInput = document.getElementById("components");
    if (parseInt(e.target.value) >= parseInt(compInput.value)) {
      e.target.value = parseInt(compInput.value) - 1;
    }
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
    let costs = Array(n).fill(1);
    const totalCosts = [];
    let lastTotal = costs.reduce((a, b) => a + b, 0);
    let step = 1;

    // Always start at initial cost
    totalCosts.push(lastTotal);

    for (let t = 1; t <= steps; t++) {
      // Pick a random component i
      const i = Math.floor(Math.random() * n);

      // Count number of dependencies (out-degree, including self)
      const d = DSM[i].reduce((sum, val) => sum + val, 0);

      if (d === 0) continue;

      // For high dependencies, the expected behavior is a diagonal (linear in log-log)
      // McNerney model: new cost = Math.random() ** (1/d)
      // This produces convex for low d, diagonal for high d
      const sampled = Math.max(Math.pow(Math.random(), 1 / (d * 0.98)), 1e-12);

      if (sampled < costs[i]) {
        costs[i] = sampled;
        lastTotal = Math.max(
          costs.reduce((a, b) => a + b, 0),
          1e-6 * n
        );
        totalCosts.push(lastTotal);
        step++;
      }
    }

    // Ensure the last value is included if no improvement at the end
    if (
      totalCosts.length === 1 ||
      totalCosts[totalCosts.length - 1] !== lastTotal
    ) {
      totalCosts.push(lastTotal);
    }

    return totalCosts;
  }

  function updateChart(history, simSteps) {
    const ctx = document.getElementById("costChart").getContext("2d");
    const colors = ["#A31F34", "#888", "#555", "#ccc"];

    const datasets = history.map((run, idx) => {
      // X axis: log steps, only at cost change points
      return {
        label: `Run ${idx + 1}: C=${run.components}, D=${run.dependencies}`,
        data: run.data.map((y, i) => ({
          x: i + 1,
          y: Math.max(y, 1e-4),
        })),
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length],
        fill: false,
        tension: 0,
        pointRadius: 2, // smaller points
        pointHoverRadius: 4,
        stepped: true,
        borderWidth: 1.5, // thinner lines
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
            min: 1,
            max: simSteps, // ensure x axis matches new simSteps
            title: { display: true, text: "# of Improvements Attempts" },
            ticks: {
              callback: function (val) {
                const log = Math.log10(val);
                if (Math.abs(log - Math.round(log)) < 1e-6) {
                  return `10^${Math.round(log)}`;
                }
                return "";
              },
              autoSkip: false,
              font: { size: 14 },
              color: "#333",
              maxTicksLimit: 8,
            },
            grid: {
              display: false,
              drawBorder: true,
            },
            border: {
              display: true,
              color: "#333",
            },
          },
          y: {
            type: "logarithmic",
            min: 1e-12, // allow lines to go further down
            max: 10,
            title: { display: true, text: "Cost" },
            ticks: {
              callback: function (val) {
                const log = Math.log10(val);
                if (Math.abs(log - Math.round(log)) < 1e-6) {
                  return `10^${Math.round(log)}`;
                }
                return "";
              },
              font: { size: 14 },
              padding: 10,
              color: "#333",
              maxTicksLimit: 6,
            },
            grid: {
              display: false,
              drawBorder: true,
            },
            offset: true,
          },
        },
        plugins: {
          legend: { position: "top" },
        },
        elements: {
          line: {
            borderWidth: 1.5, // thinner lines
          },
        },
      },
    });
  }
});
