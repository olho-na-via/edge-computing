"""
Gera o PDF "Documentacao Tecnica - Edge - Olho na Via.pdf".

Cada <section class="pagina"> de documentacao.html vira uma página A4.
Antes de exportar, o script injeta a figura do circuito (figuras/circuito.svg)
e confere se algum conteúdo passou da página ou invadiu o rodapé.

Uso:
    python gerar_pdf.py            # gera o PDF
    python gerar_pdf.py --png      # também salva cada página em previews/pagina-NN.png

Requisitos (uma vez):
    pip install playwright
    python -m playwright install chromium
"""

import argparse
import pathlib
import sys

from playwright.sync_api import sync_playwright

PASTA = pathlib.Path(__file__).resolve().parent
HTML = PASTA / "documentacao.html"
FIGURA = PASTA / "figuras" / "circuito.svg"
PDF = PASTA.parent / "Documentacao Tecnica - Edge - Olho na Via.pdf"

VERIFICAR_JS = """
() => {
  const problemas = [];
  const mm = 96 / 25.4;
  document.querySelectorAll('.pagina').forEach((p, i) => {
    const r = p.getBoundingClientRect();
    const limite = p.classList.contains('capa') ? r.height : r.height - 17 * mm;
    p.querySelectorAll('*').forEach((el) => {
      if (el.closest('.topo, .rodape, svg')) return;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      if (b.bottom - r.top > limite + 1 || b.right - r.left > r.width + 1) {
        problemas.push(`página ${i + 1}: ${el.tagName.toLowerCase()} "${(el.innerText || '').trim().slice(0, 50)}" passa do limite (${Math.round(b.bottom - r.top)}px)`);
      }
    });
  });
  return [...new Set(problemas)];
}
"""


def main() -> int:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--png", action="store_true")
    args = ap.parse_args()

    svg = FIGURA.read_text(encoding="utf-8")
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        pagina = navegador.new_page(viewport={"width": 794, "height": 1123})
        pagina.goto(HTML.as_uri(), wait_until="load")
        pagina.wait_for_function("window.__pronto === true")
        pagina.evaluate("(s) => { document.getElementById('circuito').innerHTML = s; }", svg)
        pagina.evaluate("document.fonts.ready")

        problemas = pagina.evaluate(VERIFICAR_JS)
        if problemas:
            print(f"Atenção: {len(problemas)} possível(is) problema(s) de layout:")
            for linha in problemas:
                print("  -", linha)
        else:
            print("Verificação de layout: nenhum problema encontrado.")

        if args.png:
            pasta_png = PASTA / "previews"
            pasta_png.mkdir(exist_ok=True)
            secoes = pagina.locator(".pagina")
            for i in range(secoes.count()):
                secoes.nth(i).screenshot(path=str(pasta_png / f"pagina-{i + 1:02d}.png"))

        pagina.emulate_media(media="print")
        pagina.pdf(path=str(PDF), format="A4", print_background=True, prefer_css_page_size=True,
                   margin={"top": "0", "right": "0", "bottom": "0", "left": "0"})
        total = pagina.locator(".pagina").count()
        navegador.close()

    print(f"PDF gerado com {total} páginas: {PDF}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
