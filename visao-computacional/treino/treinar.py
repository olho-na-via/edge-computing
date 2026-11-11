"""Treina o detector Olho na Via e copia os melhores pesos para ``modelos/olho_na_via.pt``.

Uso:  python treino/treinar.py [--epocas 30] [--base yolo11s.pt] [--lote 8]
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DATASET = RAIZ / "dados" / "olho_na_via" / "data.yaml"
DESTINO = RAIZ / "modelos" / "olho_na_via.pt"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base", default="yolo11s.pt", help="pesos pré-treinados de partida")
    p.add_argument("--epocas", type=int, default=30)
    p.add_argument("--tamanho", type=int, default=768)
    p.add_argument("--lote", type=int, default=8, help="reduza se faltar memória de GPU")
    p.add_argument("--nome", default="olho_na_via")
    p.add_argument("--continuar", action="store_true", help="retoma um treino interrompido")
    args = p.parse_args()

    from ultralytics import YOLO

    if not DATASET.exists():
        print(f"{DATASET} não existe. Rode antes treino/preparar_dataset.py", file=sys.stderr)
        return 1

    pasta = RAIZ / "runs" / args.nome
    if args.continuar:
        modelo = YOLO(str(pasta / "weights" / "last.pt"))
        # O lote pode mudar na retomada (útil se a GPU ficou sem memória).
        modelo.train(resume=True, batch=args.lote)
    else:
        modelo = YOLO(args.base)
        modelo.train(
            data=str(DATASET),
            epochs=args.epocas,
            imgsz=args.tamanho,
            batch=args.lote,
            workers=4,
            project=str(RAIZ / "runs"),
            name=args.nome,
            exist_ok=True,
            patience=15,
            cos_lr=True,
            # Semáforo aceso/apagado depende de cor e brilho: aumentação de cor mais contida
            # que o padrão, e sem espelhamento vertical (a via está sempre embaixo).
            hsv_h=0.01,
            hsv_s=0.4,
            hsv_v=0.3,
            flipud=0.0,
            plots=True,
        )

    melhor = pasta / "weights" / "best.pt"
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(melhor, DESTINO)
    print(f"Pesos copiados para {DESTINO}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
