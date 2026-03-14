import OpenAI from "openai";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface LocationSettings {
  brand_voice?: string | null;
  positive_sentiment?: string | null;
  negative_sentiment?: string | null;
  neutral_sentiment?: string | null;
  signature?: string | null;
  reply_language?: string | null;
  negative_contact_email?: string | null;
  location_id?: string;
}

export interface ReviewData {
  id?: string;
  rating: number;
  comment: string | null;
  reviewer_name?: string | null;
  review_date?: string | null;
}

const SYSTEM_PROMPT = `You are a review reply writer for a local business. Your tone, personality, and style come ENTIRELY from the brand voice provided by the user. Do not impose your own tone. If no brand voice is provided, default to warm and professional.

STRUCTURAL RULES (apply these invisibly regardless of brand voice):
- For detailed reviews (3+ sentences from the reviewer), write a proportionally substantive reply that addresses their key points.
- If the reviewer left a short review or just a rating, keep the reply concise and gracious.
- If the brand voice includes a signature, end the reply with it naturally as a sign-off.

SEO (apply naturally, never force):
- Do not keyword-stuff. If there is no natural place for it, skip it.

HARD CONSTRAINTS:
- NEVER use em dashes (—). Use commas, periods, or semicolons instead. Don't overuse commas. Keep it casual and human. 
- NEVER start with "Dear [Name]". Use their first name naturally in the greeting (e.g., "Hi Sarah," or "Sarah! thank you..."). Don't use the full name (i.e. if Sarah S. leaves a review, just use Sarah)
- NEVER use these phrases: "valued customer", "we strive to"
- For negative reviews: NEVER repeat the reviewer's negative language back to them verbatim. Acknowledge the concern in your own words.
- NEVER make unverifiable promises like "we've already fixed this" or "this won't happen again".
- Vary your opening phrases. Do not start every reply with "Thank you for...".
- Output ONLY the reply text. No labels, no quotation marks wrapping the reply, no preamble.
- The review MUST be good to go out of the box, the user MUST not need to input their name etc.`;

const DEFAULT_SENTIMENTS = {
  positive:
    "Express genuine appreciation, reference what went well specifically, and warmly encourage them to return.",
  neutral:
    "Acknowledge the mixed experience with empathy. Highlight what went well, briefly address what could improve without being defensive, and invite them to give you another chance.",
  negative:
    "Acknowledge the concern with empathy and without being defensive. Offer to resolve the issue offline (phone or email if available). Keep it brief, sincere, and solution-focused.",
};

const FEW_SHOT_POSITIVE = {
  review: {
    rating: 5,
    comment:
      "Amazing service! The team was super helpful and got everything done quickly.",
    reviewer_name: "Jessica",
  },
  reply:
    "Hi Jessica, so glad to hear the team took great care of you. Quick and thorough is exactly what we aim for. Hope to see you again soon!",
};

const FEW_SHOT_NEGATIVE = {
  review: {
    rating: 2,
    comment:
      "Had to wait 45 minutes past my appointment time. Staff seemed disorganized.",
    reviewer_name: "Tom",
  },
  reply:
    "Tom, we understand how frustrating a long wait can be, and that is not the experience we want for you. We would love the chance to make this right. Please reach out to us directly so we can look into what happened.",
};

const FEW_SHOT_NEUTRAL = {
  review: {
    rating: 3,
    comment:
      "Food was good but the service was slow. Might come back to give it another try.",
    reviewer_name: "Alex",
  },
  reply:
    "Alex, happy to hear you enjoyed the food. We hear you on the wait, and we are working on improving our service speed. We would love for you to come back and see the difference.",
};

/**
 * Helper to fetch recent replies for this location to ensure variety.
 * Prioritizes posted replies (what's actually live on Google), then fills with drafts.
 */
async function getRecentReplies(
  locationId?: string,
  currentReviewId?: string,
): Promise<string[]> {
  if (!locationId) return [];
  try {
    const client = createSupabaseServiceRoleClient();

    // First get posted replies (what's actually live on Google)
    let postedQuery = client
      .schema("app")
      .from("google_reviews")
      .select("reply_text")
      .eq("location_id", locationId)
      .eq("reply_status", "posted")
      .not("reply_text", "is", null)
      .order("replied_at", { ascending: false })
      .limit(5);

    if (currentReviewId) {
      postedQuery = postedQuery.neq("id", currentReviewId);
    }

    const { data: postedData } = await postedQuery;
    const posted =
      (postedData?.map((r) => r.reply_text).filter(Boolean) as string[]) || [];

    // If we have fewer than 5 posted, fill with drafts
    if (posted.length < 5) {
      let draftQuery = client
        .schema("app")
        .from("google_reviews")
        .select("draft_text")
        .eq("location_id", locationId)
        .not("draft_text", "is", null)
        .neq("reply_status", "posted")
        .order("draft_updated_at", { ascending: false })
        .limit(5 - posted.length);

      if (currentReviewId) {
        draftQuery = draftQuery.neq("id", currentReviewId);
      }

      const { data: draftData } = await draftQuery;
      const drafts =
        (draftData?.map((r) => r.draft_text).filter(Boolean) as string[]) || [];
      return [...posted, ...drafts];
    }

    return posted;
  } catch (e) {
    return [];
  }
}

/**
 * Generates a draft reply for a review using OpenAI (non-streaming).
 * Used by bulk-generate and anywhere streaming isn't needed.
 */
