// AI-powered field extraction using Claude
import Anthropic from '@anthropic-ai/sdk';

export interface AIExtractedData {
  patient: {
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    phone: string | null;
    gender: string | null;
  };
  referral: {
    referringPhysician: string | null;
    referringFacility: string | null;
    reasonForReferral: string | null;
  };
  confidence: number;
  rawAnalysis: string;
}

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function extractWithAI(ocrText: string): Promise<AIExtractedData> {
  // If no API key, return empty result
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY not set - AI extraction disabled');
    return {
      patient: {
        firstName: null,
        lastName: null,
        dateOfBirth: null,
        phone: null,
        gender: null,
      },
      referral: {
        referringPhysician: null,
        referringFacility: null,
        reasonForReferral: null,
      },
      confidence: 0,
      rawAnalysis: 'AI extraction disabled - no API key',
    };
  }

  const prompt = `You are analyzing OCR text from a medical referral letter. Extract the following information if present.

IMPORTANT: The text may have OCR errors. Use context clues to identify the correct information.

OCR TEXT:
"""
${ocrText}
"""

Extract and return a JSON object with this exact structure:
{
  "patient": {
    "firstName": "the patient's first/given name or null if not found",
    "lastName": "the patient's last/family name or null if not found",
    "dateOfBirth": "date of birth in YYYY-MM-DD format or null if not found",
    "phone": "phone number or null if not found",
    "gender": "male, female, or null if not found"
  },
  "referral": {
    "referringPhysician": "name of the referring doctor or null",
    "referringFacility": "hospital/clinic name or null",
    "reasonForReferral": "why the patient is being referred (brief summary) or null"
  },
  "confidence": 0.0 to 1.0 indicating how confident you are in the extraction
}

Common patterns in referral letters:
- "Re: [Patient Name]" at the top
- "Patient: [Name]"
- "DOB: [date]" or "Date of Birth: [date]"
- "Dear Dr. [Name]" indicates the receiving physician, NOT the referring one
- The signature/letterhead usually indicates the referring physician
- Look for patterns like "I am referring", "I would be grateful if you could see"

Return ONLY the JSON object, no other text.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract the text content
    const textContent = message.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    const responseText = textContent.text.trim();

    // Parse JSON from response - handle potential markdown code blocks
    let jsonStr = responseText;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonStr);

    return {
      patient: {
        firstName: parsed.patient?.firstName || null,
        lastName: parsed.patient?.lastName || null,
        dateOfBirth: parsed.patient?.dateOfBirth || null,
        phone: parsed.patient?.phone || null,
        gender: parsed.patient?.gender || null,
      },
      referral: {
        referringPhysician: parsed.referral?.referringPhysician || null,
        referringFacility: parsed.referral?.referringFacility || null,
        reasonForReferral: parsed.referral?.reasonForReferral || null,
      },
      confidence: parsed.confidence || 0.8,
      rawAnalysis: responseText,
    };
  } catch (error) {
    console.error('AI extraction error:', error);
    return {
      patient: {
        firstName: null,
        lastName: null,
        dateOfBirth: null,
        phone: null,
        gender: null,
      },
      referral: {
        referringPhysician: null,
        referringFacility: null,
        reasonForReferral: null,
      },
      confidence: 0,
      rawAnalysis: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
