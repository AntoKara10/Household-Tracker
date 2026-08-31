// Resolve the budget amount that was "in effect" for a given category
// during a given calendar month: the most recent budget row whose
// effective_date falls on or before the end of that month.
export function resolveBudgetForMonth(budgetsForCategory, monthEndIso) {
  const applicable = budgetsForCategory
    .filter((b) => b.effective_date <= monthEndIso)
    .sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1));
  return applicable.length ? applicable[0].amount : null;
}

// Sum a category's effective budget across a set of month buckets.
// e.g. Jan @200 + Feb @150 + Mar @150 over a Jan-Mar range = 500,
// never a flat "current" number applied to every month.
export function totalBudgetOverBuckets(budgetsForCategory, buckets) {
  let total = 0;
  let anyDefined = false;
  for (const bucket of buckets) {
    const amt = resolveBudgetForMonth(budgetsForCategory, bucket.end);
    if (amt !== null) {
      total += amt;
      anyDefined = true;
    }
  }
  return anyDefined ? total : null;
}

// Variance color: green = favorable, red = unfavorable.
// Inflows: favorable when actual >= budget. Outflows: favorable when actual <= budget.
export function varianceStatus(actual, budget, direction) {
  if (budget === null || budget === undefined) return 'neutral';
  if (direction === 'inflow') return actual >= budget ? 'positive' : 'negative';
  return actual <= budget ? 'positive' : 'negative';
}
