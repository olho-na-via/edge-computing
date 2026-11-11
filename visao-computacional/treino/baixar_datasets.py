"""Baixa os datasets públicos usados no treino do detector Olho na Via.

Nenhuma fonte exige conta ou chave de API. Cada arquivo vai para uma pasta
própria em ``dados/brutos/`` e é lido direto do .zip por ``preparar_dataset.py``.

Fontes (todas CC BY 4.0):
  - RDD2022 (figshare 38030910): buracos (D40) e faixas de pedestre apagadas (D43).
    O arquivo completo tem 13 GB; como os .zip de cada país estão armazenados sem
    compressão dentro dele, baixamos só os países necessários via HTTP Range.
  - S2TLD (Zenodo 7352960): semáforos, incluindo a classe "apagado".
  - City Risks (Zenodo 6636723): poças / acúmulo de água na via.

Uso:  python treino/baixar_datasets.py
"""

from __future__ import annotations

import struct
import sys
import zipfile
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
BRUTOS = RAIZ / "dados" / "brutos"

RDD_URL = "https://ndownloader.figshare.com/files/38030910"
RDD_PAISES = ("Japan", "India")

DIRETOS = {
    "s2tld/coco-s2tld.zip": "https://zenodo.org/api/records/7352960/files/coco-s2tld.zip/content",
    "city_risks/content.zip": "https://zenodo.org/api/records/6636723/files/content.zip/content",
    "city_risks/dataset.yaml": "https://zenodo.org/api/records/6636723/files/dataset.yaml/content",
}

CABECALHOS = {"User-Agent": "python-requests"}
BLOCO = 1 << 20


def _transmitir(url: str, destino: Path, inicio: int | None = None, tamanho: int | None = None) -> None:
    """Baixa ``url`` (ou um intervalo de bytes dela) para ``destino``."""
    cabecalhos = dict(CABECALHOS)
    if inicio is not None:
        cabecalhos["Range"] = f"bytes={inicio}-{inicio + tamanho - 1}"
    destino.parent.mkdir(parents=True, exist_ok=True)
    parcial = destino.with_suffix(destino.suffix + ".parcial")
    with requests.get(url, headers=cabecalhos, stream=True, timeout=120) as r:
        r.raise_for_status()
        if inicio is not None and r.status_code != 206:
            raise RuntimeError("o servidor ignorou o cabeçalho Range")
        total = tamanho or int(r.headers.get("Content-Length", 0))
        baixado, proximo_aviso = 0, 0
        with open(parcial, "wb") as f:
            for bloco in r.iter_content(BLOCO):
                f.write(bloco)
                baixado += len(bloco)
                if baixado >= proximo_aviso:
                    pct = f"{100 * baixado / total:5.1f}%" if total else ""
                    print(f"    {destino.name}: {baixado / 1e6:8.0f} MB {pct}", flush=True)
                    proximo_aviso += 100 * BLOCO
    if total and baixado != total:
        raise RuntimeError(f"download incompleto de {destino.name}: {baixado} de {total} bytes")
    parcial.replace(destino)


class _ArquivoHttp:
    """Arquivo somente-leitura sobre HTTP Range, suficiente para o zipfile ler o índice."""

    def __init__(self, url: str):
        self.url = url
        r = requests.get(url, headers={**CABECALHOS, "Range": "bytes=0-0"}, timeout=120)
        r.raise_for_status()
        self.tamanho = int(r.headers["Content-Range"].split("/")[1])
        self.pos = 0

    def seekable(self) -> bool:
        return True

    def tell(self) -> int:
        return self.pos

    def seek(self, deslocamento: int, origem: int = 0) -> int:
        base = {0: 0, 1: self.pos, 2: self.tamanho}[origem]
        self.pos = base + deslocamento
        return self.pos

    def read(self, n: int = -1) -> bytes:
        fim = self.tamanho if n < 0 else min(self.pos + n, self.tamanho)
        if fim <= self.pos:
            return b""
        r = requests.get(
            self.url, headers={**CABECALHOS, "Range": f"bytes={self.pos}-{fim - 1}"}, timeout=120
        )
        r.raise_for_status()
        self.pos += len(r.content)
        return r.content


def baixar_rdd() -> None:
    faltando = [p for p in RDD_PAISES if not (BRUTOS / "rdd2022" / f"{p}.zip").exists()]
    if not faltando:
        print("RDD2022: já baixado")
        return
    print("RDD2022: lendo o índice do arquivo remoto...")
    remoto = _ArquivoHttp(RDD_URL)
    with zipfile.ZipFile(remoto) as z:
        entradas = {Path(i.filename).name: i for i in z.infolist()}
    for pais in faltando:
        info = entradas[f"{pais}.zip"]
        if info.compress_type != zipfile.ZIP_STORED:
            raise RuntimeError(f"{pais}.zip está comprimido no arquivo externo; baixe o RDD2022 completo")
        remoto.seek(info.header_offset)
        cab = remoto.read(30)
        tam_nome, tam_extra = struct.unpack("<HH", cab[26:30])
        inicio = info.header_offset + 30 + tam_nome + tam_extra
        destino = BRUTOS / "rdd2022" / f"{pais}.zip"
        print(f"RDD2022: baixando {pais}.zip ({info.file_size / 1e6:.0f} MB)")
        _transmitir(RDD_URL, destino, inicio, info.file_size)
        if not zipfile.is_zipfile(destino):
            destino.unlink()
            raise RuntimeError(f"{pais}.zip chegou corrompido")


def baixar_diretos() -> None:
    for relativo, url in DIRETOS.items():
        destino = BRUTOS / relativo
        if destino.exists():
            print(f"{relativo}: já baixado")
            continue
        print(f"{relativo}: baixando")
        _transmitir(url, destino)


def main() -> int:
    baixar_diretos()
    baixar_rdd()
    print("Concluído. Próximo passo: python treino/preparar_dataset.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
