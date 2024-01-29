#!/usr/bin/env bun

import {query} from "./chatgpt";
import {z} from "zod";

Promise.resolve().then(async () => {
    // Untyped - the type is optional, just for illustration
    const untyped: string = await query("Tell me a joke");
    console.log(untyped);

    /*
     * Output:
     *
     * Why don't skeletons fight each other?
     * They don't have the guts.
     */

    console.log("-".repeat(80));

    // Now the same again with types - again the explicit type is optional, the shape of the data is guided by the Zod schema
    const typed: { body: string, punchline: string } = await query(
        "Tell me a joke",
        {
            schema: z.object({
                body: z.string(),
                punchline: z.string(),
            })
        });

    console.log(JSON.stringify(typed, null, 2));

    /*
     * Output:
     *
     * {
     *   "body": "Why don't skeletons fight each other?",
     *   "punchline": "They don't have the guts."
     * }
     */
});