"""Exporta o modelo treinado para ONNX, para rodar no navegador (simulador web).

O simulador (../simulador) carrega o arquivo com o onnxruntime-web e roda a detecção sobre
a câmera do celular. A entrada é menor que a do treino (768 px) para a inferência caber no
tempo de um celular; a supressão de caixas repetidas (NMS) é feita no próprio simulador.

Uso:
    python treino/exportar_onnx.py                 # 480 px, grava em ../simulador/static/modelos
    python treino/exportar_onnx.py --tamanho 640
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PESOS = RAIZ / "modelos" / "olho_na_via.pt"
DESTINO = RAIZ.parent / "simulador" / "static" / "modelos"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pesos", type=Path, default=PESOS)
    parser.add_argument("--tamanho", type=int, default=480, help="lado da imagem de entrada, múltiplo de 32")
    parser.add_argument("--destino", type=Path, default=DESTINO)
    args = parser.parse_args()

    from ultralytics import YOLO

    modelo = YOLO(str(args.pesos))
    exportado = Path(modelo.export(format="onnx", imgsz=args.tamanho, opset=17, simplify=True, dynamic=False, nms=False))

    args.destino.mkdir(parents=True, exist_ok=True)
    onnx = args.destino / "olho_na_via.onnx"
    shutil.move(str(exportado), onnx)

    # O simulador lê daqui o tamanho da entrada e a ordem das classes
    info = {"tamanho": args.tamanho, "classes": [modelo.names[i] for i in sorted(modelo.names)]}
    (args.destino / "olho_na_via.json").write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\nModelo: {onnx} ({onnx.stat().st_size / 1e6:.1f} MB)")
    print(f"Classes: {info['classes']} · entrada {args.tamanho} x {args.tamanho}")


if __name__ == "__main__":
    main()
