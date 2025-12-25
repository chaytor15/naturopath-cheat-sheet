/**
 * Deepgram WebSocket proxy for local dev / beta.
 *
 * Browser -> (this WS server) -> Deepgram realtime WS -> (this WS server) -> Browser
 *
 * Client sends raw 16-bit PCM little-endian (linear16) mono @ 16kHz as binary frames.
 * Client receives JSON messages:
 *  - { type: "partial" | "final", text: string }
 *  - { type: "info" | "error", message: string }
 *
 * ENV:
 *  - DEEPGRAM_API_KEY (required)
 *  - DEEPGRAM_WS_PORT (optional, default 3001)
 */

const WebSocket = require("ws");
const { URL } = require("url");

const PORT = Number(process.env.DEEPGRAM_WS_PORT || 3001);
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[deepgram-ws-proxy] Missing DEEPGRAM_API_KEY. Live transcription will not work."
  );
}

const wss = new WebSocket.Server({ port: PORT });

function safeSend(ws, obj) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(obj));
}

function buildDeepgramUrl(reqUrl) {
  const u = new URL(reqUrl, "http://localhost");
  const model = u.searchParams.get("model") || "nova-2";
  const language = u.searchParams.get("language") || "en";

  const dg = new URL("wss://api.deepgram.com/v1/listen");
  dg.searchParams.set("model", model);
  dg.searchParams.set("language", language);
  dg.searchParams.set("punctuate", "true");
  dg.searchParams.set("smart_format", "true");
  dg.searchParams.set("interim_results", "true");
  dg.searchParams.set("vad_events", "false");

  // Our client sends linear16 PCM @ 16kHz mono
  dg.searchParams.set("encoding", "linear16");
  dg.searchParams.set("sample_rate", "16000");
  dg.searchParams.set("channels", "1");

  return dg.toString();
}

wss.on("connection", (clientWs, req) => {
  const deepgramUrl = buildDeepgramUrl(req.url || "/");

  safeSend(clientWs, {
    type: "info",
    message: `Connected to proxy. Deepgram URL: ${deepgramUrl}`,
  });

  if (!DEEPGRAM_API_KEY) {
    safeSend(clientWs, {
      type: "error",
      message:
        "DEEPGRAM_API_KEY is not set on the server. Set it and restart dev server.",
    });
    clientWs.close();
    return;
  }

  const dgWs = new WebSocket(deepgramUrl, {
    headers: {
      Authorization: `Token ${DEEPGRAM_API_KEY}`,
    },
  });

  let dgOpen = false;
  const pendingAudio = [];

  dgWs.on("open", () => {
    dgOpen = true;
    safeSend(clientWs, { type: "info", message: "Deepgram connection open." });
    while (pendingAudio.length) {
      const chunk = pendingAudio.shift();
      try {
        dgWs.send(chunk);
      } catch {}
    }
  });

  dgWs.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString("utf8"));

      // Deepgram sends many message types; transcript is typically in:
      // msg.channel.alternatives[0].transcript
      const alt = msg?.channel?.alternatives?.[0];
      const transcript = alt?.transcript;
      if (typeof transcript !== "string") return;
      if (!transcript.trim()) return;

      const isFinal =
        msg?.is_final === true ||
        msg?.speech_final === true ||
        msg?.type === "Results" && msg?.is_final === true;

      safeSend(clientWs, {
        type: isFinal ? "final" : "partial",
        text: transcript,
      });
    } catch (e) {
      // ignore parse errors
    }
  });

  dgWs.on("error", (err) => {
    safeSend(clientWs, {
      type: "error",
      message: `Deepgram WS error: ${err?.message || String(err)}`,
    });
  });

  dgWs.on("close", () => {
    safeSend(clientWs, { type: "info", message: "Deepgram connection closed." });
  });

  clientWs.on("message", (data, isBinary) => {
    // We accept binary audio frames from browser.
    if (!isBinary) {
      // Potential control messages in future
      return;
    }

    if (dgWs.readyState !== WebSocket.OPEN || !dgOpen) {
      // Buffer a little to avoid dropping initial audio
      if (pendingAudio.length < 50) pendingAudio.push(data);
      return;
    }

    try {
      dgWs.send(data);
    } catch {}
  });

  clientWs.on("close", () => {
    try {
      dgWs.close();
    } catch {}
  });
});

// eslint-disable-next-line no-console
console.log(`[deepgram-ws-proxy] listening on ws://localhost:${PORT}`);




