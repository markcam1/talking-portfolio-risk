export interface ReportFacts {
  summary: string[];
  detail: string[];
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

interface WeightEntry {
  ticker: string;
  weight: number;
}

function readWeightEntries(arr: unknown, field: string = 'weight'): WeightEntry[] {
  if (!Array.isArray(arr)) return [];
  const out: WeightEntry[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const ticker = (item as Record<string, unknown>).ticker;
    const weight = numOrNull((item as Record<string, unknown>)[field]);
    if (typeof ticker === 'string' && weight !== null) {
      out.push({ ticker, weight });
    }
  }
  return out;
}

// Deterministically extracts short, pre-formatted facts from a report pack so the
// voice agent never has to decide on its own what counts as "one fact" to speak.
export function buildReportFacts(pack: unknown): ReportFacts {
  const p = (pack && typeof pack === 'object' ? pack : {}) as Record<string, unknown>;
  const headline = (p.headline && typeof p.headline === 'object' ? p.headline : {}) as Record<string, unknown>;

  const facts: string[] = [];

  const sharpe = numOrNull(headline.sharpe_ratio);
  if (sharpe !== null) {
    facts.push(`Your portfolio's Sharpe ratio is ${sharpe.toFixed(4)}, which measures return earned per unit of risk taken.`);
  }

  const expectedReturn = numOrNull(headline.expected_return_annual);
  if (expectedReturn !== null) {
    facts.push(`The expected annual return is ${pct(expectedReturn)}.`);
  }

  const risk = numOrNull(headline.portfolio_risk_annual);
  if (risk !== null) {
    facts.push(`The portfolio's annual risk, or volatility, is ${pct(risk)}.`);
  }

  const topHoldings = readWeightEntries(headline.top_holdings)
    .filter((h) => h.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const summaryFactCount = facts.length + (topHoldings.length > 0 ? 1 : 0);

  if (topHoldings[0]) {
    facts.push(`Your largest holding is ${topHoldings[0].ticker}, making up ${pct(topHoldings[0].weight)} of the portfolio.`);
  }
  for (const h of topHoldings.slice(1, 4)) {
    facts.push(`The next largest position is ${h.ticker} at ${pct(h.weight)}.`);
  }

  const riskEntries = readWeightEntries(p.risk_contribution, 'contribution')
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (riskEntries[0]) {
    facts.push(`${riskEntries[0].ticker} contributes ${pct(riskEntries[0].weight)} of the portfolio's total risk — its biggest single risk driver.`);
  }

  const zeroTickers = readWeightEntries(p.weights)
    .filter((w) => w.weight === 0)
    .map((w) => w.ticker);
  if (zeroTickers.length > 0) {
    const list = zeroTickers.join(' and ');
    facts.push(
      zeroTickers.length > 1
        ? `${list} are currently at a zero weight in this portfolio, meaning they're not held.`
        : `${list} is currently at a zero weight in this portfolio, meaning it's not held.`
    );
  }

  return {
    summary: facts.slice(0, summaryFactCount),
    detail: facts,
  };
}
