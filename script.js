document.addEventListener("DOMContentLoaded", () => {
  let chart;
  const history = [];
  let lastParams = {};

  // Move info message directly next to the run simulation button
  const runBtn = document.getElementById("runSimulation");
  if (runBtn && !document.getElementById("simInfoMsg")) {
    const infoMsg = document.createElement("span");
    infoMsg.id = "simInfoMsg";
    infoMsg.style.marginLeft = "1.2rem";
    infoMsg.style.color = "#a31f34";
    infoMsg.style.fontWeight = "bold";
    infoMsg.style.verticalAlign = "middle";
    infoMsg.textContent =
      "The simulation needs some time to run. The max number of components is 15 and dependencies is 14";
    runBtn.after(infoMsg);
  }

  document.getElementById("runSimulation").addEventListener("click", () => {
    const componentsInput = document.getElementById("components");
    const dependenciesInput = document.getElementById("dependencies");
    const modeInput = document.getElementById("outDegreeMode");
    if (!componentsInput || !dependenciesInput || !modeInput) return;

    let components = parseInt(componentsInput.value);
    let dependencies = parseInt(dependenciesInput.value);
    const mode = modeInput.value;

    // Limit components and dependencies
    if (components > 15) {
      components = 15;
      componentsInput.value = 15;
      alert("Maximum allowed components is 15. Adjusted automatically.");
    }
    if (dependencies > 14) {
      dependencies = 14;
      dependenciesInput.value = 14;
      alert("Maximum allowed dependencies is 14. Adjusted automatically.");
    }

    if (
      isNaN(components) ||
      isNaN(dependencies) ||
      components < 2 ||
      dependencies < 1
    ) {
      alert("Please enter valid numbers for components and dependencies.");
      return;
    }
    // Defensive: dependencies cannot exceed components-1
    if (dependencies > components - 1) {
      dependencies = components - 1;
      dependenciesInput.value = dependencies;
      alert(
        "Dependencies cannot exceed components minus one (no self-dependency). Adjusted automatically."
      );
    }

    // Reset chart/history if parameters change
    const paramsChanged =
      lastParams.components !== components ||
      lastParams.dependencies !== dependencies ||
      lastParams.mode !== mode;
    if (paramsChanged) {
      history.length = 0;
      if (chart) {
        chart.destroy();
        chart = null;
      }
      lastParams = { components, dependencies, mode };
    }

    // Always use the same number of simulation steps for all component counts
    const simSteps = 10000000; // 10 million steps for all component counts
    const DSM = generateDSM(components, dependencies, mode);
    renderDSM(DSM);

    const simSeries = runSimulation(DSM, simSteps, dependencies, DSM);

    history.push(simSeries);

    // Keep only the last 3 runs
    if (history.length > 3) {
      history.length = 0;
      if (chart) {
        chart.destroy();
        chart = null;
      }
      // Optionally clear DSM and chart area
      const dsmDiv = document.getElementById("dsm");
      if (dsmDiv) dsmDiv.innerHTML = "";
      const ctx = document.getElementById("costChart");
      if (ctx) {
        ctx.getContext("2d").clearRect(0, 0, ctx.width, ctx.height);
      }
      // Reset input fields
      document.getElementById("components").value = "";
      document.getElementById("dependencies").value = "";
      alert(
        "Simulation limit reached. Please enter new values for components and dependencies to start again."
      );
      return;
    }
    updateChart(history, dependencies, components, DSM, simSteps);
  });

  function generateDSM(n, d, mode) {
    // Defensive: d cannot be more than n-1
    d = Math.min(d, n - 1);
    const DSM = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      DSM[i][i] = 1;
      let outDegree = mode === "fixed" ? d : Math.floor(Math.random() * d) + 1;
      outDegree = Math.min(outDegree, n - 1); // cannot have more than n-1 out-degree
      // Get all possible targets except self
      const possibleTargets = [];
      for (let j = 0; j < n; j++) if (j !== i) possibleTargets.push(j);
      // Shuffle and pick outDegree targets
      for (let k = possibleTargets.length - 1; k > 0; k--) {
        const swap = Math.floor(Math.random() * (k + 1));
        [possibleTargets[k], possibleTargets[swap]] = [
          possibleTargets[swap],
          possibleTargets[k],
        ];
      }
      for (let k = 0; k < outDegree; k++) {
        DSM[i][possibleTargets[k]] = 1;
      }
    }
    return DSM;
  }

  function renderDSM(DSM) {
    const container = document.getElementById("dsm");
    if (!container) return;
    container.innerHTML = "";
    // Set a CSS variable for responsive cell sizing
    container.style.setProperty("--dsm-size", DSM.length);
    const table = document.createElement("table");
    DSM.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((cell) => {
        const td = document.createElement("td");
        td.style.backgroundColor = cell ? "#a31f34" : "#fff"; // MIT red
        td.style.border = "1px solid #ccc";
        // Remove fixed width/height here, CSS will handle it
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    container.appendChild(table);
  }

  function runSimulation(DSM, steps, dependencies, fullDSM) {
    // Always use the same number of steps for all component/dependency counts
    const n = DSM.length;
    let costs = Array(n).fill(1 / n);
    const totalCosts = [];
    // Calculate average out-degree from DSM for correlation
    let avgOutDegree = 0;
    if (Array.isArray(fullDSM) && fullDSM.length > 0) {
      avgOutDegree =
        fullDSM.reduce(
          (sum, row) => sum + row.reduce((a, b) => a + b, 0) - 1,
          0
        ) / fullDSM.length;
    }
    // For all dependency counts, keep the exponent in a reasonable range
    // This ensures the curve shape is consistent for both low and high dependencies
    let minExp = 1.02;
    let maxExp = 7.0;
    // Remove the extra convexity boost for low dependencies
    // Always use the same exponent mapping for all cases
    let exponent = maxExp - ((avgOutDegree - 1) / (n - 2)) * (maxExp - minExp);
    exponent = Math.max(minExp, Math.min(maxExp, exponent));

    // No artificial flattening, let the simulation run its course
    for (let t = 0; t < steps; t++) {
      const i = Math.floor(Math.random() * n);
      const row = DSM[i];
      if (!row) {
        totalCosts.push(costs.reduce((sum, c) => sum + c, 0));
        continue;
      }
      const A_i = row.map((val, j) => (val ? j : -1)).filter((j) => j !== -1);

      if (A_i.length === 0) {
        totalCosts.push(costs.reduce((sum, c) => sum + c, 0));
        continue;
      }

      const newCosts = [...costs];
      let newTotal = 0;
      for (let idx = 0; idx < A_i.length; idx++) {
        const j = A_i[idx];
        let rand = Math.random();
        if (!isFinite(rand) || rand < 1e-8) rand = 1e-8;
        let val = Math.pow(rand, exponent);
        if (!isFinite(val) || val < 1e-8) val = 1e-4;
        newCosts[j] = val;
        newTotal += newCosts[j];
      }
      const currentTotal = A_i.reduce((sum, j) => sum + costs[j], 0);
      if (
        isFinite(newTotal) &&
        isFinite(currentTotal) &&
        newTotal < currentTotal &&
        !isNaN(newTotal) &&
        !isNaN(currentTotal)
      ) {
        for (let idx = 0; idx < A_i.length; idx++) {
          const j = A_i[idx];
          costs[j] = newCosts[j];
        }
      }
      let total = costs.reduce((sum, c) => sum + (isFinite(c) ? c : 0), 0);
      if (!isFinite(total) || total < 1e-8) total = 1e-4;
      totalCosts.push(total);
    }
    return totalCosts;
  }

  function updateChart(
    history,
    dependencies,
    components,
    DSM,
    simSteps = 10000000
  ) {
    const colors = ["#a31f34", "#8a8b8c", "#d3d3d4"];
    const displaySteps = Math.min(200, 70 + dependencies * 10);
    const minX = 1;
    const maxX = 1e10; // Always show up to 10^10
    const yMin = 1e-4;

    // Calculate average out-degree for info
    let avgOutDegree = 0;
    if (Array.isArray(DSM) && DSM.length > 0) {
      avgOutDegree =
        DSM.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0) - 1, 0) /
        DSM.length;
    }

    // Dynamically determine yMax based on all simulation data
    let maxYValue = 0;
    for (const series of history) {
      for (const val of series) {
        if (isFinite(val) && val > maxYValue) maxYValue = val;
      }
    }
    let yMax = 1;
    if (maxYValue > 1) {
      const upperLimit = 1e6; // limit very high y-axis values
      yMax = Math.min(
        Math.pow(10, Math.ceil(Math.log10(maxYValue))),
        upperLimit
      );
    }

    // Interpolate so first point is at minX, last at maxX, compressing to displaySteps
    // If x > simSteps, use the last value (flat line to the end)
    function interpolate(series, steps) {
      const result = [];
      const n = series.length;
      // Only stretch the *end* of the series, not the beginning.
      // Map the simulation steps to the left part of the x axis, then flat to the right.
      // Find the step where sim data ends in the x axis
      let simEndStep = steps;
      for (let i = 0; i < steps; i++) {
        const logMin = Math.log10(minX);
        const logMax = Math.log10(maxX);
        const logX = logMin + ((logMax - logMin) * i) / (steps - 1);
        const x = Math.pow(10, logX);
        if (x >= simSteps) {
          simEndStep = i;
          break;
        }
      }
      // First: interpolate simulation data up to simSteps
      for (let i = 0; i < simEndStep; i++) {
        const logMin = Math.log10(minX);
        const logMax = Math.log10(maxX);
        const logX = logMin + ((logMax - logMin) * i) / (steps - 1);
        const x = Math.pow(10, logX);

        // Map x to the original series index, stretching/shrinking to fill [minX, simSteps]
        const pos = ((x - minX) / (simSteps - minX)) * (n - 1);
        const idx = Math.floor(pos);
        const frac = pos - idx;
        let y;
        if (idx + 1 < n) {
          y = series[idx] * (1 - frac) + series[idx + 1] * frac;
        } else {
          y = series[n - 1];
        }
        y = Math.max(Math.min(y, yMax), yMin);
        result.push({ x, y });
      }
      // Then: flat line from simSteps to maxX
      const lastY = series[n - 1];
      for (let i = simEndStep; i < steps; i++) {
        const logMin = Math.log10(minX);
        const logMax = Math.log10(maxX);
        const logX = logMin + ((logMax - logMin) * i) / (steps - 1);
        const x = Math.pow(10, logX);
        result.push({ x, y: Math.max(Math.min(lastY, yMax), yMin) });
      }
      // Ensure the last point is exactly at maxX
      if (result.length === 0 || result[result.length - 1].x < maxX) {
        result.push({ x: maxX, y: Math.max(Math.min(lastY, yMax), yMin) });
      }
      return result;
    }

    const datasets = history.slice(-3).map((series, idx) => ({
      label: `Run ${history.length - history.slice(-3).length + idx + 1}`,
      type: "line",
      data: interpolate(series, displaySteps),
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length],
      fill: false,
      tension: 0,
      pointRadius: 3,
      pointStyle: "circle",
      borderWidth: 2,
      showLine: true,
      order: 1,
    }));

    const ctx = document.getElementById("costChart").getContext("2d");
    if (!ctx) return;

    // Calculate grid size so that squares are always square in log-log space and responsive
    function getSquareGridSize() {
      // Get chart container size in pixels
      const chartContainer = document.getElementById("costChart");
      if (!chartContainer) return 6;
      const width = chartContainer.offsetWidth || 600;
      const height = chartContainer.offsetHeight || 300;
      // log scale ranges
      const logXRange = Math.log10(maxX) - Math.log10(minX);
      const logYRange = Math.log10(yMax) - Math.log10(yMin);
      // Find the number of squares so that (width/gridSizeX)/(height/gridSizeY) = logXRange/logYRange
      // We want gridSizeX/logXRange == gridSizeY/logYRange
      // Let gridSize = min(gridSizeX, gridSizeY)
      // Try to keep gridSize between 5 and 10 for visibility
      const ratio = width / logXRange / (height / logYRange);
      let gridSize = Math.round(
        Math.min(10, Math.max(5, Math.min(logXRange, logYRange) * 2))
      );
      return gridSize;
    }

    // Always use a fixed grid size for perfect squares, e.g., 8x8
    const gridSize = 8;
    const logXRange = Math.log10(maxX) - Math.log10(minX);
    const logYRange = Math.log10(yMax) - Math.log10(yMin);
    // Use the same log step for both axes so squares are always square in log-log space
    const logStep = Math.min(logXRange, logYRange) / gridSize;
    const gridSquares = [];

    // Chart subtitle/info
    const infoText = `Components: ${components}, Dependencies: ${dependencies}, Avg. Out-degree: ${avgOutDegree.toFixed(
      2
    )}`;

    if (!chart) {
      chart = new Chart(ctx, {
        type: "line",
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          aspectRatio: 0.5,
          parsing: false,
          plugins: {
            legend: { display: true },
            tooltip: { enabled: true },
            annotation: {
              annotations: gridSquares,
            },
            subtitle: {
              display: true,
              text: infoText,
              font: { size: 14 },
            },
          },
          layout: { padding: 10 },
          scales: {
            x: {
              type: "logarithmic",
              base: 10,
              min: minX,
              max: maxX,
              title: {
                display: true,
                text: "# of Improvements Attempts",
                font: { size: 16 },
              },
              grid: { display: false },
              ticks: {
                callback: (val) => {
                  const log = Math.log10(val);
                  // Show 10^0 ... 10^10
                  if (Number.isInteger(log) && log >= 0 && log <= 10)
                    return `10^${log}`;
                  return "";
                },
                font: { size: 13 },
              },
            },
            y: {
              type: "logarithmic",
              base: 10,
              min: yMin,
              max: yMax,
              title: { display: true, text: "Cost", font: { size: 16 } },
              grid: { display: false },
              ticks: {
                callback: (val) => {
                  const log = Math.log10(val);
                  if (Number.isInteger(log)) return `10^${log}`;
                  return "";
                },
                font: { size: 13 },
              },
            },
          },
          elements: {
            line: { borderWidth: 2 },
            point: { radius: 3 },
          },
        },
      });
    } else {
      chart.data.datasets = datasets;
      chart.options.plugins.annotation.annotations = gridSquares;
      chart.options.plugins.subtitle.text = infoText;
      chart.options.scales.x.type = "logarithmic";
      chart.options.scales.x.min = minX;
      chart.options.scales.x.max = maxX;
      chart.options.scales.y.type = "logarithmic";
      chart.options.scales.y.min = yMin;
      chart.options.scales.y.max = yMax;
      chart.update();
    }
  } // <-- this closing brace was missing or misplaced
});
