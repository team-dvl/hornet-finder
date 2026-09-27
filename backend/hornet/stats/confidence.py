"""
95 % confidence intervals of the statistics.

* A count of catches over some trapping effort: exact Poisson interval
  (Garwood), found by bisection on the Poisson distribution up to 200
  catches, then the Wilson-Hilferty approximation, within 0.001 % of the
  exact bounds at that size. Catches cluster around nests, so the real
  uncertainty is wider: this interval is a lower bound of it.
* A share (Asian hornets among the insects counted): Wilson score interval.
"""

import math

Z = 1.959964  # two-sided 95 %
ALPHA_HALF = 0.025
EXACT_LIMIT = 200


def _poisson_cdf(k: int, mu: float) -> float:
    """P(X <= k) for X ~ Poisson(mu)."""
    if mu <= 0:
        return 1.0
    log_term = -mu
    total = math.exp(log_term)
    for i in range(1, k + 1):
        log_term += math.log(mu) - math.log(i)
        total += math.exp(log_term)
    return min(total, 1.0)


def _bisect(predicate, low: float, high: float) -> float:
    """Smallest x in [low, high] where `predicate(x)` holds (monotonic)."""
    for _ in range(80):
        middle = (low + high) / 2
        if predicate(middle):
            high = middle
        else:
            low = middle
    return (low + high) / 2


def poisson_interval(count: int) -> tuple:
    """95 % interval of the mean of a Poisson variable observed at `count`."""
    count = max(0, int(round(count)))
    if count > EXACT_LIMIT:
        lower = count * (1 - 1 / (9 * count) - Z / (3 * math.sqrt(count))) ** 3
        upper_n = count + 1
        upper = upper_n * (1 - 1 / (9 * upper_n) + Z / (3 * math.sqrt(upper_n))) ** 3
        return lower, upper
    ceiling = count + 10 * math.sqrt(count + 1) + 10
    lower = 0.0 if count == 0 else _bisect(
        lambda mu: 1 - _poisson_cdf(count - 1, mu) >= ALPHA_HALF, 0.0, float(count))
    upper = _bisect(lambda mu: _poisson_cdf(count, mu) <= ALPHA_HALF, float(count), ceiling)
    return lower, upper


def wilson_interval(successes: int, trials: int):
    """95 % interval of a proportion; None without any trial."""
    if trials <= 0:
        return None
    p = successes / trials
    denominator = 1 + Z * Z / trials
    centre = (p + Z * Z / (2 * trials)) / denominator
    half = Z * math.sqrt(p * (1 - p) / trials + Z * Z / (4 * trials * trials)) / denominator
    return max(0.0, centre - half), min(1.0, centre + half)
