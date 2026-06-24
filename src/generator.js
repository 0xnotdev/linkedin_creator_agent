import { GoogleGenerativeAI } from '@google/generative-ai';
import { getRecentHookTypes } from './store.js';
import { log } from './logger.js';
import dotenv from 'dotenv';
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
You must return a raw JSON object (without markdown code blocks like \`\`\`json) with the following structure:
{
  "post": "the full LinkedIn post text",
  "hookComment": "a teaser comment ('Full source + my breakdown in the thread 👇')",
  "linkComment": "the actual source URL + 1-line context",
  "imageQuery": "2-3 word search query for a relevant image",
  "hookType": "which hook pattern was used (for variety tracking)",
  "contentType": "one of [repo_spotlight, hot_take, paper_breakdown, comparison, framework]"
}`;

export async function generatePost(contentItem) {
  log.info(`Generating LinkedIn post for: ${contentItem.title}`);
  
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing from .env');
  }

  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT
  });

  const recentHooks = getRecentHookTypes(5);
  const avoidHooksPrompt = recentHooks.length > 0 
    ? `\nTry to avoid these recently used hook types if possible: ${recentHooks.join(', ')}`
    : '';

  const prompt = `Please generate a viral LinkedIn post based on the following content item:

Title: ${contentItem.title}
Source: ${contentItem.source}
Description/Abstract: ${contentItem.description}
URL: ${contentItem.url}
${avoidHooksPrompt}

Remember to return ONLY valid JSON matching the required format. Do not use markdown blocks around the JSON.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.9, // Higher temp for more creative hooks
      }
    });
    
    let responseText = result.response.text();
    // Clean up potential markdown JSON wrapping
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    if (responseText.includes('UNSAFE_CONTENT_REJECTED')) {
      throw new Error('LLM rejected content due to Brand Safety rules.');
    }
    
    const parsedData = JSON.parse(responseText);
    
    // Inject the actual URL into the linkComment if the LLM forgot
    if (!parsedData.linkComment.includes(contentItem.url)) {
      parsedData.linkComment = `${parsedData.linkComment} ${contentItem.url}`;
    }
    
    log.success('Successfully generated post content');
    return parsedData;

  } catch (error) {
    log.error('Failed to generate post with Gemini', error.message);
    throw error;
  }
}
