"""Detector das quatro classes de ocorrência, sobre um modelo YOLO treinado."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np

from .classes import CLASSES
from .semaforo import tem_lampada_acesa

RAIZ = Path(__file__).resolve().parent.parent
MODELO_PADRAO = RAIZ / "modelos" / "olho_na_via.pt"


@dataclass(frozen=True)
class Deteccao:
    classe: str  # chave em classes.CLASSES
    confianca: float  # 0 a 1
    caixa: tuple[int, int, int, int]  # x1, y1, x2, y2 em pixels

    @property
    def rotulo(self) -> str:
        return CLASSES[self.classe].rotulo


class Detector:
    def __init__(
        self,
        pesos: str | Path = MODELO_PADRAO,
        confianca: float = 0.35,
        iou: float = 0.5,
        tamanho: int = 768,  # mesmo tamanho do treino; semáforos distantes são objetos pequenos
        dispositivo: str | None = None,
    ):
        import torch
        from ultralytics import YOLO

        pesos = Path(pesos)
        if not pesos.exists():
            raise FileNotFoundError(
                f"Modelo não encontrado em {pesos}. Treine com treino/treinar.py ou informe outro arquivo."
            )
        self.modelo = YOLO(str(pesos))
        self.confianca = confianca
        self.iou = iou
        self.tamanho = tamanho
        self.dispositivo = dispositivo or ("cuda:0" if torch.cuda.is_available() else "cpu")
        # Só as classes de ocorrência saem do modelo; a auxiliar "semaforo_aceso" é ignorada.
        self._indices = {i: nome for i, nome in self.modelo.names.items() if nome in CLASSES}
        if not self._indices:
            raise ValueError(f"O modelo {pesos.name} não tem nenhuma das classes {list(CLASSES)}")

    def aquecer(self) -> None:
        """Roda uma inferência vazia para a primeira detecção real não pagar a inicialização."""
        self.detectar(np.zeros((self.tamanho, self.tamanho, 3), dtype=np.uint8))

    def detectar(
        self,
        quadro_bgr: np.ndarray,
        confianca: float | None = None,
        classes: Iterable[str] | None = None,
    ) -> list[Deteccao]:
        """Detecta ocorrências em um quadro BGR. ``classes`` restringe as classes devolvidas."""
        desejadas = set(CLASSES if classes is None else classes)
        indices = [i for i, nome in self._indices.items() if nome in desejadas]
        if not indices:
            return []
        resultado = self.modelo.predict(
            quadro_bgr,
            conf=self.confianca if confianca is None else confianca,
            iou=self.iou,
            imgsz=self.tamanho,
            classes=indices,
            device=self.dispositivo,
            verbose=False,
        )[0]

        deteccoes = []
        caixas = resultado.boxes
        for xyxy, conf, cls in zip(caixas.xyxy.tolist(), caixas.conf.tolist(), caixas.cls.tolist()):
            classe = self._indices[int(cls)]
            x1, y1, x2, y2 = (int(round(v)) for v in xyxy)
            if classe == "semaforo_apagado" and tem_lampada_acesa(quadro_bgr[y1:y2, x1:x2]):
                continue
            deteccoes.append(Deteccao(classe, float(conf), (x1, y1, x2, y2)))
        return deteccoes
