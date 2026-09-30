"""
PDF of a statistic: A4 landscape, its title and parameters, the charts of the
page drawn as vectors, then the table (headers repeated on every page).

Built from the same result as the other files. The charts follow the
frontend's (`components/stats/charts`): same colours, one scale per chart,
the 95 % interval as a band or a line.
"""

import io
import math

from reportlab.graphics.shapes import Circle, Drawing, Line, Polygon, PolyLine, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .render import _lines, parameters

PAGE = landscape(A4)
MARGIN = 12 * mm
# The frame keeps 6 pt of padding on each side
WIDTH = PAGE[0] - 2 * MARGIN - 12

# The frontend's palette (validated for colour-blind readers)
PRIMARY = colors.HexColor('#2a78d6')
BAND = colors.HexColor('#d6e5f7')
PREVIOUS = colors.HexColor('#6f6e69')
GRID = colors.HexColor('#dee2e6')
TEXT = colors.HexColor('#212529')
MUTED = colors.HexColor('#6c757d')
SERIES = [colors.HexColor(c) for c in ('#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#008300')]
OTHER = colors.HexColor('#6f6e69')
ZEBRA = colors.HexColor('#f8f9fa')

FONT = 'Helvetica'
BOLD = 'Helvetica-Bold'

TITLE = ParagraphStyle('title', fontName=BOLD, fontSize=15, leading=19, textColor=TEXT, spaceAfter=4)
CHART_TITLE = ParagraphStyle('chart', fontName=BOLD, fontSize=9.5, leading=12, textColor=TEXT)
LABEL = ParagraphStyle('label', fontName=BOLD, fontSize=8, leading=10, textColor=MUTED)
VALUE = ParagraphStyle('value', fontName=FONT, fontSize=8, leading=10, textColor=TEXT)
HEAD = ParagraphStyle('head', fontName=BOLD, fontSize=7.5, leading=9, textColor=TEXT)
HEAD_RIGHT = ParagraphStyle('head-right', parent=HEAD, alignment=TA_RIGHT)

MAX_CHART_POINTS = 400


def _safe(text) -> str:
    """Text the standard PDF fonts can draw (Windows-1252), XML-escaped for Paragraph."""
    text = str(text).replace(' ', ' ').replace(' ', ' ')
    text = text.encode('cp1252', errors='replace').decode('cp1252')
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _plain(text) -> str:
    return str(text).replace(' ', ' ').encode('cp1252', errors='replace').decode('cp1252')


def _number(value, decimals: int) -> str:
    """1 234,5: the French way, with an ordinary space (in every PDF font)."""
    text = f"{value:,.{decimals}f}"
    return text.replace(',', ' ').replace('.', ',')


def _cell(value, column: dict) -> str:
    if value is None or value == '':
        return '–'
    kind = column['type']
    if kind == 'int':
        return _number(value, 0)
    if kind == 'float':
        return _number(value, column.get('decimals', 2))
    if kind == 'percent':
        return f"{_number(value * 100, 1)} %"
    if kind == 'date':
        year, month, day = str(value)[:10].split('-')
        return f"{day}/{month}/{year}"
    return str(value)


def _num(value):
    return None if value is None else float(value)


def nice_ticks(top: float, count: int = 4) -> list:
    """0, 25, 50, 75, 100 for a maximum of 87 (same as the frontend)."""
    if not top or top <= 0:
        return [0, 1]
    raw = top / count
    magnitude = 10 ** math.floor(math.log10(raw))
    step = next((m * magnitude for m in (1, 2, 2.5, 5, 10) if m * magnitude >= raw), raw)
    ticks, value = [], 0.0
    while value <= top + step * 1e-3:
        ticks.append(round(value, 10))
        value += step
    if ticks[-1] < top:
        ticks.append(round(ticks[-1] + step, 10))
    return ticks


def _tick(value: float) -> str:
    return _number(value, 0 if value == int(value) else (1 if value * 10 == int(value * 10) else 2))


# Charts ---------------------------------------------------------------------

