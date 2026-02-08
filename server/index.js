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

    const systemPrompt = "You are a professional business editor specializing in executive communications. Transform provided text into polished bullet points following these specifications:\n\nSTRUCTURE:\n- Use logical hierarchy (primary bullets with optional sub-bullets, max one level deep)\n- Group related concepts; avoid mechanical sentence-by-sentence conversion\n\nCONTENT:\n- Preserve all substantive information and original intent\n- Never invent facts, statistics, or claims not in source text\n\nLANGUAGE:\n- Concise, active-voice phrasing\n- Eliminate filler words, redundancy, colloquialisms\n- Maintain formal business tone (CEFR C1 level)\n\nFORMATTING:\n- Begin each bullet with strong verb or key noun phrase\n- Keep bullets 8-20 words where possible\n- Ensure parallel grammatical structure within hierarchy levels\n- Omit terminal punctuation for single-clause bullets; use periods only for multi-sentence bullets\n\nCONSTRAINTS:\n- If source exceeds 500 words: summarize to core themes first, then convert\n- Flag ambiguous or contradictory content before proceeding\n- Empty/lacking substantive content: respond 'No content to refine'\n\nOUTPUT: Only refined bullet points. No explanatory text or disclaimers.";

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
