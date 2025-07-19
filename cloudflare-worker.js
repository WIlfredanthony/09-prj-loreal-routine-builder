/*
 * Cloudflare Worker for L'Oréal Routine Builder
 * This worker handles OpenAI API requests securely without exposing API keys to the client
 *
 * Instructions for students:
 * 1. Go to https://dash.cloudflare.com/
 * 2. Create a new Worker
 * 3. Copy this code into the Worker editor
 * 4. Add your OpenAI API key as an environment variable called OPENAI_API_KEY
 * 5. Deploy the Worker
 * 6. Update the WORKER_URL in your script.js file
 */

/* Handle incoming requests to the worker */
addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

/* Main function to handle all requests */
async function handleRequest(request) {
  /* Only allow POST requests */
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  /* Add CORS headers to allow requests from any domain */
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  /* Handle preflight requests for CORS */
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    /* Get the request body (messages from the client) */
    const requestBody = await request.json();

    /* Extract parameters from the request */
    const { messages, max_tokens = 500, temperature = 0.7 } = requestBody;

    /* Validate that we have messages */
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /* Make request to OpenAI API using the gpt-4o model */
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`, // This comes from environment variables
        },
        body: JSON.stringify({
          model: "gpt-4o", // Using the latest GPT-4 model as specified in instructions
          messages: messages,
          max_tokens: max_tokens,
          temperature: temperature,
        }),
      }
    );

    /* Get the response from OpenAI */
    const openaiData = await openaiResponse.json();

    /* Check if OpenAI request was successful */
    if (!openaiResponse.ok) {
      console.error("OpenAI API error:", openaiData);
      return new Response(
        JSON.stringify({ error: "Failed to get response from OpenAI" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /* Return the OpenAI response to the client with CORS headers */
    return new Response(JSON.stringify(openaiData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    /* Handle any errors that occur during processing */
    console.error("Worker error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
