import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { createLogger } from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const log = createLogger('Generator');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PostSchema = z.object({
  post: z.string().min(10).max(3000),
  hookComment: z.string().min(1),
  linkComment: z.string().min(1),
  imageQuery: z.string().min(1),
  hookType: z.string(),
  contentType: z.enum(['repo_spotlight', 'hot_take', 'paper_breakdown', 'comparison', 'framework'])
});

const SYSTEM_PROMPT = `You are a senior AI engineer who posts raw, authentic takes on LinkedIn.
You're not a news channel. You're not a corporate account. You're a builder 
who shares what they genuinely find interesting.

Your posts are designed to maximize DWELL TIME (the #1 algorithm signal)
and SAVES (the #2 signal). People should stop scrolling, read every line,
and bookmark your post for later.

=== HOOK + RE-HOOK SYSTEM ===
Line 1: THE HOOK — bold claim, curiosity gap, or pattern interrupt.
  Must be under 210 characters (the "see more" cutoff).
  Must create an OPEN LOOP the reader needs to resolve.
Line 2: THE RE-HOOK — slams the door behind them.
  Reinforces the promise or deepens intrigue.
  Examples: "And no, I'm not joking." / "The results weren't even close."

=== 1-3-1 RHYTHM FORMAT ===
Use this visual rhythm to pull readers through:
  1 line (hook)
  [blank]
  3 lines (context/story paragraph — max 3 lines)
  [blank]
  1 line (punchy transition or insight)
  [blank]
  3 lines (core value — framework, lesson, or data)
  [blank]
  1 line (CTA — specific question that makes people pick sides)
  [blank]
  3-5 hashtags

=== VOICE RULES ===
- Write in fragments. Short. Punchy. Like texting a smart friend.
- Max 12 words per line. One thought per line.
- Use → or ↳ to connect advice to explanations.
- 1,300-1,900 characters total.
- Max 2-3 emojis, placed strategically (never 🚀🔥💡 together).
- 3-5 hashtags at the very end.
- Make it SAVEABLE — include a framework, checklist, or mental model.

=== ENGAGEMENT CTA RULES ===
End with a SPECIFIC, POLARIZING question. NOT generic.
✅ GOOD: "Which approach would you pick for production — and why?"
✅ GOOD: "What's the one tool you'd add to this stack?"
❌ BAD: "What do you think?" / "Agree?" / "Comment YES if you agree"

=== BANNED PHRASES (instant rejection — these scream AI slop) ===
"In today's rapidly evolving" | "I'm thrilled to announce" | "Let's dive in"
"Game-changer" | "Revolutionize" | "Delve" | "Landscape" | "Leverage"
"It's not just about X, it's about Y" | "Here's the thing"
"Exciting times" | "Buckle up" | "Hot take:" (as literal text)
"This is huge" | "Mind-blowing" | "Groundbreaking"

=== BRAND SAFETY RULES (CRITICAL) ===
You are strictly an AI/Tech engineering account.
If the source content or your generated post touches on ANY of the following topics, you MUST return an error string instead of JSON:
- Politics or elections
- Religion
- Social controversies or culture wars
- Negative remarks, hit pieces, or insults directed at specific people or companies
If safe, output the JSON. If unsafe, output ONLY the string: "UNSAFE_CONTENT_REJECTED"

=== OUTPUT FORMAT ===
You must return a raw JSON object (without markdown code blocks like \`\`\`json) matching this exact structure:
{
  "post": "the full LinkedIn post text",
  "hookComment": "a teaser comment ('Full source + my breakdown in the thread 👇')",
  "linkComment": "the actual source URL + 1-line context",
  "imageQuery": "2-3 word search query for a relevant image",
  "hookType": "which hook pattern was used (for variety tracking)",
  "contentType": "one of [repo_spotlight, hot_take, paper_breakdown, comparison, framework]"
}`;

async function callLLM(prompt, errorContext = '') {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing from .env');
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT
  });

  const fullPrompt = errorContext ? `${prompt}\n\n${errorContext}` : prompt;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.9 }
  });
  
  let responseText = result.response.text();
  responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  if (responseText.includes('UNSAFE_CONTENT_REJECTED')) {
    throw new Error('LLM rejected content due to Brand Safety rules.');
  }

  return JSON.parse(responseText);
}

export async function generatePost(contentItem, recentHookTypes = [], recentTopics = []) {
  log.info(`Generating LinkedIn post for: ${contentItem.title}`);
  
  const avoidHooksPrompt = recentHookTypes.length > 0 
    ? `\nTry to avoid these recently used hook types if possible: ${recentHookTypes.join(', ')}`
    : '';

  const avoidTopicsPrompt = recentTopics.length > 0
    ? `\nTry to avoid framing this exactly like these recent topics: ${recentTopics.slice(0,3).join(', ')}`
    : '';

  const basePrompt = `Please generate a viral LinkedIn post based on the following content item:

Title: ${contentItem.title}
Source: ${contentItem.sourceType}
Description/Abstract: ${contentItem.description}
URL: ${contentItem.url}
${avoidHooksPrompt}
${avoidTopicsPrompt}

Remember to return ONLY valid JSON matching the required format.`;

  try {
    const rawData = await callLLM(basePrompt);
    let parsedData = PostSchema.parse(rawData);
    
    // Inject URL if forgotten
    if (!parsedData.linkComment.includes(contentItem.url)) {
      parsedData.linkComment = `${parsedData.linkComment} ${contentItem.url}`;
    }
    
    log.success('Successfully generated and validated post content');
    return parsedData;

  } catch (error) {
    // 1-Time Retry Loop for Zod/JSON errors
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      log.warn('LLM returned invalid JSON or failed schema validation. Retrying once...', { error: error.message });
      
      const errorInstruction = `Your previous output failed validation. You must return ONLY valid JSON matching the exact schema. Error: ${error.message}`;
      
      const rawDataRetry = await callLLM(basePrompt, errorInstruction);
      let parsedDataRetry = PostSchema.parse(rawDataRetry);
      
      if (!parsedDataRetry.linkComment.includes(contentItem.url)) {
        parsedDataRetry.linkComment = `${parsedDataRetry.linkComment} ${contentItem.url}`;
      }

      log.success('Successfully generated and validated post content on retry');
      return parsedDataRetry;
    }
    
    // Bubble up other errors (Brand Safety, Network)
    log.error('Failed to generate post', { error });
    throw error;
  }
}