class Plot:
    """Frame of a chart over buckets: a left axis, the grid, labels under it."""
    LEFT, RIGHT, TOP, BOTTOM = 34, 6, 6, 16

    def __init__(self, width, height, labels, top_value, percent=False):
        self.drawing = Drawing(width, height)
        self.width, self.height = width, height
        self.labels = labels
        self.plot_w = width - self.LEFT - self.RIGHT
        self.plot_h = height - self.TOP - self.BOTTOM
        self.step = self.plot_w / max(len(labels), 1)
        self.ticks = [0, 0.25, 0.5, 0.75, 1] if percent else nice_ticks(top_value)
        self.top = self.ticks[-1]
        for tick in self.ticks:
            y = self.y(tick)
            self.drawing.add(Line(self.LEFT, y, width - self.RIGHT, y, strokeColor=GRID, strokeWidth=0.5))
            text = f"{round(tick * 100)} %" if percent else _tick(tick)
            self.drawing.add(String(self.LEFT - 3, y - 2.5, text, fontName=FONT, fontSize=6.5,
                                    fillColor=MUTED, textAnchor='end'))
        every = max(1, math.ceil(len(labels) * 34 / max(self.plot_w, 1)))
        for index, label in enumerate(labels):
            if index % every == 0:
                self.drawing.add(String(self.x(index), 4, _plain(label), fontName=FONT, fontSize=6.5,
                                        fillColor=MUTED, textAnchor='middle'))

    def x(self, index):
        return self.LEFT + self.step * (index + 0.5)

    def y(self, value):
        # PDF coordinates grow upwards; values above the axis are clipped to it
        return self.BOTTOM + min(max(value, 0), self.top) / self.top * self.plot_h

    def bar_width(self):
        return max(0.8, min(16, self.step * 0.8))


def time_bars(labels, values, width, height=150):
    plot = Plot(width, height, labels, max([v or 0 for v in values] + [0]))
    bar = plot.bar_width()
    for index, value in enumerate(values):
        if value:
            plot.drawing.add(Rect(plot.x(index) - bar / 2, plot.BOTTOM, bar, plot.y(value) - plot.BOTTOM,
                                  fillColor=PRIMARY, strokeColor=None))
    return plot.drawing


def _runs(points):
    """Runs of consecutive defined points: a missing value breaks a line."""
    run = []
    for point in points:
        if point is None:
            if run:
                yield run
            run = []
        else:
            run.append(point)
    if run:
        yield run


def time_line(labels, values, lows, highs, previous, width, height=150):
    defined = [v for v in values + (previous or []) if v is not None]
    value_max = max(defined + [0])
    band_max = max([h for h in highs if h is not None] + [0])
    # Scaled on the values: a wide interval would flatten the curve (clipped instead)
    plot = Plot(width, height, labels, min(band_max, value_max * 1.5) if value_max else band_max)
    band = [(plot.x(i), plot.y(lo), plot.y(hi)) if lo is not None and hi is not None else None
            for i, (lo, hi) in enumerate(zip(lows, highs))]
    for run in _runs(band):
        points = [c for x, _, hi in run for c in (x, hi)] + [c for x, lo, _ in reversed(run) for c in (x, lo)]
        if len(run) > 1:
            plot.drawing.add(Polygon(points, fillColor=BAND, strokeColor=None))
    if previous:
        for run in _runs([(plot.x(i), plot.y(v)) if v is not None else None for i, v in enumerate(previous)]):
            if len(run) > 1:
                plot.drawing.add(PolyLine([c for p in run for c in p], strokeColor=PREVIOUS, strokeWidth=1.2,
                                          strokeDashArray=[3, 2]))
    for run in _runs([(plot.x(i), plot.y(v)) if v is not None else None for i, v in enumerate(values)]):
        if len(run) > 1:
            plot.drawing.add(PolyLine([c for p in run for c in p], strokeColor=PRIMARY, strokeWidth=1.4))
        else:
            plot.drawing.add(Circle(run[0][0], run[0][1], 1.5, fillColor=PRIMARY, strokeColor=None))
    return plot.drawing


def stacked_shares(labels, series, shares, width, height=160):
    plot = Plot(width, height, labels, 1, percent=True)
    bar = plot.bar_width()
    for index, bucket in enumerate(shares):
        base = plot.BOTTOM
        for serie in series:
            share = bucket.get(serie['key']) or 0
            if share <= 0:
                continue
            h = share * plot.plot_h
            plot.drawing.add(Rect(plot.x(index) - bar / 2, base, bar, h, fillColor=serie['color'],
                                  strokeColor=colors.white, strokeWidth=0.3))
            base += h
    return plot.drawing


