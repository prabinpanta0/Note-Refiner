function buildChatRequestBody(userMessage, systemPrompt) {
    return {
        model: "qwen2.5:0.5b",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ],
        stream: true,
    };
}

async function fetchChatStream(userMessage, systemPrompt) {
    const res = await fetch("http://localhost:11434/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildChatRequestBody(userMessage, systemPrompt)),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

    if (!res.body) throw new Error("Ollama error: empty response body");

    return res;
}

async function* readLinesFromStream(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            yield line;
        }
    }
}

function tryExtractMessageContent(line) {
    if (!line.trim()) return null;

    try {
        const json = JSON.parse(line);
        return json.message?.content ?? null;
    } catch {
        /* skip heartbeat/keepalive lines */
        return null;
    }
}

export async function* generateStream(userMessage, systemPrompt) {
    const res = await fetchChatStream(userMessage, systemPrompt);

    for await (const line of readLinesFromStream(res.body)) {
        const content = tryExtractMessageContent(line);
        if (content) yield content;
    }
}
