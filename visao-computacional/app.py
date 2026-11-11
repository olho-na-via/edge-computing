"""Olho na Via · interface web de detecção (webcam, imagem ou vídeo).

Uso:  streamlit run app.py
"""

from __future__ import annotations

import tempfile
import time
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import streamlit as st

from olho_na_via import CLASSES, MODELO_PADRAO, Detector, MedidorFPS, desenhar

st.set_page_config(page_title="Olho na Via · Visão Computacional", page_icon="🚦", layout="wide")


@st.cache_resource(show_spinner="Carregando o modelo...")
def carregar_detector() -> Detector:
    detector = Detector(MODELO_PADRAO)
    detector.aquecer()
    return detector


def tabela_deteccoes(deteccoes) -> list[dict]:
    return [
        {
            "Classe": d.rotulo,
            "Confiança": f"{d.confianca:.1%}",
            "Caixa (x1, y1, x2, y2)": ", ".join(map(str, d.caixa)),
        }
        for d in sorted(deteccoes, key=lambda d: -d.confianca)
    ]


def mostrar_resumo(alvo, contagem: Counter, legenda: str) -> None:
    """Uma métrica por classe; ``contagem`` usa as chaves de CLASSES."""
    with alvo.container():
        colunas = st.columns(len(CLASSES))
        for coluna, (chave, info) in zip(colunas, CLASSES.items()):
            coluna.metric(info.rotulo, contagem[chave])
        st.caption(legenda)


def processar_fluxo(captura: cv2.VideoCapture, detector: Detector, conf: float, classes: list[str],
                    gravar_em: Path | None = None) -> None:
    """Lê quadros de ``captura``, detecta e exibe em tempo real até o fluxo acabar."""
    tela = st.empty()
    resumo = st.empty()
    medidor = MedidorFPS()
    maximo = Counter()  # maior número de ocorrências simultâneas de cada classe
    gravador = None
    quadros = 0
    try:
        while True:
            ok, quadro = captura.read()
            if not ok:
                break
            deteccoes = detector.detectar(quadro, conf, classes)
            fps = medidor.marcar()
            anotado = desenhar(quadro, deteccoes, fps)
            quadros += 1

            if gravar_em is not None:
                if gravador is None:
                    alt, larg = anotado.shape[:2]
                    taxa = captura.get(cv2.CAP_PROP_FPS) or 30
                    gravador = cv2.VideoWriter(str(gravar_em), cv2.VideoWriter_fourcc(*"mp4v"), taxa, (larg, alt))
                gravador.write(anotado)

            atual = Counter(d.classe for d in deteccoes)
            for chave, n in atual.items():
                maximo[chave] = max(maximo[chave], n)
            tela.image(anotado, channels="BGR", width="stretch")
            mostrar_resumo(resumo, atual, f"Ocorrências no quadro atual · {fps:.1f} FPS · quadro {quadros}")
    finally:
        captura.release()
        if gravador is not None:
            gravador.release()
    if quadros:
        mostrar_resumo(resumo, maximo, f"Máximo de ocorrências simultâneas em {quadros} quadros processados")


st.title("Olho na Via · Detecção de ocorrências na via")
st.caption("Edge Computing & Computer Systems · visão computacional com YOLO")

if not MODELO_PADRAO.exists():
    st.error(f"Modelo não encontrado em `{MODELO_PADRAO}`. Veja o README para treinar ou obter os pesos.")
    st.stop()

detector = carregar_detector()

with st.sidebar:
    st.header("Configuração")
    fonte = st.radio("Fonte", ["Webcam", "Imagem", "Vídeo"])
    conf = st.slider("Confiança mínima", 0.05, 0.95, 0.35, 0.05)
    classes = st.multiselect(
        "Classes", list(CLASSES), default=list(CLASSES), format_func=lambda c: CLASSES[c].rotulo
    )
    st.caption(f"Processando em: **{detector.dispositivo}**")

if fonte == "Webcam":
    with st.sidebar:
        indice = st.number_input("Índice da câmera", 0, 10, 0)
    ligada = st.toggle("Ligar câmera")
    if ligada:
        # CAP_DSHOW abre a câmera bem mais rápido no Windows; nos outros sistemas usa o padrão.
        captura = cv2.VideoCapture(int(indice), cv2.CAP_DSHOW)
        if not captura.isOpened():
            captura = cv2.VideoCapture(int(indice))
        if not captura.isOpened():
            st.error(f"Não foi possível abrir a câmera {indice}. Verifique se outro programa a está usando.")
        else:
            processar_fluxo(captura, detector, conf, classes)
            st.warning("A câmera parou de enviar quadros.")
    else:
        st.info("Ative **Ligar câmera** para iniciar a detecção em tempo real.")

elif fonte == "Imagem":
    arquivo = st.file_uploader("Envie uma imagem", type=["jpg", "jpeg", "png", "bmp", "webp"])
    if arquivo:
        imagem = cv2.imdecode(np.frombuffer(arquivo.getvalue(), np.uint8), cv2.IMREAD_COLOR)
        if imagem is None:
            st.error("Não foi possível ler a imagem.")
        else:
            inicio = time.perf_counter()
            deteccoes = detector.detectar(imagem, conf, classes)
            duracao = time.perf_counter() - inicio
            anotada = desenhar(imagem, deteccoes, 1 / duracao)
            st.image(anotada, channels="BGR", width="stretch")
            mostrar_resumo(
                st.empty(),
                Counter(d.classe for d in deteccoes),
                f"Inferência em {duracao * 1000:.0f} ms ({1 / duracao:.1f} FPS)",
            )
            if deteccoes:
                st.dataframe(tabela_deteccoes(deteccoes), width="stretch", hide_index=True)
            else:
                st.info("Nenhuma ocorrência detectada com a confiança mínima atual.")
            ok, codificada = cv2.imencode(".jpg", anotada)
            if ok:
                st.download_button(
                    "Baixar imagem anotada", codificada.tobytes(), f"olho-na-via-{Path(arquivo.name).stem}.jpg",
                    "image/jpeg",
                )

else:
    arquivo = st.file_uploader("Envie um vídeo", type=["mp4", "avi", "mov", "mkv", "webm"])
    if arquivo:
        # O OpenCV só lê vídeo a partir de um caminho em disco.
        pasta = Path(tempfile.mkdtemp(prefix="olho-na-via-"))
        entrada = pasta / f"entrada{Path(arquivo.name).suffix}"
        entrada.write_bytes(arquivo.getvalue())
        saida = pasta / "anotado.mp4"
        if st.button("Processar vídeo", type="primary"):
            captura = cv2.VideoCapture(str(entrada))
            if not captura.isOpened():
                st.error("Não foi possível abrir o vídeo.")
            else:
                processar_fluxo(captura, detector, conf, classes, gravar_em=saida)
                if saida.exists():
                    st.download_button(
                        "Baixar vídeo anotado", saida.read_bytes(), f"olho-na-via-{Path(arquivo.name).stem}.mp4",
                        "video/mp4",
                    )
