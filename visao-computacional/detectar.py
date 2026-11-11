"""Olho na Via · detecção em janela nativa do OpenCV (webcam, imagem ou vídeo).

Exemplos:
    python detectar.py                       # webcam 0
    python detectar.py --fonte 1             # outra câmera
    python detectar.py --fonte rua.mp4 --salvar saidas/rua.mp4
    python detectar.py --fonte foto.jpg --salvar saidas/foto.jpg --sem-janela

Na janela: Q ou ESC para sair.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2

from olho_na_via import CLASSES, MODELO_PADRAO, Detector, MedidorFPS, desenhar

EXT_IMAGEM = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
JANELA = "Olho na Via"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--fonte", default="0", help="índice da webcam ou caminho de imagem/vídeo (padrão: 0)")
    p.add_argument("--modelo", default=str(MODELO_PADRAO), help="arquivo de pesos .pt")
    p.add_argument("--conf", type=float, default=0.35, help="confiança mínima (padrão: 0.35)")
    p.add_argument("--classes", nargs="+", choices=list(CLASSES), help="restringe as classes detectadas")
    p.add_argument("--dispositivo", help="cpu ou cuda:0 (padrão: GPU se houver)")
    p.add_argument("--salvar", help="caminho para gravar a imagem ou o vídeo anotado")
    p.add_argument("--sem-janela", action="store_true", help="não abre janela (útil com --salvar)")
    args = p.parse_args()

    detector = Detector(args.modelo, confianca=args.conf, dispositivo=args.dispositivo)
    detector.aquecer()
    print(f"Modelo: {Path(args.modelo).name} · dispositivo: {detector.dispositivo}")
    if args.salvar:
        Path(args.salvar).parent.mkdir(parents=True, exist_ok=True)

    if Path(args.fonte).suffix.lower() in EXT_IMAGEM:
        imagem = cv2.imread(args.fonte)
        if imagem is None:
            print(f"Não foi possível ler a imagem {args.fonte}", file=sys.stderr)
            return 1
        inicio = time.perf_counter()
        deteccoes = detector.detectar(imagem, classes=args.classes)
        anotada = desenhar(imagem, deteccoes, 1 / (time.perf_counter() - inicio))
        for d in deteccoes:
            print(f"  {d.rotulo}: {d.confianca:.1%} em {d.caixa}")
        if not deteccoes:
            print("  Nenhuma ocorrência detectada.")
        if args.salvar:
            cv2.imwrite(args.salvar, anotada)
        if not args.sem_janela:
            cv2.namedWindow(JANELA, cv2.WINDOW_NORMAL)
            cv2.imshow(JANELA, anotada)
            cv2.waitKey(0)
            cv2.destroyAllWindows()
        return 0

    if args.fonte.isdigit():
        captura = cv2.VideoCapture(int(args.fonte), cv2.CAP_DSHOW)
        if not captura.isOpened():
            captura = cv2.VideoCapture(int(args.fonte))
    else:
        captura = cv2.VideoCapture(args.fonte)
    if not captura.isOpened():
        print(f"Não foi possível abrir a fonte {args.fonte}", file=sys.stderr)
        return 1

    medidor = MedidorFPS()
    gravador = None
    quadros = 0
    if not args.sem_janela:
        cv2.namedWindow(JANELA, cv2.WINDOW_NORMAL)
    try:
        while True:
            ok, quadro = captura.read()
            if not ok:
                break
            deteccoes = detector.detectar(quadro, classes=args.classes)
            anotado = desenhar(quadro, deteccoes, medidor.marcar())
            quadros += 1
            if args.salvar:
                if gravador is None:
                    alt, larg = anotado.shape[:2]
                    taxa = captura.get(cv2.CAP_PROP_FPS) or 30
                    gravador = cv2.VideoWriter(args.salvar, cv2.VideoWriter_fourcc(*"mp4v"), taxa, (larg, alt))
                gravador.write(anotado)
            if not args.sem_janela:
                cv2.imshow(JANELA, anotado)
                if cv2.waitKey(1) & 0xFF in (ord("q"), 27):
                    break
    finally:
        captura.release()
        if gravador is not None:
            gravador.release()
        cv2.destroyAllWindows()
    print(f"{quadros} quadros processados · {medidor.fps:.1f} FPS médios recentes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
