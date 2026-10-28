# -*- coding: utf-8 -*-
"""SIGFCO - Manual Completo: base (fontes, paleta, estilos, auxiliares).

Plano de numeracao (report.md Step 3.5):
| Outline | Tipo    | Capitulo |
| 1       | cover   | -        |
| 2       | toc     | -        |
| 3..17   | content | Cap. 1..15 |
| 18      | content | Anexos A/B/C |
"""
import hashlib
import os
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily, stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak, HRFlowable, KeepTogether, PageBreak, Paragraph,
    Spacer, Table, TableStyle,
)

PDF_SKILL_DIR = '/home/z/my-project/skills/pdf'
_scripts = os.path.join(PDF_SKILL_DIR, 'scripts')
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

# ------------------------------------------------------------------ fontes
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                   italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

from pdf import install_font_fallback  # noqa: E402
install_font_fallback()

# ------------------------------------------------- paleta cascade (seed 26)
PAGE_BG = colors.HexColor('#f6f7f7')
SECTION_BG = colors.HexColor('#eeeff0')
CARD_BG = colors.HexColor('#e4e8e9')
TABLE_STRIPE = colors.HexColor('#ebedee')
HEADER_FILL = colors.HexColor('#446271')
COVER_BLOCK = colors.HexColor('#576c76')
BORDER = colors.HexColor('#bacbd3')
ICON = colors.HexColor('#366c86')
ACCENT = colors.HexColor('#378eb9')
ACCENT_2 = colors.HexColor('#c63950')
TEXT_PRIMARY = colors.HexColor('#1a1c1d')
TEXT_MUTED = colors.HexColor('#7b8285')
SEM_SUCCESS = colors.HexColor('#4a855e')
SEM_WARNING = colors.HexColor('#9d8554')
SEM_ERROR = colors.HexColor('#a54a42')
SEM_INFO = colors.HexColor('#4f769d')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = TABLE_STRIPE

# ------------------------------------------------------------ geometria
PAGE_W, PAGE_H = A4
MARGIN = 56.0
AVAIL = PAGE_W - 2 * MARGIN          # ~483 pt
AVAIL_H = PAGE_H - 2 * MARGIN
H1_THRESHOLD = AVAIL_H * 0.25
H2_THRESHOLD = 90.0

DOC_TITLE = 'SIGFCO - Manual Completo do Sistema (v1.0)'
DOC_AUTHOR = 'Filomeno Manuel Joaquim Alexandre'

# --------------------------------------------------------------- estilos
S = {}
S['body'] = ParagraphStyle('Body', fontName='FreeSerif', fontSize=10.5,
                           leading=16.5, alignment=TA_JUSTIFY,
                           textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=7)
S['lead'] = ParagraphStyle('Lead', parent=S['body'], fontSize=11, leading=17.5,
                           textColor=TEXT_PRIMARY, spaceAfter=9)
S['h1'] = ParagraphStyle('H1x', fontName='FreeSerif', fontSize=20, leading=25,
                         textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=4)
S['h2'] = ParagraphStyle('H2x', fontName='FreeSerif', fontSize=14, leading=18.5,
                         textColor=HEADER_FILL, spaceBefore=14, spaceAfter=5)
S['h3'] = ParagraphStyle('H3x', fontName='FreeSerif', fontSize=11.5, leading=15.5,
                         textColor=TEXT_PRIMARY, spaceBefore=10, spaceAfter=4)
S['bullet'] = ParagraphStyle('Bul', fontName='FreeSerif', fontSize=10.5,
                             leading=15.5, alignment=TA_LEFT, textColor=TEXT_PRIMARY,
                             leftIndent=16, bulletIndent=4, spaceAfter=4,
                             bulletFontName='FreeSerif')
S['num'] = ParagraphStyle('Num', parent=S['bullet'], leftIndent=20, bulletIndent=4,
                          bulletFontName='FreeSerif')
S['cell'] = ParagraphStyle('Cell', fontName='FreeSerif', fontSize=9,
                           leading=12.2, alignment=TA_LEFT, textColor=TEXT_PRIMARY)
S['cellc'] = ParagraphStyle('CellC', parent=S['cell'], alignment=TA_CENTER)
S['cellh'] = ParagraphStyle('CellH', fontName='FreeSerif', fontSize=9.2,
                            leading=12.2, alignment=TA_LEFT, textColor=colors.white)
