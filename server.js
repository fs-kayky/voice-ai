const express = require("express");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ElevenLabsClient } = require("elevenlabs");
const { createClient } = require("@deepgram/sdk");
const axios = require("axios");
const dotenv = require("dotenv");
const http = require("http");
dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const clientE = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

const app = express();
app.use(express.json());
const server = http.createServer(app);

const client = createClient(process.env.DEEPGRAM_API_KEY);

app.post("/voice", async (req, res) => {
  try {
    const userText = req.body.text;

    const responseText = "Qual o presidente do Brasil?"; // Substitua com a resposta do Gemini

    // 3️⃣ Converter resposta para áudio usando ElevenLabs
    const elevenLabsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        text: responseText,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
        },
      },
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer", // Vamos tratar o áudio como um buffer
      }
    );

    // 4️⃣ Enviar o áudio como resposta para o navegador
    res.set("Content-Type", "audio/mp3");
    res.send(elevenLabsResponse.data); // Envia o áudio diretamente
  } catch (error) {
    console.error("Erro:", error);
    res.status(500).json({ error: "Erro ao processar a solicitação." });
  }
});

app.use(express.static("public/"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

const getProjectId = async () => {
  const { result, error } = await client.manage.getProjects();

  if (error) {
    throw error;
  }

  return result.projects[0].project_id;
};

const getTempApiKey = async (projectId) => {
  const { result, error } = await client.manage.createProjectKey(projectId, {
    comment: "short lived",
    scopes: ["usage:write"],
    time_to_live_in_seconds: 20,
  });

  if (error) {
    throw error;
  }

  return result;
};

app.get("/key", async (req, res) => {
  const projectId = await getProjectId();
  const key = await getTempApiKey(projectId);

  res.json(key);
});

app.post("/ask", async (req, res) => {
  try {
    const userQuestion = req.body.question;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
    Você é um membro do Time de SAC da empresa Bagaggio. 
    Sua principal função é dar suporte aos profissionais em loja. 
    Responda de forma curta e direta, com linguagem fácil de compreender.

    Pergunta do usuário: "${userQuestion}"
  `;

    // Generate content with the AI model
    const result = await model.generateContent(prompt);
    const responseText = result.response; // Adjust this if the response structure is different

    // Call clientE's text-to-speech conversion method
    const audioStream = await clientE.textToSpeech.convert("XB0fDUnXU5powFXDhCwa", {
      output_format: "mp3_44100_128",
      text: responseText,
      model_id: "eleven_multilingual_v2",
    });

    // Handle the audio stream
    audioStream.on("data", (chunk) => {
      res.write(chunk);  // Write the audio chunk to the response
    });

    audioStream.on("end", () => {
      res.end();  // End the response once the stream is finished
    });

    audioStream.on("error", (err) => {
      console.error("Error streaming audio:", err);
      res.status(500).send("Erro ao processar áudio.");
    });

  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).send("ERRO AO BUSCAR RESPOSTA NO GPT-4!!");
  }
});

server.listen(3000, () => {
  console.log("listening on http://localhost:3000");
});
