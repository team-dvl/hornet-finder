"""
Printable A4 sheet of QR tags, as a PDF.

The QR code is drawn as vector rectangles, with the same logo plate as the
SVG rendering (`tags.logo_plate`), so a label prints sharp at its exact size
whatever the printer settings.
"""

import io

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .tags import QR_BORDER, logo_box, logo_plate, logo_png, qr_code, tag_caption, tag_url

COLUMNS = 4
ROWS = 6
CELL = 45 * mm
QR_SIDE = 36 * mm
CODE_FONT = ('Courier', 9)
CAPTION_FONT = ('Helvetica', 7)


def _draw_qr(pdf, url, x, y, logo):
    """Draw the QR code of `url` with its lower-left corner at `(x, y)`."""
    qr = qr_code(url)
    matrix = qr.matrix
    side = len(matrix) + 2 * QR_BORDER
    module = QR_SIDE / side
    top = y + QR_SIDE

    # One path for every module: no hairline seams between adjacent rectangles
    path = pdf.beginPath()
    for row_index, row in enumerate(matrix):
        row_y = top - (row_index + QR_BORDER + 1) * module
        col = 0
        while col < len(row):
            if not row[col] & 1:
                col += 1
                continue
            start = col
            while col < len(row) and row[col] & 1:
                col += 1
            path.rect(x + (start + QR_BORDER) * module, row_y, (col - start) * module, module)
    pdf.setFillColorRGB(0, 0, 0)
    pdf.drawPath(path, stroke=0, fill=1)

    offset, size = logo_plate(qr)
    plate_x = x + (offset + QR_BORDER) * module
    plate_y = top - (offset + QR_BORDER + size) * module
    pdf.setFillColorRGB(1, 1, 1)
    pdf.rect(plate_x, plate_y, size * module, size * module, stroke=0, fill=1)
    dx, dy, w, h = logo_box(size)
    pdf.drawImage(logo, plate_x + dx * module, plate_y + dy * module, w * module, h * module,
                  mask='auto')


def render_sheet(tags) -> bytes:
    """
    A4 sheets of 4 × 6 labels of 45 mm, with dashed cut lines. An attached
    tag gets its caption (e.g. "Piège #12") under the code.
    """
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle('QR Codes')
    page_width, page_height = A4
    left = (page_width - COLUMNS * CELL) / 2
    top = page_height - (page_height - ROWS * CELL) / 2
    per_page = COLUMNS * ROWS
    logo = ImageReader(io.BytesIO(logo_png()[0]))

    for index, tag in enumerate(tags):
        if index and index % per_page == 0:
            pdf.showPage()
        slot = index % per_page
        cell_x = left + (slot % COLUMNS) * CELL
        cell_y = top - (slot // COLUMNS + 1) * CELL

        pdf.setStrokeColorRGB(0.68, 0.71, 0.74)
        pdf.setLineWidth(0.3)
        pdf.setDash(2, 2)
        pdf.rect(cell_x, cell_y, CELL, CELL, stroke=1, fill=0)
        pdf.setDash()

        qr_x = cell_x + (CELL - QR_SIDE) / 2
        qr_y = cell_y + CELL - QR_SIDE - 1.5 * mm
        _draw_qr(pdf, tag_url(tag.value), qr_x, qr_y, logo)

        pdf.setFillColorRGB(0, 0, 0)
        pdf.setFont(*CODE_FONT)
        pdf.drawCentredString(cell_x + CELL / 2, cell_y + 4.2 * mm, tag.short)
        caption = tag_caption(tag)
        if caption:
            pdf.setFont(*CAPTION_FONT)
            pdf.drawCentredString(cell_x + CELL / 2, cell_y + 1.4 * mm, caption)

    pdf.save()
    return buffer.getvalue()
