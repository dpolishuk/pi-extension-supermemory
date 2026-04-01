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
      containerTag: Type.Optional(Type.String({ description: "Optional container tag to search in" })),
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
          q: params.query,
          searchMode: params.searchMode || "hybrid",
          containerTags: [params.containerTag || config.containerTag || "pi-user"]
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
      containerTag: Type.Optional(Type.String({ description: "Optional container tag to add to" })),
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
          containerTag: params.containerTag || config.containerTag || "pi-user"
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
      })),
      containerTag: Type.Optional(Type.String({ description: "Optional container tag to add to" })),
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
          containerTag: params.containerTag || config.containerTag || "pi-user"
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

  pi.registerTool({
    name: "supermemory_list_documents",
    label: "Supermemory List Documents",
    description: "List documents in a Supermemory container.",
    parameters: Type.Object({
      containerTag: Type.Optional(Type.String({ description: "Optional container tag to filter by" })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const tag = params.containerTag || config.containerTag || "pi-user";
      const response = await fetch(`${config.apiUrl}/v3/documents?containerTag=${tag}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`
        },
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory list documents failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        details: { result: data }
      };
    }
  });

  pi.registerTool({
    name: "supermemory_delete_document",
    label: "Supermemory Delete Document",
    description: "Delete a document from Supermemory.",
    parameters: Type.Object({
      documentId: Type.String({ description: "ID of the document to delete" }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const response = await fetch(`${config.apiUrl}/v3/documents/${params.documentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`
        },
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory delete document failed: ${response.status} - ${error}`);
      }

      return {
        content: [{ type: "text", text: `Document ${params.documentId} deleted successfully.` }],
        details: {}
      };
    }
  });

  pi.registerTool({
    name: "supermemory_profile",
    label: "Supermemory Profile",
    description: "Retrieve both static and dynamic context (memories + profile) from Supermemory.",
    parameters: Type.Object({
      query: Type.String({ description: "The query to retrieve relevant profile information for" }),
      containerTag: Type.Optional(Type.String({ description: "Optional container tag to use" })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const response = await fetch(`${config.apiUrl}/v3/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({ 
          query: params.query,
          containerTag: params.containerTag || config.containerTag || "pi-user"
        }),
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory profile failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        details: { profile: data }
      };
    }
  });

  pi.registerTool({
    name: "supermemory_delete_memory",
    label: "Supermemory Delete Memory",
    description: "Delete a specific memory by its ID.",
    parameters: Type.Object({
      memoryId: Type.String({ description: "ID of the memory to delete" }),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const response = await fetch(`${config.apiUrl}/v4/memories/${params.memoryId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${config.apiKey}`
        },
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory delete memory failed: ${response.status} - ${error}`);
      }

      return {
        content: [{ type: "text", text: `Memory ${params.memoryId} deleted successfully.` }],
        details: {}
      };
    }
  });

  pi.registerTool({
    name: "supermemory_update_memory",
    label: "Supermemory Update Memory",
    description: "Update the content or metadata of an existing memory.",
    parameters: Type.Object({
      memoryId: Type.String({ description: "ID of the memory to update" }),
      content: Type.Optional(Type.String({ description: "New content for the memory" })),
      metadata: Type.Optional(Type.Object({}, { additionalProperties: true, description: "New metadata" })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (!config?.apiKey) {
        throw new Error("Supermemory API key not configured. Run /supermemory-setup first.");
      }

      const response = await fetch(`${config.apiUrl}/v4/memories/${params.memoryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({ 
          content: params.content,
          metadata: params.metadata
        }),
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Supermemory update memory failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return {
        content: [{ type: "text", text: `Memory ${params.memoryId} updated successfully.` }],
        details: { memory: data }
      };
    }
  });
}
