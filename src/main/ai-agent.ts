import OpenAI from 'openai'
import { SecureStore } from './secure-store'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class AIAgent {
  static async parseQuery(prompt: string, schema: Array<{name: string, type: string}>): Promise<any[]> {
    const key = SecureStore.getApiKey()
    if (!key) throw new Error("OpenRouter API Key not configured. Please add it in Settings.")

    const openai = new OpenAI({ 
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key 
    })
    
    const schemaDescription = schema.map(field => {
      let desc = `- ${field.name} (type: ${field.type})`
      if ((field as any).sampleValues?.length > 0) {
        desc += `, example values: ${JSON.stringify((field as any).sampleValues)}`
      }
      return desc
    }).join('\n')

    const systemPrompt = `You are a Firebase Firestore query constructor assistant.
Your job is to translate a user's natural language request into an exact JSON query filter.

COLLECTION SCHEMA (with real example values from the database):
${schemaDescription}

CRITICAL RULES:
1. Return ONLY a JSON object: { "filters": [{ "field": "string", "operator": "string", "value": any }] }
2. No markdown, no explanation — raw JSON only.
3. Use the EXACT field names from the schema above.
4. For the "value" field: you MUST match the real stored value patterns shown in "example values". 
   - If the user says "3 min" but the example values show "3 min read", use "3 min read" as the value.
   - If the user says "active" but example values show "ACTIVE", use "ACTIVE".
   - Always prefer an exact match from the example values list over a literal interpretation.
5. Valid operators: '==', '!=', '<', '<=', '>', '>=', 'array-contains', 'array-contains-any'.
6. Cast value types to match the schema type (number fields get numeric values, boolean fields get true/false).
    `

    const MAX_RETRIES = 3
    let lastError: any

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 2s, 4s
          await sleep(1000 * Math.pow(2, attempt))
        }

        const response = await openai.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0,
        })

        const rawResult = response.choices[0].message.content || '{"filters":[]}'
        
        const cleanedResult = rawResult.replace(/```json\n?|\n?```/g, '').trim()
        let result = JSON.parse(cleanedResult)
        
        if (result.filters && Array.isArray(result.filters)) return result.filters
        if (Array.isArray(result)) return result
        
        const matchObj = cleanedResult.match(/\{[\s\S]*"filters"[\s\S]*\}/)
        if (matchObj) {
           const obj = JSON.parse(matchObj[0])
           if (obj.filters) return obj.filters
        }
        
        return []

      } catch (err: any) {
        lastError = err
        const status = err?.status || err?.response?.status
        if (status === 429) {
          if (attempt < MAX_RETRIES - 1) {
            console.warn(`Rate limited (429). Retrying in ${Math.pow(2, attempt + 1)}s... (attempt ${attempt + 1}/${MAX_RETRIES})`)
            continue
          }
          throw new Error("Rate limit exceeded on free OpenRouter tier. Please wait a moment and try again.")
        }
        // Re-throw non-429 errors immediately
        throw err
      }
    }

    throw lastError
  }
}