def forest(rows, width, percent=False, row_height=16):
    """One point per row with its interval; rows are (label, value, low, high)."""
    axis = 14
    height = len(rows) * row_height + axis
    drawing = Drawing(width, height)
    label_w = min(170, width * 0.35)
    right = 14
    top = 1 if percent else max([r[3] or r[1] or 0 for r in rows] + [0])
    ticks = [0, 0.25, 0.5, 0.75, 1] if percent else nice_ticks(top)
    top = ticks[-1]
    plot_w = width - label_w - right

    def x(value):
        return label_w + min(max(value, 0), top) / top * plot_w

    for tick in ticks:
        drawing.add(Line(x(tick), axis, x(tick), height, strokeColor=GRID, strokeWidth=0.5))
        drawing.add(String(x(tick), 3, f"{round(tick * 100)} %" if percent else _tick(tick),
                           fontName=FONT, fontSize=6.5, fillColor=MUTED, textAnchor='middle'))
    chars = int((label_w - 6) / 4)
    for index, (label, value, low, high) in enumerate(rows):
        cy = height - (index + 0.5) * row_height
        text = _plain(label)
        text = text if len(text) <= chars else text[:chars - 1] + '…'
        drawing.add(String(0, cy - 2.5, text, fontName=FONT, fontSize=7.5, fillColor=TEXT))
        if value is None:
            drawing.add(String(label_w + 4, cy - 2.5, 'trop peu de données', fontName=FONT, fontSize=7,
                               fillColor=MUTED))
            continue
        if low is not None and high is not None:
            drawing.add(Line(x(low), cy, x(high), cy, strokeColor=PRIMARY, strokeWidth=1.4))
        drawing.add(Circle(x(value), cy, 2.8, fillColor=PRIMARY, strokeColor=colors.white, strokeWidth=0.8))
    return drawing


def legend(items, width):
    """A row of (label, colour, kind) with kind 'swatch', 'line', 'dashed' or 'band'."""
    drawing = Drawing(width, 12)
    x = 0
    for label, color, kind in items:
        if kind == 'swatch':
            drawing.add(Rect(x, 2, 8, 8, fillColor=color, strokeColor=None))
            x += 11
        else:
            if kind == 'band':
                drawing.add(Rect(x, 2, 16, 8, fillColor=BAND, strokeColor=None))
            drawing.add(Line(x, 6, x + 16, 6, strokeColor=color, strokeWidth=1.4,
                             strokeDashArray=[3, 2] if kind == 'dashed' else None))
            x += 19
        text = _plain(label)
        drawing.add(String(x, 3, text, fontName=FONT, fontSize=7, fillColor=TEXT))
        x += len(text) * 3.9 + 12
    return drawing


def _bucket_label(row, granularity):
    start = str(row.get('start', ''))
    if granularity == 'day' and start:
        return f"{start[8:10]}/{start[5:7]}"
    if granularity == 'month' and row.get('bucket'):
        return str(row['bucket']).split(' ')[0][:4].lower()
    return str(row.get('bucket', ''))


def _charts(result: dict) -> list:
    """(title, drawings) of each chart of the statistic, as on its page."""
    stat = result['statistic']['id']
    rows = result['rows']
    half = (WIDTH - 8 * mm) / 2
    if not rows:
        return []
    if len(rows) > MAX_CHART_POINTS:
        return []
    if stat == 'traps-catches':
        granularity = result.get('granularity')
        unit = {'day': 'jour', 'week': 'semaine', 'month': 'mois'}.get(granularity, 'semaine')
        labels = [_bucket_label(row, granularity) for row in rows]
        previous = result.get('previous')
        prev = [_num(row.get('previous_rate')) for row in rows] if previous else None
        year = result['period'].get('year') or result['period']['end'][:4]
        items = [(f"{year} et IC 95 %", PRIMARY, 'band')]
        if prev and any(v is not None for v in prev):
            items.append((str(previous.get('year') or 'N-1'), PREVIOUS, 'dashed'))
        else:
            prev = None
        return [
            (f"Frelons asiatiques capturés par {unit}",
             [time_bars(labels, [_num(r.get('hornets')) for r in rows], half)]),
            ('Frelons par piège et par semaine',
             [legend(items, half),
              time_line(labels, [_num(r.get('rate')) for r in rows], [_num(r.get('rate_low')) for r in rows],
                        [_num(r.get('rate_high')) for r in rows], prev, half, height=138)]),
        ]
    if stat == 'trap-types':
        def pick(key):
            return [(r['name'], _num(r.get(key)), _num(r.get(f'{key}_low')), _num(r.get(f'{key}_high')))
                    for r in rows]
        return [('Frelons par piège et par semaine', [forest(pick('rate'), half)]),
                ('Sélectivité (part de frelons asiatiques)', [forest(pick('selectivity'), half, percent=True)])]
    if stat == 'traps-ranking':
        top = rows[:15]
        return [(f"Frelons par semaine, {len(top)} premiers pièges",
                 [forest([(f"#{r['id']} {r.get('address') or ''}".strip(), _num(r.get('rate')),
                           _num(r.get('rate_low')), _num(r.get('rate_high'))) for r in top], WIDTH * 0.7)])]
    if stat == 'traps-species':
        series = result.get('series') or {}
        species = series.get('species') or []
        buckets = series.get('buckets') or []
        if not species:
            return []
        styled = [{'key': s['slug'], 'name': s['name'],
                   'color': OTHER if s['slug'] == 'other' else SERIES[i % len(SERIES)]}
                  for i, s in enumerate(species)]
        labels = [_bucket_label(b, result.get('granularity')) for b in buckets]
        return [('Part de chaque espèce parmi les insectes comptés (relevés complets)',
                 [legend([(s['name'], s['color'], 'swatch') for s in styled], WIDTH),
                  stacked_shares(labels, styled, [b['shares'] for b in buckets], WIDTH * 0.8)])]
    return []


