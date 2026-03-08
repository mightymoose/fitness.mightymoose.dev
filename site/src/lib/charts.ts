// SVG chart generation — warm athletic editorial palette

const colors = {
  bg: '#1a1a1e',
  text: '#e8e0d4',
  textMuted: '#6d665d',
  textSecondary: '#a89f93',
  accent: '#c47d3c',
  accentLight: '#d4944f',
  grid: 'rgba(232, 224, 212, 0.06)',
  gridStrong: 'rgba(232, 224, 212, 0.1)',
  dotFill: '#d4944f',
  dotStroke: '#c47d3c',
};

const W = 640;
const H = 340;
const PAD = { top: 48, right: 24, bottom: 52, left: 64 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function niceAxis(min: number, max: number, ticks: number): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const range = max - min;
  const rawStep = range / ticks;
  // Round step to nice numbers
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;
  let step: number;
  if (residual <= 1.5) step = magnitude;
  else if (residual <= 3.5) step = 2 * magnitude;
  else if (residual <= 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;

  const start = Math.floor(min / step) * step;
  const vals: number[] = [];
  for (let v = start; v <= max + step * 0.01; v += step) {
    vals.push(Math.round(v * 1000) / 1000);
  }
  return vals;
}

interface VelocityPoint {
  weight_lb: number;
  mean_velocity: number;
}

export function renderLoadVelocityChart(
  exerciseName: string,
  data: VelocityPoint[]
): string {
  if (data.length === 0) return '';

  const xMin = Math.min(...data.map((d) => d.weight_lb));
  const xMax = Math.max(...data.map((d) => d.weight_lb));
  const yMax = Math.max(...data.map((d) => d.mean_velocity)) * 1.15;

  const xTicks = niceAxis(xMin * 0.95, xMax * 1.05, 5);
  const yTicks = niceAxis(0, yMax, 5);

  const xRange = xTicks[xTicks.length - 1] - xTicks[0];
  const yRange = yTicks[yTicks.length - 1] - yTicks[0];
  const xScale = (v: number) => PAD.left + ((v - xTicks[0]) / xRange) * plotW;
  const yScale = (v: number) => PAD.top + plotH - ((v - yTicks[0]) / yRange) * plotH;

  const fontBase = `font-family="'DM Sans', system-ui, sans-serif"`;
  const fontMono = `font-family="'JetBrains Mono', monospace"`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">`;

  // Background
  svg += `<rect width="${W}" height="${H}" rx="8" fill="${colors.bg}"/>`;

  // Title
  svg += `<text x="${PAD.left}" y="28" fill="${colors.text}" font-size="14" font-weight="600" ${fontBase}>${escapeXml(exerciseName)}</text>`;
  svg += `<text x="${PAD.left}" y="42" fill="${colors.textMuted}" font-size="10" ${fontBase}>Load-Velocity Profile</text>`;

  // Horizontal grid lines & Y labels
  for (const y of yTicks) {
    const py = yScale(y);
    if (py < PAD.top - 2 || py > PAD.top + plotH + 2) continue;
    svg += `<line x1="${PAD.left}" y1="${py}" x2="${W - PAD.right}" y2="${py}" stroke="${y === 0 ? colors.gridStrong : colors.grid}" stroke-width="1"/>`;
    svg += `<text x="${PAD.left - 10}" y="${py + 3.5}" text-anchor="end" fill="${colors.textMuted}" font-size="10" ${fontMono}>${y.toFixed(2)}</text>`;
  }

  // X labels
  for (const x of xTicks) {
    const px = xScale(x);
    if (px < PAD.left - 2 || px > W - PAD.right + 2) continue;
    svg += `<line x1="${px}" y1="${PAD.top}" x2="${px}" y2="${PAD.top + plotH}" stroke="${colors.grid}" stroke-width="1"/>`;
    svg += `<text x="${px}" y="${PAD.top + plotH + 16}" text-anchor="middle" fill="${colors.textMuted}" font-size="10" ${fontMono}>${x}</text>`;
  }

  // Axis labels
  svg += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" fill="${colors.textMuted}" font-size="10" letter-spacing="0.06em" ${fontBase}>WEIGHT (LB)</text>`;
  svg += `<text x="12" y="${PAD.top + plotH / 2}" text-anchor="middle" fill="${colors.textMuted}" font-size="10" letter-spacing="0.06em" ${fontBase} transform="rotate(-90 12 ${PAD.top + plotH / 2})">VELOCITY (M/S)</text>`;

  // Compute trend line (linear regression)
  if (data.length >= 2) {
    const n = data.length;
    const sumX = data.reduce((s, d) => s + d.weight_lb, 0);
    const sumY = data.reduce((s, d) => s + d.mean_velocity, 0);
    const sumXY = data.reduce((s, d) => s + d.weight_lb * d.mean_velocity, 0);
    const sumX2 = data.reduce((s, d) => s + d.weight_lb * d.weight_lb, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (Math.abs(denom) > 0.0001) {
      const slope = (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;
      const lineX1 = xTicks[0];
      const lineX2 = xTicks[xTicks.length - 1];
      const lineY1 = slope * lineX1 + intercept;
      const lineY2 = slope * lineX2 + intercept;
      svg += `<line x1="${xScale(lineX1)}" y1="${yScale(lineY1)}" x2="${xScale(lineX2)}" y2="${yScale(lineY2)}" stroke="${colors.accent}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>`;
    }
  }

  // Data points with glow
  for (const d of data) {
    const cx = xScale(d.weight_lb);
    const cy = yScale(d.mean_velocity);
    // Glow
    svg += `<circle cx="${cx}" cy="${cy}" r="10" fill="${colors.accent}" opacity="0.08"/>`;
    // Dot
    svg += `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${colors.dotFill}" stroke="${colors.dotStroke}" stroke-width="1.5" opacity="0.9"/>`;
  }

  svg += `</svg>`;
  return svg;
}
