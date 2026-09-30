"""
HTML emails of the API, in the layout of the Keycloak email theme.

The layout is not copied: the API reads the theme's own `html/template.ftl`
(mounted read-only at `EMAIL_THEME_DIR`) and resolves the few FreeMarker
expressions it uses. Anything else in that file raises `LayoutError`, so a
change to the theme that this module does not understand shows in the tests
instead of in someone's inbox. The logo travels inside the message (`cid:`),
Keycloak's resource URL being versioned per server.

Without a readable theme the message still goes out, as plain text.
"""

import logging
import re
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

logger = logging.getLogger(__name__)

LAYOUT_FILE = 'html/template.ftl'
LOGO_FILE = 'resources/img/vsab-logo.png'
LOGO_CID = 'vsab-logo@velutina'
NESTED = '<#nested>'

# Every FreeMarker expression of the layout, and its value outside Keycloak
_VALUES = {
    '${locale.language}': 'fr',
    "${(ltr)?then('ltr','rtl')}": 'ltr',
    '${url.resourcesUrl}/img/vsab-logo.png': f'cid:{LOGO_CID}',
    '${realmName!""}': 'Velutina',
}
_COMMENT = re.compile(r'<#--.*?-->', re.S)
_MACRO = re.compile(r'<#macro emailLayout>(.*)</#macro>', re.S)
_LEFTOVER = re.compile(r'\$\{[^}]*\}|<#(?!nested>)[^>]*>|</#[^>]*>')


class LayoutError(Exception):
    """The theme's layout uses FreeMarker this module does not resolve."""


def email_layout(theme_dir) -> str:
    """The theme's HTML layout, with `<#nested>` marking where the content goes."""
    source = (Path(theme_dir) / LAYOUT_FILE).read_text(encoding='utf-8')
    match = _MACRO.search(_COMMENT.sub('', source))
    if not match:
        raise LayoutError('no emailLayout macro')
    html = match.group(1).strip()
    for expression, value in _VALUES.items():
        html = html.replace(expression, value)
    leftovers = sorted(set(_LEFTOVER.findall(html)))
    if leftovers or html.count(NESTED) != 1:
        raise LayoutError(f'unsupported FreeMarker in the layout: {leftovers}')
    return html


class BrandedEmail(EmailMultiAlternatives):
    """Plain text, plus the same message in the Keycloak email layout when available."""

    def __init__(self, subject, text, html_content, to):
        super().__init__(subject, text, None, to)
        self._logo = None
        theme = Path(settings.EMAIL_THEME_DIR)
        try:
            layout = email_layout(theme)
            self._logo = (theme / LOGO_FILE).read_bytes()
        except (OSError, LayoutError) as exc:
            logger.warning("Email theme unavailable, sending plain text: %s", exc)
            return
        self.attach_alternative(layout.replace(NESTED, html_content), 'text/html')

    def message(self, **kwargs):
        msg = super().message(**kwargs)
        html = msg.get_body(preferencelist=('html',)) if self._logo else None
        if html is not None:
            # multipart/related around the HTML part: the logo shows inline, not as an attachment
            html.add_related(self._logo, maintype='image', subtype='png', cid=f'<{LOGO_CID}>',
                             disposition='inline', filename='vsab-logo.png')
        return msg
