const captions = window.document.getElementById("captions");
const answer = window.document.getElementById("answer");
let totalTranscript = "";

async function AskToAi(question) {
  try {
    const response = await fetch("http://localhost:3000/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error("Erro ao Obter Resposta da IA");
    }

    const audioBlob = await response.blob();

    // Criar um URL temporário para o Blob de áudio
    const audioUrl = URL.createObjectURL(audioBlob);

    // Definir o src do player de áudio
    const audioPlayer = document.getElementById("audioPlayer");
    audioPlayer.src = audioUrl;
    audioPlayer.play();  // Reproduzir o áudio automaticamente

    // Exibir a resposta em texto (opcional)
    const respostaText = await response.text();
    answer.innerHTML = `<span>${respostaText}</span>`;

  } catch (error) {
    console.error("Erro ao perguntar para a IA:", error);
    answer.innerHTML = "<span>Erro ao processar a pergunta.</span>";
  }
}

async function getMicrophone() {
  const userMedia = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  return new MediaRecorder(userMedia);
}

async function openMicrophone(microphone, socket) {
  console.log(totalTranscript);
  await microphone.start(500);

  microphone.onstart = () => {
    console.log("client: microphone opened");
    document.body.classList.add("recording");
  };

  microphone.onstop = () => {
    console.log("client: microphone closed");
    document.body.classList.remove("recording");
  };

  microphone.ondataavailable = (e) => {
    const data = e.data;
    console.log("client: sent data to websocket");
    socket.send(data);
  };
}

async function closeMicrophone(microphone) {
  microphone.stop();
}

async function start(socket) {
  const listenButton = document.getElementById("record");
  let microphone;

  console.log("client: waiting to open microphone");

  listenButton.addEventListener("click", async () => {
    if (!microphone) {
      // open and close the microphone
      microphone = await getMicrophone();
      await openMicrophone(microphone, socket);
    } else {
      await closeMicrophone(microphone);
      microphone = undefined;
    }
  });
}

async function getTempApiKey() {
  const result = await fetch("/key");
  const json = await result.json();

  return json.key;
}

window.addEventListener("load", async () => {
  const key = await getTempApiKey();

  const { createClient } = deepgram;
  const _deepgram = createClient(key);

  const socket = _deepgram.listen.live({
    model: "base",
    language: "pt-BR",
    smart_format: true,
    punctuate: true,
  });

  socket.on("open", async () => {
    console.log("client: connected to websocket");

    socket.on("Results", async (data) => {
      console.log(data);

      const transcript = data.channel.alternatives[0].transcript;

      totalTranscript += " " + transcript;

      if (transcript !== "") {
        captions.innerHTML = transcript ? `<span>${transcript}</span>` : "";

        const respostaIA = await AskToAi(transcript);

        answer.innerHTML = respostaIA ? `<span>${respostaIA}</span>` : "";
      }
    });

    socket.on("error", (e) => console.error(e));

    socket.on("warning", (e) => console.warn(e));

    socket.on("Metadata", (e) => console.log(e));

    socket.on("close", (e) => console.log(e));

    await start(socket);
  });
});
