"""Digits of pi with the Chudnovsky series, summed by binary splitting in integers.

`python pi_task.py <digits>` prints pi with <digits> decimals ("3.14159..."). Binary
splitting and math.isqrt keep it fast: 50,000 decimals take well under a second on one
core, and a few seconds on the smallest (`lite`, 1/16 vCPU) container instance.
"""

import math
import sys

# The demo's ceiling (the web app's presets stay below it, MAX_DIGITS in
# packages/features/src/container-runs/domain/run-input.ts).
MAX_DIGITS = 100_000

C = 640320
C3_OVER_24 = C**3 // 24


def _split(a: int, b: int) -> tuple[int, int, int]:
    """P, Q, T of the terms [a, b) of the Chudnovsky series."""
    if b - a == 1:
        if a == 0:
            p = q = 1
        else:
            p = (6 * a - 5) * (2 * a - 1) * (6 * a - 1)
            q = a * a * a * C3_OVER_24
        t = p * (13591409 + 545140134 * a)
        if a % 2:
            t = -t
        return p, q, t
    m = (a + b) // 2
    p1, q1, t1 = _split(a, m)
    p2, q2, t2 = _split(m, b)
    return p1 * p2, q1 * q2, q2 * t1 + p1 * t2


def calculate_pi(digits: int) -> str:
    # Each term adds about 14.18 digits; a few guard digits absorb the truncation.
    guard = 10
    terms = digits // 14 + 2
    _, q, t = _split(0, terms)
    one = 10 ** (digits + guard)
    sqrt_c = math.isqrt(10005 * one * one)
    pi = (q * 426880 * sqrt_c) // t
    text = str(pi // 10**guard)
    return f"{text[0]}.{text[1:]}"


def parse_digits(argv: list[str]) -> int:
    if len(argv) < 2:
        return 12

    try:
        digits = int(argv[1])
    except ValueError as exc:
        raise SystemExit(f"invalid digits value: {argv[1]}") from exc

    if digits < 1 or digits > MAX_DIGITS:
        raise SystemExit(f"digits must be between 1 and {MAX_DIGITS}")

    return digits


if __name__ == "__main__":
    # Python 3.11+ refuses str() of integers above 4300 digits unless allowed.
    if hasattr(sys, "set_int_max_str_digits"):
        sys.set_int_max_str_digits(0)
    print(calculate_pi(parse_digits(sys.argv)))
