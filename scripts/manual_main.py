# -*- coding: utf-8 -*-
"""SIGFCO Manual Completo - montagem, build do corpo, capa e fusao final."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from manual_base import (ACCENT, ManualDoc, S, TEXT_MUTED, _pagina, PAUSE)
from reportlab.lib.pagesizes import A4
from reportlab.platypus import PageBreak, Paragraph, Spacer
from reportlab.platypus.tableofcontents import TableOfContents

import manual_cap01_03 as c13
import manual_cap04_07 as c47
import manual_cap08_12 as c812
import manual_cap13_anexos as c13a

BASE = os.path.dirname(os.path.abspath(__file__))
BODY_PDF = os.path.join(BASE, 'manual_body.pdf')
COVER_PDF = os.path.join(BASE, 'manual_cover.pdf')
COVER_HTML = os.path.join(BASE, 'manual_cover.html')
FINAL_PDF = '/home/z/my-project/download/SIGFCO_Manual_Completo_v1.0_Beira_2026.pdf'


def build_body():
    story = []
    story.append(Paragraph('<b>Índice</b>', S['toctitle']))
    toc = TableOfContents()
    toc.levelStyles = [S['toc0'], S['toc1']]
    toc.dotsMinLevel = 0
    story.append(toc)
    story.append(PageBreak())

    c13.cap1(story)
    c13.cap2(story)
    c13.cap3(story)
    c47.cap4(story)
    c47.cap5(story)
    c47.cap6(story)
    c47.cap7(story)
    c812.cap8(story)
    c812.cap9(story)
    c812.cap10(story)
    c812.cap11(story)
    c812.cap12(story)
    c13a.cap13(story)
    c13a.cap14(story)
    c13a.cap15(story)
    c13a.anexo_a(story)
    c13a.anexo_b(story)
    c13a.anexo_c(story)

    doc = ManualDoc(BODY_PDF, pagesize=A4,
                    leftMargin=56, rightMargin=56, topMargin=68, bottomMargin=60,
                    title='SIGFCO - Manual Completo do Sistema (v1.0)',
                    author='Filomeno Manuel Joaquim Alexandre',
                    creator='Z.ai',
                    subject='Manual completo do SIGFCO - Sistema Integrado de '
                            'Gestao de Frotas e Controlos Operacionais (Beira, 2026)')
    doc.multiBuild(story)
    print('body ok:', BODY_PDF)


def merge():
    from pypdf import PdfReader, PdfWriter

    A4_W, A4_H = 595.28, 841.89

    def norm(page):
        w, h = float(page.mediabox.width), float(page.mediabox.height)
        if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
            page.scale_to(A4_W, A4_H)
        return page

    writer = PdfWriter()
    writer.add_page(norm(PdfReader(COVER_PDF).pages[0]))
    for pg in PdfReader(BODY_PDF).pages:
        writer.add_page(norm(pg))
    writer.add_metadata({
        '/Title': 'SIGFCO - Manual Completo do Sistema v1.0',
        '/Author': 'Filomeno Manuel Joaquim Alexandre',
        '/Creator': 'Z.ai',
        '/Subject': 'Manual completo do SIGFCO - Sistema Integrado de Gestao de '
                    'Frotas e Controlos Operacionais. Beira, Mocambique, 2026.',
    })
    os.makedirs(os.path.dirname(FINAL_PDF), exist_ok=True)
    with open(FINAL_PDF, 'wb') as f:
        writer.write(f)
    n = len(PdfReader(FINAL_PDF).pages)
    print('final ok:', FINAL_PDF, '| paginas:', n)


if __name__ == '__main__':
    build_body()
    merge()
