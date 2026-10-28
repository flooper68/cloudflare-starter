import sys
from decimal import Decimal, getcontext


def calculate_pi(digits: int) -> str:
    getcontext().prec = digits + 10
    total = Decimal(0)

    for k in range(digits // 14 + 1):
        numerator = Decimal(math_factorial(6 * k)) * (13591409 + 545140134 * k)
        denominator = (
            Decimal(math_factorial(3 * k))
            * Decimal(math_factorial(k) ** 3)
            * Decimal(-262537412640768000) ** k
        )
        total += numerator / denominator

    pi = Decimal(426880) * Decimal(10005).sqrt() / total
    return format(pi, f".{digits}f")


def math_factorial(value: int) -> int:
    result = 1
    for number in range(2, value + 1):
        result *= number
    return result


def parse_digits(argv: list[str]) -> int:
    if len(argv) < 2:
        return 12

    try:
        digits = int(argv[1])
    except ValueError as exc:
        raise SystemExit(f"invalid digits value: {argv[1]}") from exc

    if digits < 1 or digits > 100:
        raise SystemExit("digits must be between 1 and 100")

    return digits


if __name__ == "__main__":
    print(calculate_pi(parse_digits(sys.argv)))
