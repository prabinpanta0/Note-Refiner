import cors from "cors";
import express from "express";
import { generateStream } from "./ollama-client.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/refine", async (req, res) => {
    const { text } = req.body;

    // Professional tip: Set headers for streaming immediately
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const systemPrompt = "You are a helpful assistant. Refine the following text into professional bullet points.";

    const stream = generateStream(text, systemPrompt);

    for await (const chunk of stream) {
        res.write(chunk);
    }

    res.end();
});

// Health check endpoint that verifies Ollama is reachable
app.get("/api/health", async (req, res) => {
    try {
        // quick probe to Ollama generate endpoint
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3000);

        const probe = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "qwen2.5:0.5b", prompt: "health-check", max_tokens: 1 }),
            signal: controller.signal,
        }).finally(() => clearTimeout(id));

        if (!probe.ok) return res.json({ ok: false, status: probe.status });
        return res.json({ ok: true });
    } catch (err) {
        return res.json({ ok: false, error: String(err) });
    }
});

app.listen(5000, () => console.log("Server running on http://localhost:5000"));