# Document -------------------------------------------------------------------

def _parameters_table(result: dict):
    data = [[Paragraph(_safe(label), LABEL), Paragraph(_safe(value), VALUE)]
            for label, value in parameters(result) if label != 'Statistique']
    table = Table(data, colWidths=[42 * mm, WIDTH - 42 * mm])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    return table


def _chart_block(title, drawings):
    return [Paragraph(_safe(title), CHART_TITLE), Spacer(0, 2)] + drawings


def _charts_flowables(result: dict) -> list:
    charts = _charts(result)
    if not charts:
        return []
    half = (WIDTH - 8 * mm) / 2
    # Two charts side by side, each on its own scale; one alone takes the width
    if len(charts) == 2:
        table = Table([[_chart_block(*charts[0]), _chart_block(*charts[1])]],
                      colWidths=[half + 4 * mm, half + 4 * mm])
        table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                   ('LEFTPADDING', (0, 0), (-1, -1), 0),
                                   ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
        return [KeepTogether([table]), Spacer(0, 5 * mm)]
    flowables = []
    for title, drawings in charts:
        flowables += [KeepTogether(_chart_block(title, drawings)), Spacer(0, 5 * mm)]
    return flowables


def _data_table(result: dict):
    columns = result['columns']
    lines = _lines(result)
    numeric = [c['type'] in ('int', 'float', 'percent') for c in columns]
    head = [Paragraph(_safe(c['label']), HEAD_RIGHT if numeric[i] else HEAD) for i, c in enumerate(columns)]
    body = [[_plain(_cell(line.get(c['key']), c)) for c in columns] for line in lines]
    # Widths from the longest value of each column, headers wrap
    weights = [max([len(row[i]) for row in body] + [6]) + 2 for i in range(len(columns))]
    total = sum(weights)
    widths = [WIDTH * w / total for w in weights]
    table = Table([head] + body, colWidths=widths, repeatRows=1)
    style = [
        ('FONT', (0, 1), (-1, -1), FONT, 7.5),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT),
        ('VALIGN', (0, 0), (-1, 0), 'BOTTOM'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.8, TEXT),
        ('LINEABOVE', (0, -1), (-1, -1), 0.8, TEXT),
        ('FONT', (0, -1), (-1, -1), BOLD, 7.5),
        ('TOPPADDING', (0, 0), (-1, -1), 1.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
    ]
    style += [('ALIGN', (i, 1), (i, -1), 'RIGHT') for i, is_number in enumerate(numeric) if is_number]
    style += [('BACKGROUND', (0, r), (-1, r), ZEBRA) for r in range(2, len(body), 2)]
    table.setStyle(TableStyle(style))
    return table


def render_pdf(result: dict) -> bytes:
    buffer = io.BytesIO()
    title = result['statistic']['title']

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT, 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN + 6, 6 * mm, _plain(f"Hornet Finder · {title} · {result['period']['label']}"))
        canvas.drawRightString(PAGE[0] - MARGIN - 6, 6 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(buffer, pagesize=PAGE, leftMargin=MARGIN, rightMargin=MARGIN,
                            topMargin=MARGIN, bottomMargin=MARGIN + 3 * mm,
                            title=_plain(title), author='Hornet Finder')
    story = [Paragraph(_safe(title), TITLE), _parameters_table(result), Spacer(0, 5 * mm)]
    story += _charts_flowables(result)
    story.append(_data_table(result))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()
