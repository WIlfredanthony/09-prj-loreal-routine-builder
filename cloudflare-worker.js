/*
 * Enhanced Cloudflare Worker for L'Oréal Routine Builder with Web Search
 * This worker handles OpenAI API requests with web search capabilities
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
    const {
      messages,
      max_tokens = 500,
      temperature = 0.7,
      web_search = false,
      include_citations = false,
    } = requestBody;

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

    /* Prepare the API request body */
    const apiRequestBody = {
      model: "gpt-4o",
      messages: messages,
      max_tokens: max_tokens,
      temperature: temperature,
    };

    /* Add web search tools if requested */
    if (web_search) {
      apiRequestBody.tools = [
        {
          type: "web_search",
        },
      ];
    }

    /* Make request to OpenAI API */
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`, // This comes from environment variables
        },
        body: JSON.stringify(apiRequestBody),
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
