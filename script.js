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

    const simSteps = 10000000; // long runs

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
      // Always count self as a dependency
      DSM[i][i] = 1;
      // Out-degree should be d-1 (excluding self), so total including self is d
      let outDegree =
        mode === "fixed" ? d - 1 : Math.floor(Math.random() * (d - 1)) + 1;
      outDegree = Math.max(0, Math.min(outDegree, n - 1));
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

    const series = []; // {x,y} = {attemptNumber, totalCost}

    let lastTotal = costs.reduce((a, b) => a + b, 0);

    let step = 1;

    // start series at attempt 1 with initial total cost

    series.push({ x: 1, y: lastTotal });

    for (let t = 1; t <= steps; t++) {
      // Pick a random component i

      const i = Math.floor(Math.random() * n);

      // Count number of dependencies (out-degree, including self)

      const d = DSM[i].reduce((sum, val) => sum + val, 0);

      if (d === 0) continue;

      // McNerney model: new cost = Math.random() ** (1/d)

      const sampled = Math.max(Math.pow(Math.random(), 1 / d), 1e-6);

      if (sampled < costs[i]) {
        costs[i] = sampled;

        lastTotal = Math.max(
          costs.reduce((a, b) => a + b, 0),

          1e-6 * n
        );

        series.push({ x: t, y: lastTotal });

        step++;
      }
    }

    // extend last horizontal segment to end of run

    const lastPoint = series[series.length - 1];

    if (!lastPoint || lastPoint.x !== steps) {
      series.push({ x: steps, y: lastTotal });
    }

    return series; // {x,y} points
  }

  // =========================

  // VISUAL HELPERS (no math changes)

  // =========================

  // CHANGED: geometric mean for positive values

  function geoMean(arr) {
    if (!arr.length) return null;

    const s = arr.reduce((acc, v) => acc + Math.log(v), 0);

    return Math.exp(s / arr.length);
  }

  // CHANGED: choose an "interesting" x-extent where ~99% of the total drop has already occurred

  function computeInterestingX(series) {
    const first = series[0];

    const last = series[series.length - 1];

    const y0 = first.y;

    const yN = last.y;

    if (y0 <= 0) return last.x;

    const target = yN + 0.01 * (y0 - yN); // 99% of total drop reached

    let xAtTarget = last.x;

    for (let i = 0; i < series.length; i++) {
      if (series[i].y <= target) {
        xAtTarget = series[i].x;

        break;
      }
    }

    // give some margin to show the tail but avoid plotting the full run

    return Math.max(10, Math.min(last.x, xAtTarget * 2));
  }

  // CHANGED: build multiplicative edges between a..b with k bins/decade

  function buildEdges(a, b, binsPerDecade) {
    const edges = [];

    const start = Math.max(1, a);

    const end = Math.max(start, b);

    const factor = Math.pow(10, 1 / binsPerDecade);

    let cur = start;

    edges.push(start);

    while (cur < end) {
      cur = Math.min(end, cur * factor);

      edges.push(cur);
    }

    return edges;
  }

  // CHANGED: adaptive log-binning (dense early, lighter later) + geometric-mean smoothing

  function adaptiveBinAndSmooth(
    series,
    xMax,
    split = 1e3,
    binsEarly = 30,
    binsLate = 12
  ) {
    if (!series.length) return [];

    // keep only up to xMax

    const clipped = series.filter((p) => p.x <= xMax);

    const first = clipped[0];

    const last = clipped[clipped.length - 1];

    const edges1 = buildEdges(1, Math.min(split, xMax), binsEarly);

    const edges2 = xMax > split ? buildEdges(split, xMax, binsLate) : [];

    const edges = edges1.concat(edges2.slice(1)); // avoid duplicate split

    const out = [{ x: first.x, y: first.y }];

    let idx = 0;

    for (let e = 0; e < edges.length - 1; e++) {
      const left = edges[e];

      const right = edges[e + 1];

      const xs = [];

      const ys = [];

      while (idx < clipped.length && clipped[idx].x < left) idx++;

      const startIdx = idx;

      while (idx < clipped.length && clipped[idx].x <= right) {
        xs.push(clipped[idx].x);

        ys.push(clipped[idx].y);

        idx++;
      }

      if (ys.length) {
        const gx = geoMean(xs);

        const gy = geoMean(ys);

        if (gx && gy) out.push({ x: gx, y: gy });
      } else if (startIdx > 0) {
        // keep continuity across empty bins

        const prev = clipped[startIdx - 1];

        out.push({ x: Math.sqrt(left * right), y: prev.y });
      }
    }

    if (out[out.length - 1].x !== last.x) out.push({ x: last.x, y: last.y });

    return out;
  }

  function updateChart(history, simSteps) {
    const ctx = document.getElementById("costChart").getContext("2d");
    const colors = ["#A31F34", "#888", "#555", "#ccc"];

    // Compute interesting y-min for all runs (e.g., 1% above the lowest value)
    let minY = 1e-8;
    let maxY = 10;
    if (history.length) {
      const allY = history.flatMap((run) =>
        run.data.map((p) => (p.y !== undefined ? p.y : p))
      );
      const minVal = Math.min(...allY);
      const maxVal = Math.max(...allY);
      minY = Math.max(1e-8, minVal * 0.8); // 20% below min
      maxY = Math.min(10, maxVal * 1.1); // 10% above max
      if (minY === maxY) {
        minY = Math.max(1e-8, minY * 0.5);
        maxY = maxY * 2;
      }
    }

    // CHANGED: decide an x-limit that shows the “interesting” part for each run,

    // then use the largest of those so all series fit.

    const xLimits = history.map((run) => computeInterestingX(run.data));
    const xMaxForChart = Math.min(simSteps, Math.max(...xLimits));
    const datasets = history.map((run, idx) => {
      const smooth = adaptiveBinAndSmooth(
        run.data,
        xMaxForChart,
        1e3,
        30,
        12
      ).map((p) => ({
        x: p.x,
        y: Math.max(p.y, 1e-8),
      }));
      return {
        label: `Run ${idx + 1}: C=${run.components}, D=${run.dependencies}`,
        data: smooth,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length],
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 0,
        stepped: false,
        tension: 0,
        borderWidth: 2,
        parsing: false,
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
            max: xMaxForChart,
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
            grid: { display: false, drawBorder: true },
            border: { display: true, color: "#333" },
          },
          y: {
            type: "logarithmic",
            min: minY,
            max: maxY,
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
            grid: { display: false, drawBorder: true },
            offset: true,
          },
        },
        plugins: {
          legend: { position: "top" },
        },
        elements: {
          line: { borderWidth: 2 },
        },
      },
    });
  }
});
