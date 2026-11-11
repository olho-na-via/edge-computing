"""Monta o dataset YOLO do Olho na Via a partir dos .zip baixados por ``baixar_datasets.py``.

Lê as imagens direto dos .zip (sem extrair tudo) e grava em ``dados/olho_na_via/``
só o que interessa, já com as classes remapeadas:

    0 buraco            RDD2022: D40 (buraco) e D20 (trinca em malha / couro de jacaré)
    1 semaforo_apagado  S2TLD: classe "off"
    2 alagamento        City Risks: classe "puddle"
    3 faixa_apagada     RDD2022: D43 (faixa de pedestre desgastada)
    4 semaforo_aceso    S2TLD: vermelho, amarelo e verde (classe auxiliar, só para o treino)

Uso:  python treino/preparar_dataset.py
"""

from __future__ import annotations

import random
import shutil
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path, PurePosixPath

import yaml

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

from olho_na_via.classes import NOMES_TREINO  # noqa: E402

BRUTOS = RAIZ / "dados" / "brutos"
SAIDA = RAIZ / "dados" / "olho_na_via"

BURACO, SEMAFORO_APAGADO, ALAGAMENTO, FAIXA_APAGADA, SEMAFORO_ACESO = range(5)

SEMENTE = 42
FRACAO_VAL = 0.12

# RDD2022: código de dano -> classe.
RDD_CLASSES = {"D40": BURACO, "D20": BURACO, "D43": FAIXA_APAGADA}
# Imagens com estes códigos entram todas; as demais são amostradas.
RDD_PRIORITARIOS = {"D40", "D43"}
# Limites para o RDD não dominar o dataset.
RDD_MAX_SO_TRINCA = 1500  # imagens cujo único alvo é trinca em malha (D20)
RDD_MAX_NEGATIVAS = 800  # imagens de rua sem nenhum alvo (reduzem falsos positivos)

# S2TLD (Zenodo 7352960): índice original -> classe.
# 0 vermelho, 1 amarelo, 2 verde, 3 apagado. O índice 4 ("wait_on") é um painel de
# contagem regressiva, não um semáforo, e fica de fora.
S2TLD_CLASSES = {0: SEMAFORO_ACESO, 1: SEMAFORO_ACESO, 2: SEMAFORO_ACESO, 3: SEMAFORO_APAGADO}
S2TLD_MAX_SO_ACESO = 1500  # imagens sem nenhum semáforo apagado

# City Risks (Zenodo 6636723): índice original -> classe.
CITY_CLASSES = {6: ALAGAMENTO}

Caixa = tuple[int, float, float, float, float]  # classe, cx, cy, largura, altura (normalizados)

contagem_caixas: Counter = Counter()
contagem_imagens: Counter = Counter()


