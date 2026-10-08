"""
AFSCA (FAVV) registration numbers of the apiaries.

A number has 10 digits and is written `X.XXX.XXX.XXX` (e.g. `9.005.577.599`).
It is stored in that form; input may come with dots, spaces, dashes or slashes,
or none at all.
"""

import re

AFSCA_DIGITS = 10
AFSCA_FORMAT = 'X.XXX.XXX.XXX'
# Separators accepted around the digits when a number is typed or pasted
_ACCEPTED = re.compile(r'^[\d\s./-]*$')


def afsca_digits(value: str) -> str:
    return re.sub(r'\D', '', value or '')


def format_afsca(digits: str) -> str:
    """`9005577599` -> `9.005.577.599`."""
    return f'{digits[0]}.{digits[1:4]}.{digits[4:7]}.{digits[7:10]}'


def normalize_afsca(value: str):
    """
    The canonical form of a typed number, `''` for none, or `None` when it is
    not a valid number (not 10 digits, or other characters than separators).
    """
    value = (value or '').strip()
    if not value:
        return ''
    digits = afsca_digits(value)
    if not _ACCEPTED.match(value) or len(digits) != AFSCA_DIGITS:
        return None
    return format_afsca(digits)
