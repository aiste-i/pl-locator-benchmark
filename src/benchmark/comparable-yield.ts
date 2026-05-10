export interface ComparableYieldRow {
  appId: string;
  browserName: string;
  family: string;
  mutatedRuns: number;
  comparableMutatedRuns: number;
}

export interface ComparableYieldFailure {
  row: ComparableYieldRow;
  yieldRatio: number;
  minimumYield: number;
}

export function evaluateComparableYield(
  rows: ComparableYieldRow[],
  minimumYield: number,
): ComparableYieldFailure[] {
  return rows
    .filter(row => row.mutatedRuns > 0)
    .map(row => ({
      row,
      yieldRatio: row.comparableMutatedRuns / row.mutatedRuns,
      minimumYield,
    }))
    .filter(result => result.yieldRatio < minimumYield);
}
