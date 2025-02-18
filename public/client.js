const captions = window.document.getElementById("captions");
const answer = window.document.getElementById("answer");
let totalTranscript = "";

function AskToAi(question) {
  fetch("http://localhost:3000/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  })
    .then((res) => res.blob()) // Converte a resposta em um Blob (arquivo de áudio)
    .then((blob) => {
      const audioURL = URL.createObjectURL(blob); // Cria uma URL temporária do áudio
      const audioElement = new Audio(audioURL); // Cria um novo elemento de áudio
      audioElement.play(); // Reproduz o áudio
    })
    .catch((err) => console.error("Erro ao reproduzir áudio:", err));
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
