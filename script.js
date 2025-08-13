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

  // Smoothing helpers (visual only)

  // =========================

  // CHANGED: geometric mean for positive values

  function geoMean(arr) {
    if (!arr.length) return null;

    const s = arr.reduce((acc, v) => acc + Math.log(v), 0);

    return Math.exp(s / arr.length);
  }

  // CHANGED: log-spaced binning + geometric-mean smoothing

  // binsPerDecade: 12–24 is a good range; smaller => clearer convexity

  function binAndSmooth(series, binsPerDecade = 16) {
    if (!series.length) return [];

    const first = series[0];

    const last = series[series.length - 1];

    const maxX = last.x;

    const decades = Math.max(0, Math.log10(Math.max(1, maxX)));

    const totalBins = Math.max(1, Math.ceil(decades * binsPerDecade));

    // build bin edges in log-space

    const edges = [];

    for (let b = 0; b <= totalBins; b++) {
      edges.push(Math.pow(10, b / binsPerDecade));
    }

    if (edges[0] > 1) edges.unshift(1);

    if (edges[edges.length - 1] < maxX) edges.push(maxX);

    const out = [];

    let idx = 0;

    // always include the first point

    out.push({ x: first.x, y: first.y });

    for (let e = 0; e < edges.length - 1; e++) {
      const left = edges[e];

      const right = edges[e + 1];

      const xs = [];

      const ys = [];

      // advance to left boundary

      while (idx < series.length && series[idx].x < left) idx++;

      const startIdx = idx;

      // collect points in the bin [left, right]

      while (idx < series.length && series[idx].x <= right) {
        xs.push(series[idx].x);

        ys.push(series[idx].y);

        idx++;
      }

      if (ys.length) {
        const gx = geoMean(xs);

        const gy = geoMean(ys);

        if (gx && gy) out.push({ x: gx, y: gy });
      } else {
        // keep continuity if bin has no events

        if (startIdx > 0) {
          const prev = series[startIdx - 1];

          out.push({ x: Math.sqrt(left * right), y: prev.y });
        }
      }
    }

    // ensure last point included

    const lastOut = out[out.length - 1];

    if (!lastOut || lastOut.x !== last.x) out.push({ x: last.x, y: last.y });

    return out;
  }

  function updateChart(history, simSteps) {
    const ctx = document.getElementById("costChart").getContext("2d");

    const colors = ["#A31F34", "#888", "#555", "#ccc"];

    const datasets = history.map((run, idx) => {
      // CHANGED: smooth in log-space so low-D convexity is visible

      const smooth = binAndSmooth(run.data, 16).map((p) => ({
        x: p.x,

        y: Math.max(p.y, 1e-8), // rendering floor only
      }));

      return {
        label: `Run ${idx + 1}: C=${run.components}, D=${run.dependencies}`,

        data: smooth, // CHANGED

        borderColor: colors[idx % colors.length],

        backgroundColor: colors[idx % colors.length],

        fill: false,

        pointRadius: 0, // line only (no dots)

        pointHoverRadius: 0,

        stepped: false, // CHANGED: continuous between bin centers

        tension: 0, // honest straight connectors

        borderWidth: 2, // CHANGED: slightly thicker

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

            max: simSteps,

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

            min: 1e-8, // lower to 1e-12 if you want more depth

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
