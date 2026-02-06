import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractionRequest {
  imageBase64: string;
  templateId?: string;
  previousExtractions?: Array<{
    raw: string;
    corrected: Record<string, string>;
  }>;
}

const DEFAULT_FIELDS = [
  "client_name",
  "address",
  "phone",
  "email",
  "description",
  "date_intervention",
  "reference_bon",
  "access_code",
  "contact_name",
  "notes"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, templateId, previousExtractions } = await req.json() as ExtractionRequest;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "Image base64 data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build learning context from previous extractions
    let learningContext = "";
    if (previousExtractions && previousExtractions.length > 0) {
      learningContext = `
Based on previous corrections from the user, here are examples of how to extract data from similar documents:
${previousExtractions.slice(-5).map((ex, i) => `
Example ${i + 1}:
Raw text: "${ex.raw.substring(0, 500)}..."
Corrected extraction: ${JSON.stringify(ex.corrected)}
`).join("\n")}

Learn from these examples to improve your extraction accuracy.
`;
    }

    const systemPrompt = `You are an expert document analyzer specialized in extracting information from work orders ("bons de régie" / "vouchers") for electrical intervention companies in Switzerland.

Your task is to:
1. Read the document image carefully using OCR
2. Extract relevant fields for creating an intervention
3. Return structured data in JSON format

Fields to extract (if present):
- client_name: Client/company name
- address: Full intervention address
- phone: Phone number(s)
- email: Email address
- description: Work description / reason for intervention
- date_intervention: Planned date (format: YYYY-MM-DD if possible)
- reference_bon: Voucher/order reference number
- access_code: Access codes, intercom codes
- contact_name: On-site contact person
- notes: Any additional important notes

${learningContext}

Important:
- Extract text exactly as written, don't modify or translate
- If a field is not found, set it to null
- Be especially careful with Swiss addresses (postal codes, cantons)
- Look for common patterns: "N° Bon", "Réf.", "Client:", "Adresse:", etc.
- The document may be in French, German, or Italian`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this work order document and extract all relevant information for creating an intervention. Return the data as a JSON object."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") 
                    ? imageBase64 
                    : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_voucher_data",
              description: "Extract structured data from a work order voucher",
              parameters: {
                type: "object",
                properties: {
                  client_name: { type: "string", description: "Client or company name" },
                  address: { type: "string", description: "Full intervention address" },
                  phone: { type: "string", description: "Phone number" },
                  email: { type: "string", description: "Email address" },
                  description: { type: "string", description: "Work description" },
                  date_intervention: { type: "string", description: "Planned date" },
                  reference_bon: { type: "string", description: "Voucher reference" },
                  access_code: { type: "string", description: "Access/intercom codes" },
                  contact_name: { type: "string", description: "On-site contact" },
                  notes: { type: "string", description: "Additional notes" },
                  raw_text: { type: "string", description: "Full OCR text extracted from document" },
                  confidence: { type: "number", description: "Confidence score 0-100" }
                },
                required: ["raw_text"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_voucher_data" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "API credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    
    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== "extract_voucher_data") {
      throw new Error("Invalid AI response format");
    }

    const extractedData = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        raw_text: extractedData.raw_text,
        confidence: extractedData.confidence || 80
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Extraction error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown extraction error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
