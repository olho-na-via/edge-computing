"""Verificação por cor de que um semáforo está mesmo apagado.

O modelo aprende a classe "semáforo apagado", mas uma lâmpada acesa é um sinal
simples e confiável: uma mancha brilhante e saturada em vermelho, amarelo ou
verde. Se ela aparece dentro da caixa, a detecção de "apagado" é descartada.
"""

from __future__ import annotations

import cv2
import numpy as np

SATURACAO_MIN = 110
BRILHO_MIN = 190
# Fração mínima da caixa ocupada por pixels de lâmpada acesa.
FRACAO_ACESA = 0.03


def fracao_acesa(recorte_bgr: np.ndarray) -> float:
    """Fração dos pixels do recorte com cor de lâmpada acesa (vermelho, amarelo ou verde)."""
    if recorte_bgr.size == 0:
        return 0.0
    hsv = cv2.cvtColor(recorte_bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # Matiz no OpenCV vai de 0 a 179: vermelho/âmbar (0–35 e 160–179) e verde (40–100).
    # O azul do céu (100–130) fica de fora de propósito.
    matiz = (h <= 35) | (h >= 160) | ((h >= 40) & (h <= 100))
    acesos = matiz & (s >= SATURACAO_MIN) & (v >= BRILHO_MIN)
    return float(acesos.mean())


def tem_lampada_acesa(recorte_bgr: np.ndarray) -> bool:
    return fracao_acesa(recorte_bgr) >= FRACAO_ACESA
