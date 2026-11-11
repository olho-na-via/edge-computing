"""Sobreposição visual: caixas delimitadoras, rótulos, confiança, FPS e contagem."""

from __future__ import annotations

import time
from collections import Counter
from typing import Iterable

import cv2
import numpy as np

from .classes import CLASSES
from .detector import Deteccao

FONTE = cv2.FONT_HERSHEY_SIMPLEX
BRANCO = (255, 255, 255)
PRETO = (20, 20, 20)
VERDE_MARCA = (120, 200, 60)


class MedidorFPS:
    """FPS com média móvel exponencial, para o número não ficar piscando na tela."""

    def __init__(self, suavizacao: float = 0.9):
        self.suavizacao = suavizacao
        self.fps = 0.0
        self._anterior: float | None = None

    def marcar(self) -> float:
        agora = time.perf_counter()
        if self._anterior is not None:
            intervalo = agora - self._anterior
            if intervalo > 0:
                instantaneo = 1.0 / intervalo
                self.fps = (
                    instantaneo
                    if self.fps == 0
                    else self.suavizacao * self.fps + (1 - self.suavizacao) * instantaneo
                )
        self._anterior = agora
        return self.fps


def _escala(quadro: np.ndarray) -> float:
    return max(0.45, min(quadro.shape[:2]) / 720)


def _texto_com_fundo(quadro, texto, origem, cor_fundo, escala, cor_texto=BRANCO) -> int:
    """Escreve ``texto`` sobre uma tarja; ``origem`` é o canto superior esquerdo. Devolve a altura."""
    espessura = max(1, round(escala * 2))
    (larg, alt), base = cv2.getTextSize(texto, FONTE, escala * 0.6, espessura)
    margem = round(6 * escala)
    x, y = origem
    x = max(0, min(x, quadro.shape[1] - larg - 2 * margem))
    y = max(0, min(y, quadro.shape[0] - alt - base - 2 * margem))
    cv2.rectangle(quadro, (x, y), (x + larg + 2 * margem, y + alt + base + 2 * margem), cor_fundo, -1)
    cv2.putText(
        quadro, texto, (x + margem, y + margem + alt), FONTE, escala * 0.6, cor_texto, espessura, cv2.LINE_AA
    )
    return alt + base + 2 * margem


def desenhar(
    quadro: np.ndarray,
    deteccoes: Iterable[Deteccao],
    fps: float | None = None,
    mostrar_contagem: bool = True,
) -> np.ndarray:
    """Devolve uma cópia de ``quadro`` (BGR) com as detecções e os indicadores desenhados."""
    saida = quadro.copy()
    escala = _escala(saida)
    espessura = max(2, round(3 * escala))
    deteccoes = list(deteccoes)

    for d in deteccoes:
        info = CLASSES[d.classe]
        x1, y1, x2, y2 = d.caixa
        cv2.rectangle(saida, (x1, y1), (x2, y2), info.cor, espessura)
        rotulo = f"{info.rotulo_tela} {d.confianca:.0%}"
        (_, alt), base = cv2.getTextSize(rotulo, FONTE, escala * 0.6, max(1, round(escala * 2)))
        altura_tarja = alt + base + 2 * round(6 * escala)
        # A tarja fica acima da caixa; se não couber, vai para dentro dela.
        y_tarja = y1 - altura_tarja if y1 - altura_tarja >= 0 else y1
        _texto_com_fundo(saida, rotulo, (x1 - espessura // 2, y_tarja), info.cor, escala, info.cor_texto)

    y = round(10 * escala)
    x = round(10 * escala)
    if fps is not None:
        y += _texto_com_fundo(saida, f"FPS {fps:5.1f}", (x, y), PRETO, escala * 1.2, VERDE_MARCA)
        y += round(4 * escala)
    if mostrar_contagem:
        contagem = Counter(d.classe for d in deteccoes)
        for chave, info in CLASSES.items():
            if contagem[chave]:
                y += _texto_com_fundo(
                    saida, f"{info.rotulo_tela}: {contagem[chave]}", (x, y), info.cor, escala, info.cor_texto
                )
    return saida
