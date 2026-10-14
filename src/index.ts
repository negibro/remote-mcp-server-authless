
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
}

function createServer(env: Env) {
  const server = new McpServer({
    name: "Cloudflare Image Generator",
    version: "1.0.0",
  });

  server.registerTool(
    "add",
    {
      description: "Add two numbers",
      inputSchema: {
        a: z.number(),
        b: z.number(),
      },
    },
    async ({ a, b }) => ({
      content: [{ type: "text", text: String(a + b) }],
    }),
  );

  server.registerTool(
    "generate_image",
    {
      description:
        "Generate an image from a text prompt using Cloudflare Workers AI FLUX.1 schnell.",
      inputSchema: {
        prompt: z.string().min(1).max(2048),
        steps: z.number().int().min(4).max(8).default(4),
      },
    },
    async ({ prompt, steps }) => {
      try {
        const url =
          "https://api.cloudflare.com/client/v4/accounts/" +
          env.CLOUDFLARE_ACCOUNT_ID +
          "/ai/run/@cf/black-forest-labs/flux-1-schnell";

        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt, steps }),
        });

        const result = (await response.json()) as {
          success?: boolean;
          result?: { image?: string };
          errors?: Array<{ message?: string }>;
        };

        if (!response.ok || !result.success || !result.result?.image) {
          const message =
            result.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
            `Cloudflare API error: HTTP ${response.status}`;

          return {
            content: [{ type: "text" as const, text: message }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "image" as const,
              data: result.result.image,
              mimeType: "image/jpeg",
            },
            {
              type: "text" as const,
              text: "Image generated successfully.",
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: "Image generation failed. Check your Cloudflare credentials and API access.",
            },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(() => createServer(env))(
      request,
      env,
      ctx,
    );
  },
} satisfies ExportedHandler<Env>;