S['cellhc'] = ParagraphStyle('CellHC', parent=S['cellh'], alignment=TA_CENTER)
S['caption'] = ParagraphStyle('Cap', fontName='FreeSerif', fontSize=8.5,
                              leading=11.5, alignment=TA_CENTER,
                              textColor=TEXT_MUTED, spaceBefore=0, spaceAfter=0)
S['callout'] = ParagraphStyle('Call', fontName='FreeSerif', fontSize=10,
                              leading=15, alignment=TA_LEFT, textColor=TEXT_PRIMARY)
S['mono'] = ParagraphStyle('Mono', fontName='DejaVuSans', fontSize=8.2,
                           leading=12, alignment=TA_LEFT, textColor=TEXT_PRIMARY)
S['toc0'] = ParagraphStyle('TOC0', fontName='FreeSerif', fontSize=11.5,
                           leading=17, leftIndent=6, textColor=TEXT_PRIMARY)
S['toc1'] = ParagraphStyle('TOC1', fontName='FreeSerif', fontSize=9.5,
                           leading=14, leftIndent=26, textColor=TEXT_MUTED)
S['toctitle'] = ParagraphStyle('TOCT', fontName='FreeSerif', fontSize=20,
                               leading=26, textColor=TEXT_PRIMARY, spaceAfter=14)

from reportlab.platypus import SimpleDocTemplate as _SDT  # noqa: E402
_ROMANOS = {1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi', 7: 'vii',
            8: 'viii', 9: 'ix', 10: 'x'}



# ------------------------------------------------------------- documento
_FIRST_CONTENT = {'page': None}


class ManualDoc(_SDT):
    def beforeDocument(self):
        # cada passada do multiBuild comeca do zero (evita latch entre passadas)
        _FIRST_CONTENT['page'] = None

    def afterPage(self):
        # decoracao desenhada no FIM da pagina: a essa altura o titulo do
        # Capitulo 1 ja fluio se estiver nesta pagina (numeracao estavel)
        _cabe(self.canv, self)
        _rodape(self.canv, self)

    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            if getattr(flowable, 'is_first_content', False) and _FIRST_CONTENT['page'] is None:
                _FIRST_CONTENT['page'] = self.page
            if _FIRST_CONTENT['page'] is not None and self.page >= _FIRST_CONTENT['page']:
                visivel = self.page - _FIRST_CONTENT['page'] + 1
            else:
                visivel = self.page
            self.notify('TOCEntry', (level, text, visivel, key))


def _cabe(canvas, doc):
    canvas.saveState()
    canvas.setFont('FreeSerif', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, PAGE_H - 40, 'SIGFCO - Manual Completo do Sistema')
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 40, 'Beira - 2026')
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.2)
    canvas.line(MARGIN, PAGE_H - 47, PAGE_W - MARGIN, PAGE_H - 47)
    canvas.restoreState()


def _rodape(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 44, PAGE_W - MARGIN, 44)
    canvas.setFont('FreeSerif', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN, 32, 'Filomeno Manuel Joaquim Alexandre')
    pagina = doc.page
    if _FIRST_CONTENT['page'] is not None and pagina >= _FIRST_CONTENT['page']:
        rotulo = str(pagina - _FIRST_CONTENT['page'] + 1)
    else:
        rotulo = _ROMANOS.get(pagina, str(pagina))
    canvas.drawRightString(PAGE_W - MARGIN, 32, rotulo)
    canvas.restoreState()


def _pagina(canvas, doc):
    _cabe(canvas, doc)
    _rodape(canvas, doc)


# -------------------------------------------------------------- auxiliares
def _mk_heading(texto, estilo, nivel, primeiro=False):
    key = 'h_' + hashlib.md5(texto.encode('utf-8')).hexdigest()[:8]
    p = Paragraph('<a name="%s"/><b>%s</b>' % (key, texto), estilo)
    p.bookmark_name = key
    p.bookmark_level = nivel
    p.bookmark_text = texto
    p.bookmark_key = key
    if primeiro:
        p.is_first_content = True
    return p


def h1(story, texto, primeiro=False):
    story.append(CondPageBreak(H1_THRESHOLD))
    story.append(_mk_heading(texto, S['h1'], 0, primeiro))
    story.append(HRFlowable(width='100%', color=ACCENT, thickness=1.2,
                            spaceBefore=2, spaceAfter=10))


