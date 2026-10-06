// Chart renderers for the mockups. Each returns SVG markup as a string, so the landing pages can
// embed the result statically and the simulator mockup can render it at runtime. Colours come
// from the tokens: --ink (source outline in A), --muted, --change, --change-fill, --given.
(function (root) {
  const f2 = (v) => v.toFixed(2);
  const minus = (s) => String(s).replace("-", "−");
  const thin = (n) => n.toLocaleString("en-US").replace(/,/g, " ");

  // Two histograms on one x axis, source above (outline) and determinized below (filled).
  function stacked(o) {
    const W = o.width ?? 640;
    const rowH = o.rowHeight ?? 92;
    const gap = 26;
    const padL = 8;
    const padR = 8;
    const padT = 20;
    const axisH = 26;
    const H = padT + rowH * 2 + gap + axisH;
    const h = o.source;
    const pw = W - padL - padR;
    const bw = pw / h.bins;
    const x = (v) => padL + ((v - h.lo) / (h.hi - h.lo)) * pw;
    const peak = Math.max(...o.source.counts);
    const yMax = o.yMax ?? Math.ceil(peak * 1.12);
    const id = o.id ?? "c";
    const parts = [
      `<svg class="chart stacked" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t" preserveAspectRatio="xMidYMid meet">`,
      `<title id="${id}-t">${o.title ?? ""}</title>`,
    ];
    const rows = [
      { hist: o.source, kind: "source", top: padT, label: o.labels?.[0] ?? "Source", mean: o.sourceMean, meanLabel: o.sourceMeanLabel },
      { hist: o.det, kind: "det", top: padT + rowH + gap, label: o.labels?.[1] ?? "Determinized", mean: o.detMean, meanLabel: o.detMeanLabel },
    ];
    // a reference line at a round count, the same in both rows
    const ref = [100, 200, 500, 1000, 2000, 5000].filter((r) => r <= yMax * 0.8).pop() ?? yMax;
    for (const r of rows) {
      const base = r.top + rowH;
      const y = (c) => base - (Math.min(c, yMax) / yMax) * rowH;
      parts.push(
        `<line class="ref" x1="${padL}" x2="${W - padR}" y1="${f2(y(ref))}" y2="${f2(y(ref))}"/>`,
      );
      parts.push(
        `<text class="ref-label" x="${W - padR}" y="${f2(y(ref) - 4)}" text-anchor="end">${thin(ref)} runs</text>`,
      );
      parts.push(`<text class="row-label row-${r.kind}" x="${padL}" y="${r.top - 6}">${r.label}</text>`);
      const clipped = [];
      if (r.kind === "source") {
        let d = "";
        let started = false;
        r.hist.counts.forEach((c, i) => {
          const x0 = padL + i * bw;
          const yy = y(c);
          if (!started) {
            d += `M${f2(x0)} ${base} L${f2(x0)} ${f2(yy)}`;
            started = true;
          } else d += ` L${f2(x0)} ${f2(yy)}`;
          d += ` L${f2(x0 + bw)} ${f2(yy)}`;
          if (c > yMax) clipped.push({ i, c });
        });
        d += ` L${f2(padL + pw)} ${base}`;
        parts.push(`<path class="outline" d="${d}"/>`);
      } else {
        r.hist.counts.forEach((c, i) => {
          if (c === 0) return;
          const x0 = padL + i * bw;
          const yy = y(c);
          parts.push(
            `<rect class="filled" x="${f2(x0 + 0.5)}" y="${f2(yy)}" width="${f2(Math.max(bw - 1, 0.8))}" height="${f2(base - yy)}"/>`,
          );
          if (c > yMax) clipped.push({ i, c });
        });
      }
      for (const k of clipped) {
        const x0 = padL + k.i * bw;
        parts.push(
          `<path class="break" d="M${f2(x0 - 1)} ${r.top + 7} L${f2(x0 + bw + 1)} ${r.top + 3} M${f2(x0 - 1)} ${r.top + 11} L${f2(x0 + bw + 1)} ${r.top + 7}"/>`,
        );
        parts.push(
          `<text class="clip-label" x="${f2(x0 + bw + 5)}" y="${r.top + 11}">${thin(k.c)} runs</text>`,
        );
      }
      parts.push(`<line class="axis" x1="${padL}" x2="${W - padR}" y1="${base}" y2="${base}"/>`);
      if (r.mean !== undefined) {
        const mx = x(r.mean);
        parts.push(
          `<path class="mean-mark mean-${r.kind}" d="M${f2(mx)} ${base + 1} l-4.5 8 h9 z"><title>mean ${minus(r.meanLabel ?? r.mean)}</title></path>`,
        );

      }
    }
    const axisY = padT + rowH * 2 + gap;
    for (let t = Math.ceil(h.lo); t <= h.hi; t++) {
      const tx = x(t);
      parts.push(`<line class="tick" x1="${f2(tx)}" x2="${f2(tx)}" y1="${axisY}" y2="${axisY + 4}"/>`);
      parts.push(
        `<text class="tick-label" x="${f2(tx)}" y="${axisY + 18}" text-anchor="middle">${minus(t)}</text>`,
      );
    }
    parts.push("</svg>");
    return parts.join("");
  }

  // B: each run's output against one G draw; marginal histograms along the right edge.
  function conditional(o) {
    const W = o.width ?? 640;
    const H = o.height ?? 380;
    const margW = o.marginWidth ?? 120;
    const padL = 34;
    const padT = 26;
    const padB = 40;
    const gapM = 14;
    const padR = 44;
    const pw = W - padL - margW - gapM - padR;
    const ph = H - padT - padB;
    const [xlo, xhi] = o.xRange;
    const [ylo, yhi] = o.yRange;
    const X = (v) => padL + ((v - xlo) / (xhi - xlo)) * pw;
    const Y = (v) => padT + ph - ((v - ylo) / (yhi - ylo)) * ph;
    const id = o.id ?? "cp";
    const parts = [
      `<svg class="chart conditional" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t" preserveAspectRatio="xMidYMid meet">`,
      `<title id="${id}-t">${o.title ?? ""}</title>`,
    ];
    // y ticks and grid
    for (let t = Math.ceil(ylo); t <= yhi; t++) {
      const ty = Y(t);
      parts.push(`<line class="${t === 0 ? "zero" : "grid"}" x1="${padL}" x2="${padL + pw}" y1="${f2(ty)}" y2="${f2(ty)}"/>`);
      parts.push(`<text class="tick-label" x="${padL - 6}" y="${f2(ty + 4)}" text-anchor="end">${minus(t)}</text>`);
    }
    // x axis in the G colour
    parts.push(`<line class="axis-given" x1="${padL}" x2="${padL + pw}" y1="${padT + ph}" y2="${padT + ph}"/>`);
    for (const t of o.xTicks ?? [xlo, (xlo + xhi) / 2, xhi]) {
      const tx = X(t);
      parts.push(`<line class="tick-given" x1="${f2(tx)}" x2="${f2(tx)}" y1="${padT + ph}" y2="${padT + ph + 4}"/>`);
      parts.push(`<text class="tick-label given" x="${f2(tx)}" y="${padT + ph + 17}" text-anchor="middle">${t}</text>`);
    }
    parts.push(
      `<text class="axis-title given" x="${padL + pw}" y="${H - 4}" text-anchor="end">${o.xLabel}</text>`,
    );
    parts.push(
      `<text class="axis-title" x="${padL - 30}" y="${padT - 12}" text-anchor="start">${o.yLabel ?? ""}</text>`,
    );
    // determinized first, then source circles on top, so both stay visible
    for (const [gx, , dy] of o.pairs) {
      if (dy < ylo || dy > yhi) continue;
      parts.push(`<circle class="pt-det" cx="${f2(X(gx))}" cy="${f2(Y(dy))}" r="2.3"/>`);
    }
    for (const [gx, sy] of o.pairs) {
      if (sy < ylo || sy > yhi) continue;
      parts.push(`<circle class="pt-source" cx="${f2(X(gx))}" cy="${f2(Y(sy))}" r="2.6"/>`);
    }
    // marginals: horizontal histograms on the shared y axis
    if (o.srcHist) {
      const mx0 = padL + pw + gapM;
      const sh = o.srcHist;
      const dh = o.detHist;
      const peak = Math.max(...sh.counts);
      const cMax = Math.ceil(peak * 1.12);
      const bh = (Y(sh.lo) - Y(sh.hi)) / sh.bins;
      const L = (c) => mx0 + (Math.min(c, cMax) / cMax) * margW;
      parts.push(`<line class="axis" x1="${mx0}" x2="${mx0}" y1="${padT}" y2="${padT + ph}"/>`);
      dh.counts.forEach((c, i) => {
        if (c === 0) return;
        const yTop = Y(dh.lo + (i + 1) * ((dh.hi - dh.lo) / dh.bins));
        if (yTop < padT - 1 || yTop + bh > padT + ph + 1) return;
        parts.push(`<rect class="filled" x="${mx0}" y="${f2(yTop + 0.5)}" width="${f2(L(c) - mx0)}" height="${f2(Math.max(bh - 1, 0.8))}"/>`);
        if (c > cMax)
          parts.push(`<text class="clip-label" x="${mx0 + margW + 4}" y="${f2(yTop + bh - 1)}" text-anchor="start">${thin(c)}</text>`);
      });
      let d = "";
      sh.counts.forEach((c, i) => {
        const yb = Y(sh.lo + i * ((sh.hi - sh.lo) / sh.bins));
        const yt = yb - bh;
        if (yt < padT - 1 || yb > padT + ph + 1) return;
        d += d ? ` L${f2(L(c))} ${f2(yb)}` : `M${mx0} ${f2(yb)} L${f2(L(c))} ${f2(yb)}`;
        d += ` L${f2(L(c))} ${f2(yt)}`;
      });
      parts.push(`<path class="outline-src" d="${d}"/>`);
      parts.push(`<text class="tick-label" x="${mx0}" y="${padT + ph + 17}">runs per bin</text>`);
    }
    parts.push("</svg>");
    return parts.join("");
  }

  root.MockCharts = { stacked, conditional, minus, thin };
})(typeof window === "undefined" ? globalThis : window);
