"""As quatro classes de ocorrência que o Olho na Via detecta na via urbana."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Classe:
    rotulo: str  # nome exibido na interface
    rotulo_tela: str  # nome desenhado no quadro (as fontes do OpenCV não têm acentos)
    cor: tuple[int, int, int]  # BGR
    cor_texto: tuple[int, int, int]  # BGR


_BRANCO = (255, 255, 255)
_PRETO = (20, 20, 20)

# As chaves são os nomes das classes gravados no modelo treinado (treino/preparar_dataset.py).
CLASSES: dict[str, Classe] = {
    "buraco": Classe("Buraco / avaria no asfalto", "BURACO", (40, 60, 230), _BRANCO),
    "semaforo_apagado": Classe("Semáforo apagado", "SEMAFORO APAGADO", (0, 200, 255), _PRETO),
    "alagamento": Classe("Alagamento / água na pista", "ALAGAMENTO", (235, 150, 30), _BRANCO),
    "faixa_apagada": Classe("Faixa de pedestre apagada", "FAIXA APAGADA", (200, 70, 170), _BRANCO),
}

# Classe auxiliar usada só no treino: ensina o modelo a separar semáforo aceso de apagado.
CLASSE_SEMAFORO_ACESO = "semaforo_aceso"

# Ordem dos índices no dataset de treino.
NOMES_TREINO = [*CLASSES, CLASSE_SEMAFORO_ACESO]
