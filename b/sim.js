// Renders the simulator mockup's states into sim.html. window.MOCK_DIRECTION ("A" or "B") picks
// the distribution chart: A stacks two histograms, B plots each run against its G draw.
(function () {
  const { states, gallery, L } = window.MockStates;
  const DATA = window.MockChartData;
  const DIR = window.MOCK_DIRECTION;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const KW = /\b(let|in|if|then|else|rec|fun|match|with|true|false)\b/g;
  let current;

  function hl(line, reasons) {
    let s = esc(line);
    s = s.replace(/\b(\d+(?:\.\d+)?)\b/g, "\u0001$1\u0002");
    s = s.replace(KW, '<span class="kw">$1</span>');
    s = s.replace(/\u0001([^\u0002]*)\u0002/g, '<span class="num">$1</span>');
    const tip = (m) =>
      reasons?.[m] ??
      (m === "E"
        ? "E: replaced by its mean. The output depends on this draw affinely."
        : "G: kept random. The output depends on this draw non-affinely.");
    s = s.replace(
      /\{([EG])\}/g,
      (_, m) => `<span class="hint mode-${m.toLowerCase()}" title="${tip(m)}" aria-label="mode ${m}, inferred">[${m}]</span>`,
    );
    s = s.replace(/\[([EG])\]/g, (_, m) => `<span class="mark mode-${m.toLowerCase()}" title="${tip(m)}">[${m}]</span>`);
    s = s.replace(/\b(mean_[a-z]+)\b/g, '<span class="mean-call">$1</span>');
    return s || "&#8203;";
  }

  function codeBlock(lines, o = {}) {
    const rows = lines
      .map((l, i) => {
        const linked = o.span && i >= o.span[0] && i <= o.span[1] ? " linked" : "";
        let text = hl(l, o.reasons);
        if (o.diag && o.diag.line === i + 1) text = `<span class="diag-span">${text}</span>`;
        return `<div class="cl${linked}"><span class="ln" aria-hidden="true">${i + 1}</span><span class="lc">${text}</span></div>`;
      })
      .join("");
    return `<div class="code" role="textbox" aria-multiline="true"${o.readonly ? ' aria-readonly="true"' : ""} aria-label="${o.label}" tabindex="0">${rows}</div>`;
  }

  const inlineCode = (text) =>
    text
      .split("\n")
      .map((l) => `<span class="sl">${hl(l)}</span>`)
      .join("");

  function header(st) {
    return `
    <header class="sim-header">
      <div class="title-group"><h1>Determinize simulator</h1><a class="home" href="./">Project page</a></div>
      <button class="example-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="gallery" id="example-button">Example: <span class="eb-title">${st.title}</span></button>
      <div class="sim-tools">
        <button type="button" id="copy-link">Copy link</button>
        <button type="button" id="glossary-button" aria-controls="glossary" aria-expanded="false">Glossary</button>
        <label class="theme">Theme <select id="theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
      </div>
    </header>`;
  }

  function galleryPanel(id) {
    const items = gallery
      .map(([gid, t, line, origin, rej]) => {
        const href = states[gid] ? `#${gid}` : "#noisy-product";
        const note = rej ? " Lean rejects this program." : "";
        return `<li${gid === id ? ' aria-current="true"' : ""}><a href="${href}">${t}</a> <span class="g-l">${line}${note}</span>${origin ? ' <span class="g-o">From the paper.</span>' : ""}</li>`;
      })
      .join("");
    return `<div class="gallery" id="gallery" role="dialog" aria-label="Examples" hidden><ol>${items}</ol><p class="g-note">Each example is a link you can share.</p></div>`;
  }

  function glossaryPanel() {
    return `<div class="glossary" id="glossary" hidden><dl>
      <div><dt>Mode</dt><dd>Whether a draw is kept random or replaced by its mean; affinity in the Lean development (<a href="${L.affinity}">Affinity</a>).</dd></div>
      <div><dt>E</dt><dd>Replaced by its mean in the determinized program.</dd></div>
      <div><dt>G</dt><dd>Kept random; in one run, both programs draw the same value.</dd></div>
      <div><dt>Sample site</dt><dd>A place in the program that draws from a distribution.</dd></div>
      <div><dt>G trace</dt><dd>The values of a run's G draws, in order (<a href="${L.traces}">trace semantics</a>).</dd></div>
      <div><dt>Returned, rejected, failed</dt><dd>A run returns a value, is rejected by <code>observe</code>, or fails: division by zero, a parameter outside a distribution's domain, or the step limit.</dd></div>
      <div><dt>Variance-reduction factor</dt><dd>The source's variance divided by the determinized program's, over returned runs.</dd></div>
    </dl></div>`;
  }

  function intro(st) {
    if (!st.intro) return "";
    return `<section class="intro" aria-label="Introduction"><p>Left is your program; right is what determinization makes of it. Draws marked E are replaced by their means. Draws marked G are kept random, and in each run both programs draw the same values for them. Step through one run below, or run both programs many times and compare their outputs.</p><button type="button" class="quiet">Hide</button></section>`;
  }

  function programs(st) {
    const diag = st.diagnostic;
    const span = st.steps ? st.steps.find((s) => s.current)?.span : null;
    const srcFoot = st.sourceFooter
      ? `<p class="pane-foot">${st.sourceFooter.checked ? `<span><a href="${L.typed}" title="Typed, in the Lean development">Checked</a>: <code>${st.sourceFooter.checked}</code></span>` : ""}<span>Sample sites: ${st.sourceFooter.sites}</span></p>`
      : "";
    const diagBlock = diag
      ? `<div class="alert" role="status"><p><strong>Lean rejects this program</strong> at ${diag.stage}: <code>${diag.text}</code>.</p><p>Line ${diag.line}: ${diag.detail}</p></div>`
      : "";
    const source =
      st.source.length === 0
        ? `<div class="code" role="textbox" aria-multiline="true" aria-label="Source program" tabindex="0"><div class="cl"><span class="ln" aria-hidden="true">1</span><span class="lc placeholder">Write a program, or pick an example.</span></div></div>`
        : codeBlock(st.source, { label: "Source program", diag, span, reasons: st.reasons });
    let det;
    if (st.det === null) det = `<p class="pane-empty">${st.detMessage}</p>`;
    else
      det =
        (st.counterexample
          ? `<div class="alert counter-label"><p>Lean rejects this program; this is what replacing its [E] draws anyway does.</p></div>`
          : "") +
        codeBlock(st.det, { label: st.counterexample ? "Counterexample program" : "Determinized program", readonly: true, span }) +
        (st.detFooter ? `<p class="pane-foot"><span>Sample sites: ${st.detFooter.sites}</span></p>` : "");
    const annotated = st.sourceFooter?.checked
      ? `<details class="annotated"><summary>Annotated source</summary>${codeBlock(
          st.source.map((l) => l.replace(/\{([EG])\}/g, "[$1]").replace("gaussian[", "gauss[")),
          { label: "Annotated source", readonly: true },
        )}</details>`
      : "";
    return `
    <section class="band programs" aria-label="Programs">
      <div class="pane pane-source">
        <h2 class="pane-title t-source">Source</h2>
        ${source}${diagBlock}${srcFoot}${annotated}
      </div>
      <div class="pane pane-det${st.counterexample ? " counter" : ""}">
        <h2 class="pane-title t-det">${st.counterexample ? "Replacing the [E] draws anyway" : "Determinized"}</h2>
        ${det}
      </div>
    </section>`;
  }

  function steps(st) {
    if (!st.steps)
      return `<section class="band steps" aria-labelledby="steps-h"><div class="band-head"><h2 id="steps-h" class="band-title">Steps of one run</h2></div><p class="band-empty">${st.stepsMessage}</p></section>`;
    const total = st.steps.length - 1;
    const sym = !!st.symbolic;
    const right = st.counterexample ? "Counterexample" : "Determinized";
    const rows = st.steps
      .map((s) => {
        const draw = s.draw
          ? `<span class="draw" title="${s.draw.name} = ${s.draw.full}"><code>${s.draw.name} ← ${s.draw.value}</code><span class="draw-d">${s.draw.dist}</span></span>`
          : "";
        const note = (t, cls) => (t ? `<span class="step-note ${cls}">${t}</span>` : "");
        return `<li class="step${s.outcome ? ` outcome-${s.outcome}` : ""}${s.draw ? " has-draw" : ""}"${s.current ? ' aria-current="step"' : ""}>
          <span class="step-n">${s.n}</span>
          <div class="cell cell-source"><span class="cell-label">Source</span><code class="state">${inlineCode(s.src)}</code>${note(s.srcNote, "n-e")}</div>
          <div class="cell cell-draw">${draw ? `<span class="cell-label">G draw</span>${draw}` : ""}</div>
          ${sym ? `<div class="cell cell-sym"><span class="cell-label">Symbolic state</span><code class="state">${inlineCode(s.sym ?? "")}</code>${note(s.symNote, "n-sym")}</div>` : ""}
          <div class="cell cell-det"><span class="cell-label">${right}</span><code class="state">${inlineCode(s.det)}</code>${note(s.detNote, "n-mean")}</div>
        </li>`;
      })
      .join("");
    return `
    <section class="band steps${sym ? " with-sym" : ""}" aria-labelledby="steps-h">
      <div class="band-head">
        <h2 id="steps-h" class="band-title">Steps of one run</h2>
        <div class="step-controls" role="group" aria-label="Step through the run">
          <button type="button">First</button><button type="button">Back</button><button type="button">Step</button><button type="button">Last</button><button type="button" class="play">Play</button>
          <label class="scrub"><span class="vh">Step</span><input type="range" min="0" max="${total}" value="${st.step}" id="scrubber"></label>
          <output for="scrubber" class="step-of">Step ${st.step} of ${total}</output>
        </div>
        <div class="run-controls">
          <label class="seed">Seed <input type="text" inputmode="numeric" value="1" size="5" id="seed"></label>
          <button type="button">New seed</button>
          <label class="check"><input type="checkbox" id="show-symbolic"${sym ? " checked" : ""}> Show symbolic state</label>
        </div>
      </div>
      ${sym ? `<p class="sym-note">Symbolic state: the proof's symbolic semantics (paper, section 5), computed by the simulator; it is not part of the Lean pipeline. <a href="${L.symbolic}">Its definitions in Lean</a>.</p>` : ""}
      <div class="step-head" aria-hidden="true"><span></span><span>Source</span><span>G draw</span>${sym ? "<span>Symbolic state</span>" : ""}<span>${right}</span></div>
      <ol class="step-list">${rows}</ol>
      <p class="gtrace"><a href="${L.traces}" title="Trace semantics, in the Lean development">G trace</a> of this run: <code>${st.gtrace}</code></p>
    </section>`;
  }

  function statsTable(d) {
    const right = d.counter ? "Counterexample" : "Determinized";
    const link = (href, t, title) => `<a href="${href}" title="${title}">${t}</a>`;
    const ret = (s) =>
      `${s.returned} of ${s.runs}${s.rejected !== "0" ? `<br><span class="sub">${s.rejected} rejected by observe</span>` : ""}${s.failed !== "0" ? `<br><span class="sub">${s.failed} failed</span>` : ""}`;
    return `<table class="stats">
      <thead><tr><td></td><th scope="col" class="t-source">Source</th><th scope="col" class="t-det">${right}</th></tr></thead>
      <tbody>
        <tr><th scope="row">${link(L.returnedExpectation, "Mean", "returnedExpectation, in the Lean development")}</th><td>${d.source.mean}</td><td>${d.det.mean}</td></tr>
        <tr><th scope="row">95 % ±</th><td>${d.source.ci}</td><td>${d.det.ci}</td></tr>
        <tr><th scope="row">${link(L.returnedVariance, "Variance", "returnedVariance, in the Lean development (population variance)")}</th><td>${d.source.variance}</td><td>${d.det.variance}</td></tr>
        <tr><th scope="row">${link(L.returnProbability, "Returned", "returnProbability, in the Lean development")}</th><td>${ret(d.source)}</td><td>${ret(d.det)}</td></tr>
      </tbody></table>`;
  }

  function premises(kind) {
    if (!kind) return "";
    if (kind.startsWith("other:"))
      return `<div class="premises"><h3>When the theorems apply</h3><p>No theorem applies to this output. Its type is <code>${kind.slice(6)}</code>, not <code>float[E]</code>; the theorems are about programs of type <a href="${L.typed}">float[E]</a>.</p></div>`;
    return `<div class="premises"><h3>When the theorems apply</h3><ul>
      <li>Type <code>float[E]</code>: checked. <a href="${L.typed}">Typed</a></li>
      <li>Domain safety: not established by typing. <a href="${L.domainSafe}">DomainSafe</a></li>
      <li>Integrability (a positive return probability, a defined expectation, a finite second moment): not established by typing. <a href="${L.expectation}">expectation_preservation</a>, <a href="${L.variance}">variance_non_increase</a></li>
    </ul></div>`;
  }

  function chartWidth() {
    const main = document.querySelector("main.sim") ?? document.body;
    const w = Math.min(main.clientWidth || window.innerWidth, 1440) - 32;
    const side = w >= 1100 ? 24 * 16 + 48 : 0;
    return Math.max(300, Math.min(900, w - side));
  }

  function chart(d) {
    const data = DATA[d.hist];
    const scale = d.scale ?? 1;
    const sc = (h) => ({ ...h, counts: h.counts.map((c) => Math.round(c * scale)) });
    const det = d.counter ? data.counterexample : data.det;
    const right = d.counter ? "Counterexample" : "Determinized";
    if (DIR === "B" && data.pairs && !d.counter) {
      const pairs = d.counter ? data.pairs.map(([x, s]) => [x, s, 0.25]) : data.pairs;
      const n = Math.round(pairs.length * scale);
      return `<figure class="chart-fig">${MockCharts.conditional({
        pairs: pairs.slice(0, n),
        xRange: [0, d.hist === "observe" ? 0.8 : 1],
        xTicks: d.hist === "observe" ? [0, 0.4, 0.8] : [0, 0.5, 1],
        yRange: [data.source.lo, data.source.hi],
        xLabel: d.counter ? "x, an E draw (the program has no G draw)" : "x, the G draw on line 1",
        yLabel: "output",
        srcHist: sc(data.source),
        detHist: sc(det),
        width: chartWidth(),
        height: Math.round(Math.min(380, Math.max(280, chartWidth() * 0.5))),
        id: "cp",
        title: `Each run's output against x: open circles for the source, filled points for the ${right.toLowerCase()} program.`,
      })}<figcaption><span class="key key-source" aria-hidden="true"></span>Source runs <span class="key key-det" aria-hidden="true"></span>${right} runs, 320 of ${d.source.runs} shown. ${d.counter ? "The counterexample returns 0.25 in every run." : "Each filled point is the source's mean output given its x."} Along the right: all runs, per bin.</figcaption></figure>`;
    }
    return `<figure class="chart-fig">${MockCharts.stacked({
      source: sc(data.source),
      det: sc(det),
      sourceMean: d.source.meanValue,
      detMean: d.det.meanValue,
      labels: ["Source", right],
      sourceMeanLabel: d.source.mean,
      detMeanLabel: d.det.mean,
      width: chartWidth(),
      id: "hs",
      title: `Histograms of the returned values, source above and ${right.toLowerCase()} below, on one axis.`,
    })}<figcaption>Runs per bin of width ${((data.source.hi - data.source.lo) / data.source.bins).toFixed(1)}, on the same axes. A triangle marks each mean.</figcaption></figure>`;
  }

  function dist(st) {
    const d = st.dist;
    const honesty = `<p class="honesty">These are estimates from this browser simulator, which is not verified. The Lean command-line tool and its theorems are the checked artefacts.${d.reproduce ? ` Reproduce them with <code class="cmd">${d.reproduce}</code>` : ""}</p>`;
    const head = `<div class="band-head"><h2 class="band-title" id="dist-h">Distributions</h2><div class="run-controls"><label class="runs">Runs <select id="runs"><option>1 000</option><option selected>10 000</option><option>100 000</option></select></label><button type="button" class="primary">Run both</button></div></div>`;
    if (d.empty)
      return `<section class="band dist" aria-labelledby="dist-h">${d.runButton ? head : head.replace('class="primary"', 'class="primary" disabled')}<p class="band-empty">${d.empty}</p></section>`;
    if (d.predict)
      return `<section class="band dist" aria-labelledby="dist-h">${head}
        <form class="predict" onsubmit="return false">
          <p>Before you run them: what will 10 000 runs of each program show?</p>
          <fieldset><legend>The determinized program's mean is</legend><label><input type="radio" name="pm"> the same as the source's</label><label><input type="radio" name="pm"> different</label></fieldset>
          <fieldset><legend>Its variance is</legend><label><input type="radio" name="pv"> smaller</label><label><input type="radio" name="pv"> the same</label><label><input type="radio" name="pv"> larger</label></fieldset>
          <button type="button" class="primary">Run both and compare</button>
        </form></section>`;
    if (d.list)
      return `<section class="band dist" aria-labelledby="dist-h">${head}${honesty}
        <div class="list-out"><div><h3 class="t-source">Source</h3><p>The output is a list, so there is no histogram. The first run returned</p><code class="block">${d.sourceFirst}</code><p class="sub">10 000 of 10 000 runs returned.</p></div>
        <div><h3 class="t-det">Determinized</h3><p>Every run returns</p><code class="block">${d.detFirst}</code><p class="sub">10 000 of 10 000 runs returned.</p></div></div>${premises(d.premises)}</section>`;
    const progress = d.progress
      ? `<div class="progress" role="status"><span>Sampling: ${MockCharts.thin(d.progress.done)} of ${MockCharts.thin(d.progress.total)} runs</span><progress max="${d.progress.total}" value="${d.progress.done}"></progress><button type="button">Stop</button></div>`
      : "";
    const factor = d.counter
      ? `<p class="factor">Means differ: ${d.source.mean} and ${d.det.mean}.</p>`
      : `<p class="factor">Variance-reduction factor <strong>${d.vrf}</strong></p>`;
    const exact = d.exact
      ? `<section class="exact" aria-labelledby="exact-h">
          <h3 id="exact-h">Exact values</h3>
          <p class="exact-sub">From a browser port of Lean's finite-model exploration, which is not verified; Lean's <code>--result</code> is the checked computation. <a href="${L.finite}">Finite models in Lean</a></p>
          <div class="exact-grid">
            <div><h4 class="t-source">Source</h4><p>${d.exact.source}</p></div>
            <div><h4 class="t-det">Determinized</h4><p>Finite: ${d.exact.det.states} states.</p>
              <table class="stats compact"><tbody><tr><th scope="row">Mean</th><td><span class="frac">${d.exact.det.mean}</span> (${d.exact.det.meanDec})</td></tr><tr><th scope="row">Variance</th><td><span class="frac">${d.exact.det.variance}</span> (${d.exact.det.varianceDec})</td></tr><tr><th scope="row">Return probability</th><td>${d.exact.det.mass}</td></tr></tbody></table></div>
          </div></section>`
      : "";
    return `<section class="band dist${d.counter ? " counter" : ""}" aria-labelledby="dist-h">${head}${progress}${honesty}
      <div class="dist-grid">
        ${chart(d)}
        <div class="dist-side">${statsTable(d)}${factor}${d.counter ? "" : premises(d.premises)}</div>
      </div>
      ${exact}
      <details class="as-table"><summary>Show the histograms as a table</summary><p class="sub">Runs per bin of width 0.1, for each program (the full table in the simulator).</p></details>
    </section>`;
  }

  function mockBar(id) {
    const links = Object.entries(states)
      .map(([k, s]) => `<a href="#${k}"${k === id ? ' aria-current="page"' : ""}>${s.label}</a>`)
      .join("");
    return `<nav class="mockbar" aria-label="Mockup states"><span>Mockup, direction ${DIR}. State:</span>${links}<a href="./">Landing page</a></nav>`;
  }

  function render() {
    const id = location.hash.slice(1) in states ? location.hash.slice(1) : "noisy-product";
    current = id;
    const st = states[id];
    $("#app").innerHTML =
      mockBar(id) + header(st) + galleryPanel(id) + glossaryPanel() + `<main class="sim">${intro(st)}${programs(st)}${steps(st)}${dist(st)}</main>`;
    const distBand = document.querySelector(".band.dist");
    if (distBand) distBand.outerHTML = dist(st);
    wire();
  }

  function wire() {
    const toggle = (btn, panel) =>
      $(btn).addEventListener("click", () => {
        const p = $(panel);
        p.hidden = !p.hidden;
        $(btn).setAttribute("aria-expanded", String(!p.hidden));
      });
    toggle("#example-button", "#gallery");
    toggle("#glossary-button", "#glossary");
    const th = $("#theme");
    th.value = document.documentElement.dataset.theme ?? "system";
    th.addEventListener("change", () => {
      if (th.value === "system") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = th.value;
    });
    const sym = $("#show-symbolic");
    if (sym) sym.addEventListener("change", () => (location.hash = sym.checked ? "symbolic" : "noisy-product"));
  }

  window.addEventListener("hashchange", render);
  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 150);
  });
  render();
})();
