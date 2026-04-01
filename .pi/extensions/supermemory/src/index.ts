import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

const SuperMemoryConfig = Type.Object({
  apiKey: Type.String(),
  apiUrl: Type.Optional(Type.String({ default: "https://api.supermemory.ai" })),
  containerTag: Type.Optional(Type.String({ default: "pi-user" }))
});

type Config = Static<typeof SuperMemoryConfig>;

export default function(pi: ExtensionAPI) {
  let config: Config | null = null;

  function restoreConfig() {
    const entries = pi.getAllEntries ? pi.getAllEntries() : []; // Fallback if not directly available
    // Actually ExtensionAPI doesn't have getAllEntries, we use ctx.sessionManager in events
  }

  pi.on("session_start", async (_event, ctx) => {
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "custom" && entry.customType === "supermemory-config") {
        config = entry.data as Config;
      }
    }
  });

  pi.registerCommand("supermemory-setup", {
    description: "Setup Supermemory API key and container tag",
    handler: async (_args, ctx) => {
      const apiKey = await ctx.ui.input("Supermemory API Key", "Enter your API key from console.supermemory.ai", config?.apiKey || "");
      if (!apiKey) return;
      
      const containerTag = await ctx.ui.input("Container Tag", "Enter a container tag for your memories (e.g. pi-user)", config?.containerTag || "pi-user");
      
      config = { 
        apiKey, 
        apiUrl: config?.apiUrl || "https://api.supermemory.ai",
        containerTag: containerTag || "pi-user"
      };
      pi.appendEntry("supermemory-config", config);
      ctx.ui.notify("Supermemory configured!", "success");
    }
  });

  pi.registerTool({
    name: "supermemory_search",
    label: "Supermemory Search",
    description: "Search your Supermemory for relevant information using semantic/hybrid search.",
    parameters: Type.Object({
      query: Type.String({ description: "The search query" }),
      searchMode: Type.Optional(Type.Union([Type.Literal("semantic"), Type.Literal("hybrid")], { default: "hybrid" })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const response = await fetch(`${config.apiUrl}/v4/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({ 
          query: params.query,
          searchMode: params.searchMode || "hybrid",
          containerTags: [config.containerTag || "pi-user"]
        }),
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory search failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        details: { results: data }
      };
    }
  });

  pi.registerTool({
    name: "supermemory_add",
    label: "Supermemory Add",
    description: "Add a URL or text to Supermemory as a document.",
    parameters: Type.Object({
      content: Type.String({ description: "URL or text content to add" }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const response = await fetch(`${config.apiUrl}/v3/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({ 
          content: params.content,
          containerTag: config.containerTag || "pi-user"
        }),
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory add failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: `Successfully added to Supermemory (ID: ${data.id}, Status: ${data.status})` }],
        details: { result: data }
      };
    }
  });

  pi.registerTool({
    name: "supermemory_add_memory",
    label: "Supermemory Add Memory",
    description: "Create direct memories bypassing document ingestion.",
    parameters: Type.Object({
      memories: Type.Array(Type.Object({
        content: Type.String({ description: "Memory text" }),
        isStatic: Type.Optional(Type.Boolean({ description: "Mark as permanent trait" }))
      }))
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const response = await fetch(`${config.apiUrl}/v4/memories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({ 
          memories: params.memories,
          containerTag: config.containerTag || "pi-user"
        }),
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory add memory failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: `Successfully created ${data.memories?.length || 0} memories.` }],
        details: { result: data }
      };
    }
  });
}
