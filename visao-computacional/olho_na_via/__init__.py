"""Olho na Via · visão computacional para detecção de ocorrências na via urbana."""

from .classes import CLASSES
from .detector import MODELO_PADRAO, Deteccao, Detector
from .visual import MedidorFPS, desenhar

__all__ = ["CLASSES", "MODELO_PADRAO", "Deteccao", "Detector", "MedidorFPS", "desenhar"]