export async function draftReply(
  review: ReviewData,
  locationSettings: LocationSettings,
  previousDraft?: string,
): Promise<string> {
  const recentReplies = await getRecentReplies(
    locationSettings.location_id,
    review.id,
  );
  const prompt = buildPrompt(
    review,
    locationSettings,
    previousDraft,
    recentReplies,
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 4000,
  });

  const draftText = completion.choices[0].message.content;

  if (!draftText) {
    throw new Error(
      `Failed to generate draft reply: ${completion.choices[0]?.message?.content ? "No content" : "Empty response"}`,
    );
  }

  return draftText;
}

/**
 * Generates a draft reply with OpenAI streaming enabled.
 * Returns an async generator that yields string chunks as they arrive.
 */
export async function* draftReplyStream(
  review: ReviewData,
  locationSettings: LocationSettings,
  previousDraft?: string,
): AsyncGenerator<string> {
  const recentReplies = await getRecentReplies(
    locationSettings.location_id,
    review.id,
  );
  const prompt = buildPrompt(
    review,
    locationSettings,
    previousDraft,
    recentReplies,
  );

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_completion_tokens: 4000,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      yield delta;
    }
  }
}

export function buildPrompt(
  review: ReviewData,
  settings: LocationSettings,
  previousDraft?: string,
  recentReplies?: string[],
): string {
  const sections: string[] = [];

  // ── 1. BRAND VOICE (highest priority) ──────────────────────────────────
  if (settings.brand_voice) {
    sections.push(
      `=== YOUR BRAND VOICE (follow this above all other style guidance) ===\n${settings.brand_voice}`,
    );
  }

  // ── 2. SENTIMENT APPROACH ──────────────────────────────────────────────
  const sentimentBlock = buildSentimentBlock(review.rating, settings);
  sections.push(
    `=== SENTIMENT APPROACH FOR THIS REVIEW ===\n${sentimentBlock}`,
  );

  // ── 3. THE REVIEW ──────────────────────────────────────────────────────
  let reviewBlock = `=== REVIEW TO REPLY TO ===\nRating: ${review.rating}/5`;
  if (review.reviewer_name) {
    reviewBlock += `\nReviewer: ${review.reviewer_name}`;
  }
  if (review.comment && review.comment.trim()) {
    reviewBlock += `\nReview: "${review.comment}"`;
  } else {
    reviewBlock += `\n(No written review, rating only)`;
  }
  sections.push(reviewBlock);

  // ── 4. FEW-SHOT EXAMPLE (structural reference) ────────────────────────
  const example = pickExample(review.rating);
  sections.push(
    `=== EXAMPLE (for reply structure, not tone — use your brand voice for tone) ===\n` +
      `Review [${example.review.rating}/5]: "${example.review.comment}"\n` +
      `Reply: ${example.reply}`,
  );

  // ── 5. CONTEXTUAL GUIDELINES ───────────────────────────────────────────
  const guidelines = buildGuidelines(review, settings);
  sections.push(`=== REPLY GUIDELINES ===\n${guidelines}`);

  // ── 6. REJECTION / REGENERATION ────────────────────────────────────────
  if (previousDraft) {
    sections.push(
      `=== REJECTED DRAFT (generate something completely different in structure, phrasing, and opening) ===\n"${previousDraft}"`,
    );
  }

  // ── 7. VARIETY CONTROLS ────────────────────────────────────────────────
  if (recentReplies && recentReplies.length > 0) {
    sections.push(
      `=== RECENT REPLIES FROM THIS BUSINESS ===\nTo ensure variety, you MUST use different opening phrases, varied sentence structures, and distinct vocabulary from these recent replies:\n\n` +
        recentReplies
          .map((d: string, i: number) => `[Recent Reply ${i + 1}]: "${d}"`)
          .join("\n\n"),
    );
  }

  return sections.join("\n\n");
}

function buildSentimentBlock(
  rating: number,
  settings: LocationSettings,
): string {
  if (rating >= 4) {
    return settings.positive_sentiment || DEFAULT_SENTIMENTS.positive;
  }
  if (rating <= 2) {
    return settings.negative_sentiment || DEFAULT_SENTIMENTS.negative;
  }
  // Rating === 3 (neutral)
  return settings.neutral_sentiment || DEFAULT_SENTIMENTS.neutral;
}

function pickExample(rating: number) {
  if (rating >= 4) return FEW_SHOT_POSITIVE;
  if (rating <= 2) return FEW_SHOT_NEGATIVE;
  return FEW_SHOT_NEUTRAL;
}

function buildGuidelines(
  review: ReviewData,
  settings: LocationSettings,
): string {
  const rules: string[] = [];

  // Length guidance based on review context
  const hasComment = review.comment && review.comment.trim().length > 0;
  if (!hasComment) {
    rules.push(
      "This is a rating-only review with no text. Write a brief, gracious reply (1-2 sentences). Do not invent details about what the reviewer experienced.",
    );
  } else {
    const commentLength = review.comment!.trim().length;
    if (commentLength < 50) {
      rules.push(
        "The review is short. Keep your reply concise and proportional (2-3 sentences).",
      );
    } else if (commentLength > 200) {
      rules.push(
        "The review is detailed. Write a substantive reply (3-4 sentences) that addresses the key points raised.",
      );
    } else {
      rules.push("Write a concise reply (2-4 sentences).");
    }
  }

  // Language
  if (settings.reply_language) {
    rules.push(`Write the reply in ${settings.reply_language}.`);
  }

  // Signature
  if (settings.signature) {
    rules.push(
      `End the reply with this signature as a natural sign-off: ${settings.signature}`,
    );
  }

  // Contact email for negative reviews
  if (review.rating <= 2 && settings.negative_contact_email) {
    rules.push(
      `For this negative review, invite the reviewer to reach out directly at ${settings.negative_contact_email} to resolve the issue.`,
    );
  }

  return rules.join("\n");
}