def gravar(divisao: str, nome: str, imagem: bytes, caixas: list[Caixa], fonte: str) -> None:
    (SAIDA / "images" / divisao / nome).write_bytes(imagem)
    linhas = [f"{c} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for c, cx, cy, w, h in caixas]
    (SAIDA / "labels" / divisao / Path(nome).with_suffix(".txt").name).write_text("\n".join(linhas))
    contagem_imagens[fonte, divisao] += 1
    for c, *_ in caixas:
        contagem_caixas[NOMES_TREINO[c], divisao] += 1


def caixas_rdd(xml: bytes) -> tuple[list[Caixa] | None, set[str]]:
    """Converte uma anotação Pascal VOC do RDD para YOLO, mantendo só as classes de interesse.

    Devolve as caixas e os códigos de dano de interesse presentes na imagem.
    """
    raiz = ET.fromstring(xml)
    larg = float(raiz.findtext("size/width") or 0)
    alt = float(raiz.findtext("size/height") or 0)
    if larg <= 0 or alt <= 0:
        return None, set()
    caixas, codigos = [], set()
    for obj in raiz.iter("object"):
        codigo = (obj.findtext("name") or "").strip()
        classe = RDD_CLASSES.get(codigo)
        if classe is None:
            continue
        codigos.add(codigo)
        x1, y1, x2, y2 = (float(obj.findtext(f"bndbox/{k}")) for k in ("xmin", "ymin", "xmax", "ymax"))
        x1, x2 = sorted((min(max(x1, 0), larg), min(max(x2, 0), larg)))
        y1, y2 = sorted((min(max(y1, 0), alt), min(max(y2, 0), alt)))
        if x2 - x1 < 2 or y2 - y1 < 2:
            continue
        caixas.append((classe, (x1 + x2) / 2 / larg, (y1 + y2) / 2 / alt, (x2 - x1) / larg, (y2 - y1) / alt))
    return caixas, codigos


def preparar_rdd(sorteio: random.Random) -> None:
    for pais in ("Japan", "India"):
        with zipfile.ZipFile(BRUTOS / "rdd2022" / f"{pais}.zip") as z:
            principais, so_trinca, negativas = [], [], []
            for nome in z.namelist():
                if not nome.endswith(".xml"):
                    continue
                caixas, codigos = caixas_rdd(z.read(nome))
                if caixas is None:
                    continue
                item = (nome, caixas)
                if not caixas:
                    negativas.append(item)
                elif RDD_PRIORITARIOS & codigos:
                    principais.append(item)
                else:
                    so_trinca.append(item)
            sorteio.shuffle(so_trinca)
            sorteio.shuffle(negativas)
            # Os limites valem para os dois países somados, divididos meio a meio.
            escolhidos = principais + so_trinca[: RDD_MAX_SO_TRINCA // 2] + negativas[: RDD_MAX_NEGATIVAS // 2]
            for nome_xml, caixas in escolhidos:
                base = PurePosixPath(nome_xml).stem
                imagem = z.read(f"{pais}/train/images/{base}.jpg")
                divisao = "val" if sorteio.random() < FRACAO_VAL else "train"
                gravar(divisao, f"rdd_{base}.jpg", imagem, caixas, f"RDD2022 {pais}")


def ler_yolo(texto: str, mapa: dict[int, int]) -> list[Caixa]:
    caixas = []
    for linha in texto.splitlines():
        partes = linha.split()
        if len(partes) < 5:
            continue
        classe = mapa.get(int(float(partes[0])))
        if classe is None:
            continue
        cx, cy, w, h = (float(v) for v in partes[1:5])
        caixas.append((classe, cx, cy, w, h))
    return caixas


def preparar_s2tld(sorteio: random.Random) -> None:
    with zipfile.ZipFile(BRUTOS / "s2tld" / "coco-s2tld.zip") as z:
        com_apagado, so_aceso = [], []
        for nome in z.namelist():
            if not nome.endswith(".txt"):
                continue
            caixas = ler_yolo(z.read(nome).decode(), S2TLD_CLASSES)
            if any(c == SEMAFORO_APAGADO for c, *_ in caixas):
                com_apagado.append((nome, caixas))
            elif caixas:
                so_aceso.append((nome, caixas))
        sorteio.shuffle(so_aceso)
        for nome_txt, caixas in com_apagado + so_aceso[:S2TLD_MAX_SO_ACESO]:
            # O S2TLD vem de sequências de vídeo: mantemos a divisão original para que
            # quadros vizinhos não caiam um no treino e outro na validação.
            origem = PurePosixPath(nome_txt).parent.name
            divisao = "train" if origem == "train" else "val"
            base = PurePosixPath(nome_txt).stem
            imagem = z.read(nome_txt.replace("/labels/", "/images/").replace(".txt", ".jpg"))
            gravar(divisao, f"s2tld_{origem}_{base}.jpg", imagem, caixas, "S2TLD")


def preparar_city_risks() -> None:
    with zipfile.ZipFile(BRUTOS / "city_risks" / "content.zip") as z:
        nomes = set(z.namelist())
        for nome_txt in sorted(nomes):
            if not nome_txt.endswith(".txt"):
                continue
            caixas = ler_yolo(z.read(nome_txt).decode(errors="ignore"), CITY_CLASSES)
            if not caixas:
                continue
            sem_extensao = nome_txt.replace("/labels/", "/images/")[: -len(".txt")]
            nome_img = next((sem_extensao + e for e in (".jpg", ".jpeg") if sem_extensao + e in nomes), None)
            if nome_img is None:
                continue
            origem = PurePosixPath(nome_txt).parent.name
            divisao = "train" if origem == "train" else "val"
            base = PurePosixPath(nome_txt).stem
            gravar(divisao, f"city_{origem}_{base}.jpg", z.read(nome_img), caixas, "City Risks")


def main() -> int:
    if SAIDA.exists():
        shutil.rmtree(SAIDA)
    for divisao in ("train", "val"):
        (SAIDA / "images" / divisao).mkdir(parents=True)
        (SAIDA / "labels" / divisao).mkdir(parents=True)

    sorteio = random.Random(SEMENTE)
    preparar_rdd(sorteio)
    preparar_s2tld(sorteio)
    preparar_city_risks()

    (SAIDA / "data.yaml").write_text(
        yaml.safe_dump(
            {
                "path": SAIDA.as_posix(),
                "train": "images/train",
                "val": "images/val",
                "names": dict(enumerate(NOMES_TREINO)),
            },
            sort_keys=False,
            allow_unicode=True,
        ),
        encoding="utf-8",
    )

    print("Imagens por fonte:")
    for (fonte, divisao), n in sorted(contagem_imagens.items()):
        print(f"  {fonte:<16} {divisao:<5} {n:>6}")
    print("Caixas por classe:")
    for nome in NOMES_TREINO:
        print(f"  {nome:<18} treino {contagem_caixas[nome, 'train']:>6}   validação {contagem_caixas[nome, 'val']:>5}")
    print(f"Dataset pronto em {SAIDA}. Próximo passo: python treino/treinar.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
