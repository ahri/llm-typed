const OPENAI_API_KEY_VAR_NAME = "OPENAI_API_KEY";
export const OPENAI_API_KEY = (() => {
    const keyFromEnv = process.env[OPENAI_API_KEY_VAR_NAME];
    if (!keyFromEnv) throw new Error(`Provide ${OPENAI_API_KEY_VAR_NAME} as an env var`);
    return keyFromEnv;
})();

export const REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_TEMPERATURE = 0;