def h2(story, texto):
    story.append(CondPageBreak(H2_THRESHOLD))
    story.append(_mk_heading(texto, S['h2'], 1))


def h3(story, texto):
    story.append(Paragraph('<b>%s</b>' % texto, S['h3']))


def p(story, texto, estilo='body'):
    story.append(Paragraph(texto, S[estilo]))


def bullets(story, itens):
    for it in itens:
        story.append(Paragraph('<bullet>•</bullet> %s' % it, S['bullet']))
    story.append(Spacer(1, 4))


def numerada(story, itens):
    for i, it in enumerate(itens, 1):
        story.append(Paragraph('<bullet><b>%d.</b></bullet> %s' % (i, it), S['num']))
    story.append(Spacer(1, 4))


def _celula(valor, estilo):
    if isinstance(valor, Paragraph):
        return valor
    return Paragraph(str(valor), estilo)


def tabela(story, dados, ratios, caption=None, centro=None, fonte=None,
           repete=1, continua=False):
    """Tabela segura: celulas em Paragraph, larguras <= AVAIL, centrada."""
    ncol = len(ratios)
    assert abs(sum(ratios) - 1.0) < 0.01, 'ratios devem somar 1.0'
    larguras = [r * AVAIL for r in ratios]
    assert sum(larguras) <= AVAIL + 0.5
    centro = centro or []
    estilo_cel = fonte or S['cell']
    estilo_hdr = S['cellhc'] if centro else S['cellh']
    matriz = []
    for i, linha in enumerate(dados):
        fila = []
        for j, val in enumerate(linha):
            if i == 0:
                fila.append(_celula('<b>%s</b>' % val,
                                    S['cellhc'] if j in centro else S['cellh']))
            else:
                est = S['cellc'] if j in centro else estilo_cel
                fila.append(_celula(val, est))
        matriz.append(fila)
    t = Table(matriz, colWidths=larguras, hAlign='CENTER', repeatRows=repete)
    estilo = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4.5),
    ]
    for i in range(1, len(matriz)):
        estilo.append(('BACKGROUND', (0, i), (-1, i),
                       TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD))
    t.setStyle(TableStyle(estilo))
    if continua:
        story.append(t)
        story.append(Spacer(1, 12))
    elif caption and len(matriz) <= 15:
        story.append(KeepTogether([Spacer(1, 10), t, Spacer(1, 5),
                                   Paragraph(caption, S['caption'])]))
        story.append(Spacer(1, 12))
    else:
        story.append(Spacer(1, 10))
        story.append(t)
        if caption:
            story.append(Spacer(1, 5))
            story.append(Paragraph(caption, S['caption']))
        story.append(Spacer(1, 12))


def caixa(story, texto, titulo=None):
    linhas = []
    if titulo:
        linhas.append(Paragraph('<b>%s</b>' % titulo, S['callout']))
    linhas.append(Paragraph(texto, S['callout']))
    t = Table([[linhas]], colWidths=[AVAIL * 0.97], hAlign='CENTER')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('LINEBEFORE', (0, 0), (0, -1), 3, ACCENT),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether([Spacer(1, 6), t]))
    story.append(Spacer(1, 10))


def alerta(story, texto, titulo=None):
    linhas = []
    if titulo:
        linhas.append(Paragraph('<b>%s</b>' % titulo, S['callout']))
    linhas.append(Paragraph(texto, S['callout']))
    t = Table([[linhas]], colWidths=[AVAIL * 0.97], hAlign='CENTER')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('LINEBEFORE', (0, 0), (0, -1), 3, SEM_ERROR),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether([Spacer(1, 6), t]))
    story.append(Spacer(1, 10))


def codigo(story, linhas):
    parags = [Paragraph(l if l else ' ', S['mono']) for l in linhas]
    t = Table([[parags]], colWidths=[AVAIL * 0.97], hAlign='CENTER')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SECTION_BG),
        ('LINEBEFORE', (0, 0), (0, -1), 2, ICON),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(KeepTogether([Spacer(1, 6), t]))
    story.append(Spacer(1, 8))


def PAUSE(story):
    story.append(Spacer(1, 6))
