import {z, ZodSchema} from "zod";
import {DEFAULT_TEMPERATURE, OPENAI_API_KEY, REQUEST_TIMEOUT_MS} from "./config";
import {zodToJsonSchema} from "zod-to-json-schema";

export type OpenAiRequestConfig = {
    model: string,
    response_format?: {type: "json_object"},

    frequency_penalty?: number, // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.

    // Either
    temperature?: number, // Default: 1. What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.
    top_p?: number, // Default: 1. An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered.

    // tools: see https://platform.openai.com/docs/assistants/tools/function-calling
};

const DEFAULT_REQUEST_CONFIG: OpenAiRequestConfig = {
    model: "gpt-4-1106-preview",
    temperature: DEFAULT_TEMPERATURE,
};

const messageSystemSchema = z.object({
    role: z.literal("system"),
    content: z.string(),
});

const messageSchema = z.discriminatedUnion("role", [
    messageSystemSchema,
    z.object({
        role: z.literal("assistant"),
        content: z.string(),
        tool_calls: z.string().optional(),
    }),
    z.object({
        role: z.literal("tool"),
        content: z.string(),
    }),
    z.object({
        role: z.literal("user"),
        content: z.string(),
    }),
]);

type Message = z.infer<typeof messageSchema>;

const usageSchema = z.object({
    completion_tokens: z.number(),
    prompt_tokens: z.number(),
    total_tokens: z.number(),
});

const responseSchema = z.object({
    id: z.string(),
    model: z.string(),
    object: z.literal("chat.completion"),
    choices: z.array(z.object({
        message: messageSchema,
        finish_reason: z.union([
            z.literal("stop"),
            z.literal("length"),
            z.literal("content_filter"),
            z.literal("tool_calls")
        ]),
    })),
    usage: usageSchema,
});

type Response = z.infer<typeof responseSchema>;

export async function query<T = string>(userPrompt: string, config?: { systemPrompt?: string, openAiConfig?: Partial<OpenAiRequestConfig>, schema?: ZodSchema<T> }): Promise<T> {
    const schema = config?.schema;
    const systemPrompt = config?.systemPrompt;

    const messages: Message[] = [];

    if (schema) {
        messages.push({role: "system", content: `Only provide responses in valid JSON in terms of ${JSON.stringify(zodToJsonSchema(schema))}.`});
    }

    if (systemPrompt) {
        messages.push({role: "system", content: systemPrompt});
    }

    messages.push({role: "user", content: userPrompt});

    const response = await send(
        {...DEFAULT_REQUEST_CONFIG, ...(config?.schema ? {response_format: {type: "json_object"}} : {}), ...(config?.openAiConfig)},
        ...messages
    );

    const choice = response.choices[0]!;

    if (choice.finish_reason !== "stop") {
        console.warn(`Unexpected finish reason: ${choice.finish_reason}`);
    }

    const content = choice.message.content;

    try {
        return schema
            ? schema.parse(JSON.parse(content))
            : content as T;
    } catch (e) {
        try {
            console.error(`Could not parse: ${JSON.stringify(JSON.parse(content), null, 2)}`);
        } catch (_e) {
            console.error(`Could not parse: ${content}`);
        }
        process.exit(1);
    }
}

async function send(config: OpenAiRequestConfig, ...messages: Message[]): Promise<Response> {
    return fetch(
        "https://api.openai.com/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                ...config,
                messages,
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            // verbose: true,
        }
    )
        .then(res => res.json())
        .then(json => {
            if (json["error"]) {
                throw new OpenAiError(JSON.stringify(json));
            }
            return responseSchema.parse(json)
        })
        ;
}

class OpenAiError extends Error {}