#!/usr/bin/env node

/**
 * LLM Translator
 * 
 * Handles translation of content using LiteLLM API while preserving
 * links, gists, and code blocks
 */

const fetch = require('node-fetch');

class LLMTranslator {
    constructor() {
        this.apiEndpoint = 'https://llm.professionalize.com/v1/chat/completions';
        this.apiKey = process.env.LLM_API_KEY || 'sk-8W05YDkddO7rioWnXjyfng';
        this.model = 'gpt-oss';
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.enableDetailedLogging = process.env.TRANSLATION_DEBUG === 'true' || process.env.NODE_ENV === 'development';
        
        // Language code to full language name mapping
        this.languageNames = {
            'ar': 'Arabic',
            'bg': 'Bulgarian', 
            'cs': 'Czech',
            'de': 'German',
            'el': 'Greek',
            'es': 'Spanish',
            'fa': 'Persian/Farsi',
            'fr': 'French',
            'hi': 'Hindi',
            'hr': 'Croatian',
            'hu': 'Hungarian',
            'hy': 'Armenian',
            'id': 'Indonesian',
            'it': 'Italian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'lt': 'Lithuanian',
            'nl': 'Dutch',
            'pl': 'Polish',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'sv': 'Swedish',
            'th': 'Thai',
            'tr': 'Turkish',
            'uk': 'Ukrainian',
            'vi': 'Vietnamese',
            'zh': 'Chinese'
        };
    }

    /**
     * Make API call to LiteLLM with retry mechanism
     */
    async callLLM(messages, maxTokens = 2000, logDetails = false) {
        const requestBody = {
            model: this.model,
            messages: messages,
            max_tokens: maxTokens,
            temperature: 0.3
        };

        // Log the request details if enabled
        if (logDetails) {
            console.log('\n📤 LLM API REQUEST:');
            console.log('Endpoint:', this.apiEndpoint);
            console.log('Model:', this.model);
            console.log('Max Tokens:', maxTokens);
            console.log('Temperature:', 0.3);
            console.log('Messages:');
            messages.forEach((msg, index) => {
                console.log(`  [${index}] Role: ${msg.role}`);
                const preview = msg.content.length > 200 ? msg.content.substring(0, 200) + '...' : msg.content;
                console.log(`  [${index}] Content: ${preview}`);
            });
            console.log('');
        }

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const startTime = Date.now();
                
                const response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    body: JSON.stringify(requestBody)
                });

                const responseTime = Date.now() - startTime;

                if (!response.ok) {
                    const errorText = await response.text();
                    if (logDetails) {
                        console.log(`📥 LLM API ERROR RESPONSE (${responseTime}ms):`);
                        console.log('Status:', response.status, response.statusText);
                        console.log('Error:', errorText);
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
                }

                const data = await response.json();
                
                // Log the successful response if enabled
                if (logDetails) {
                    console.log(`📥 LLM API SUCCESS RESPONSE (${responseTime}ms):`);
                    console.log('Status:', response.status);
                    if (data.usage) {
                        console.log('Tokens - Prompt:', data.usage.prompt_tokens, 'Completion:', data.usage.completion_tokens, 'Total:', data.usage.total_tokens);
                    }
                    if (data.choices && data.choices[0] && data.choices[0].message) {
                        const content = data.choices[0].message.content;
                        const preview = content && content.length > 300 ? content.substring(0, 300) + '...' : content;
                        console.log('Response Content Preview:', preview);
                        console.log('Full Response Length:', content ? content.length : 0, 'characters');
                    }
                    console.log('');
                }
                
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const message = data.choices[0].message;
                    let content = message.content;
                    
                    // Handle case where reasoning_content is provided instead of content
                    if (!content && message.reasoning_content) {
                        if (logDetails) {
                            console.log('🔍 No content found, extracting from reasoning_content...');
                        }
                        // Try to extract the actual translation from reasoning content
                        content = this.extractTranslationFromReasoning(message.reasoning_content);
                    }
                    
                    if (content && typeof content === 'string') {
                        return content.trim();
                    }
                }
                
                if (logDetails) {
                    console.log('📥 LLM API INVALID RESPONSE FORMAT:');
                    console.log('Response Data:', JSON.stringify(data, null, 2));
                }
                throw new Error('Invalid response format from LLM API - no content in response');
            } catch (error) {
                const errorMessage = `LLM API attempt ${attempt} failed: ${error.message}`;
                console.error(errorMessage);
                
                if (logDetails && attempt < this.maxRetries) {
                    console.log(`⏱️  Retrying in ${this.retryDelay * attempt}ms...`);
                }
                
                if (attempt === this.maxRetries) {
                    throw new Error(`LLM API failed after ${this.maxRetries} attempts: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
            }
        }
    }

    /**
     * Translate frontmatter fields
     */
    async translateFrontmatter(frontmatter, targetLanguage) {
        const languageName = this.languageNames[targetLanguage] || targetLanguage.toUpperCase();
        
        const systemPrompt = `You are a professional technical translator specializing in software documentation translation.

CRITICAL TRANSLATION RULES:
1. Translate ONLY the specified fields to ${languageName}
2. Maintain technical accuracy and professional tone
3. Keep all formatting, quotes, and structure exactly as provided
4. Do NOT translate technical terms, API names, or product names
5. Preserve all special characters and punctuation
6. Return ONLY the translated content without any additional text or explanation

Your response must contain ONLY the translated text with no additional commentary.`;

        try {
            // Extract and translate title
            const titleMatch = frontmatter.match(/title:\s*"(.+)"/);
            let translatedTitle = '';
            if (titleMatch) {
                const userPrompt = `Translate this title to ${languageName}: "${titleMatch[1]}"\n\nReturn only the translated title text without quotes.`;
                translatedTitle = await this.callLLM([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ], 200, this.enableDetailedLogging);
            }

            // Extract and translate description
            const descriptionMatch = frontmatter.match(/description:\s*"(.+)"/);
            let translatedDescription = '';
            if (descriptionMatch) {
                const userPrompt = `Translate this description to ${languageName}: "${descriptionMatch[1]}"\n\nReturn only the translated description text without quotes.`;
                translatedDescription = await this.callLLM([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ], 500, this.enableDetailedLogging);
            }

            // Extract and translate keywords
            const keywordsMatch = frontmatter.match(/keywords:\s*\[([\s\S]*?)\]/);
            let translatedKeywords = '';
            if (keywordsMatch) {
                const keywordsContent = keywordsMatch[1].trim();
                const userPrompt = `Please translate only the text within quotes to ${languageName}. Keep technical terms like "pdf", "c#", "powerpoint" unchanged. Keep the exact same format with quotes and commas.

Input: ${keywordsContent}

Expected output format example:
"translated keyword 1",
"translated keyword 2",
"translated keyword 3"

Translate now:`;
                translatedKeywords = await this.callLLM([
                    { role: 'system', content: `You are a translator. Translate only the text content to ${languageName} while keeping technical terms unchanged. Return ONLY the translated keywords in the same format. Do not provide explanations or reasoning.` },
                    { role: 'user', content: userPrompt }
                ], 1200, this.enableDetailedLogging);
            }

            // Extract and translate step1-step10
            const translatedSteps = {};
            for (let i = 1; i <= 10; i++) {
                const stepPattern = new RegExp(`step${i}:\\s*"(.+)"`);
                const stepMatch = frontmatter.match(stepPattern);
                if (stepMatch && stepMatch[1].trim() !== '') {
                    const userPrompt = `Translate this step description to ${languageName}: "${stepMatch[1]}"\n\nReturn only the translated step text without quotes.`;
                    translatedSteps[`step${i}`] = await this.callLLM([
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ], 300, this.enableDetailedLogging);
                }
            }

            return {
                title: translatedTitle,
                description: translatedDescription,
                keywords: translatedKeywords,
                steps: translatedSteps
            };
        } catch (error) {
            console.error(`Error translating frontmatter to ${targetLanguage}:`, error.message);
            throw error;
        }
    }

    /**
     * Translate a heading
     */
    async translateHeading(heading, targetLanguage) {
        const languageName = this.languageNames[targetLanguage] || targetLanguage.toUpperCase();
        
        const systemPrompt = `You are a professional technical translator specializing in software documentation.

CRITICAL RULES:
1. Translate ONLY the heading text to ${languageName}
2. Maintain technical accuracy and professional tone
3. Keep markdown heading markers (##, ###, etc.) exactly as provided
4. Do NOT translate technical terms, API names, file extensions, or product names
5. Preserve all formatting and special characters
6. Return ONLY the translated heading with no additional text

Your response must contain ONLY the translated heading.`;

        const userPrompt = `Translate this heading to ${languageName}: ${heading}

Return only the translated heading with the same markdown formatting.`;

        try {
            return await this.callLLM([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], 200, this.enableDetailedLogging);
        } catch (error) {
            console.error(`Error translating heading to ${targetLanguage}:`, error.message);
            throw error;
        }
    }

    /**
     * Translate a paragraph while preserving links and technical elements
     */
    async translateParagraph(paragraph, targetLanguage) {
        const languageName = this.languageNames[targetLanguage] || targetLanguage.toUpperCase();
        
        const systemPrompt = `You are a professional technical translator specializing in software documentation.

CRITICAL PRESERVATION RULES:
1. Do NOT modify any URLs or links - keep them exactly as provided
2. Do NOT modify any markdown link syntax: [text](url) - translate only the text part
3. Do NOT modify any {{<gist>}} shortcodes or similar Hugo shortcodes
4. Do NOT modify any code snippets, file paths, or technical identifiers
5. Do NOT modify any HTML tags or attributes
6. Preserve all markdown formatting (bold, italic, code backticks)
7. Preserve all special characters and punctuation

TRANSLATION RULES:
1. Translate the content to ${languageName}
2. Maintain technical accuracy and professional tone
3. Keep the meaning and context intact
4. Do NOT translate technical terms, product names, or API names
5. Return ONLY the translated content without additional commentary

Your response must contain ONLY the translated paragraph.`;

        const userPrompt = `Translate this paragraph to ${languageName} while preserving all links, URLs, technical terms, and formatting:

${paragraph}

Return only the translated paragraph with all links and formatting preserved.`;

        try {
            return await this.callLLM([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], 1500, this.enableDetailedLogging);
        } catch (error) {
            console.error(`Error translating paragraph to ${targetLanguage}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if content contains technical elements that should not be translated
     */
    containsTechnicalContent(content) {
        const technicalPatterns = [
            /{{<\s*gist\s+[\w-]+\s+[\w-]+\s*>}}/,  // Gist shortcodes
            /```[\s\S]*?```/,                        // Code blocks
            /`[^`]+`/,                               // Inline code - but allow if it's just part of a list item
            /https?:\/\/[^\s\]]+/                    // URLs - but allow if they're part of translatable content
        ];

        // Don't consider content technical just because it has URLs or inline code in context
        // Only skip if it's primarily technical (like pure code blocks or gist shortcodes)
        const isGistOrCodeBlock = /{{<\s*gist\s+[\w-]+\s+[\w-]+\s*>}}/.test(content) || 
                                 /^```[\s\S]*?```$/.test(content.trim());
        
        return isGistOrCodeBlock;
    }

    /**
     * Translate list content while preserving structure
     */
    async translateList(content, targetLanguage) {
        const languageName = this.getLanguageName(targetLanguage);
        
        const messages = [
            {
                role: 'system',
                content: `You are a professional technical translator. Translate the following list content to ${languageName} while:
1. PRESERVING the exact list numbering/bullet structure
2. PRESERVING all technical terms, API names, class names, method names, and URLs exactly as they appear
3. PRESERVING all Hugo shortcodes like {{< >}} exactly as they appear
4. PRESERVING all markdown links [text](url) with exact URLs
5. TRANSLATING only the descriptive text while keeping technical elements intact
6. MAINTAINING the same formatting and structure

Return ONLY the translated list content, no additional text.`
            },
            {
                role: 'user',
                content: `Translate this list to ${languageName}:\n\n${content}`
            }
        ];

        return await this.callLLM(messages, 2000, this.enableDetailedLogging);
    }

    /**
     * Translate with troubleshooting assistance for difficult cases
     */
    async translateWithTroubleshooting(troubleshootPrompt, targetLanguage) {
        const languageName = this.getLanguageName(targetLanguage);
        
        console.log(`    Attempting simplified translation for ${languageName}...`);
        
        const messages = [
            {
                role: 'system',
                content: `You are a specialized technical translator. A previous translation attempt failed with the error: "${troubleshootPrompt.previousError}". 
                
                Please provide a simplified but accurate translation to ${languageName}. Focus on:
                1. Preserving technical terms and code elements exactly
                2. Using simpler sentence structures if needed
                3. Maintaining all links and references
                4. Keeping the same structure and formatting
                
                If the content is too complex, prioritize accuracy over natural flow.`
            },
            {
                role: 'user',
                content: this.formatSimplifiedContent(troubleshootPrompt, languageName)
            }
        ];

        const result = await this.callLLM(messages, 2000, true); // Enable detailed logging for troubleshooting
        
        // Parse the result back into the expected format
        return this.parseSimplifiedResult(result, troubleshootPrompt);
    }

    /**
     * Format content for simplified troubleshooting translation
     */
    formatSimplifiedContent(troubleshootPrompt, languageName) {
        let content = `Translate this technical article content to ${languageName}:\n\n`;
        
        // Add frontmatter
        content += `FRONTMATTER:\n---\n${troubleshootPrompt.frontMatter}\n---\n\n`;
        
        // Add simplified sections
        content += `CONTENT SECTIONS:\n`;
        for (let i = 0; i < troubleshootPrompt.sections.length; i++) {
            const section = troubleshootPrompt.sections[i];
            content += `\nSection ${i + 1} (${section.type}):\n${section.content}\n`;
        }
        
        content += `\nPlease return the translation in the same format with FRONTMATTER and CONTENT SECTIONS clearly marked.`;
        
        return content;
    }

    /**
     * Parse simplified translation result
     */
    parseSimplifiedResult(result, originalPrompt) {
        try {
            // Extract frontmatter
            const frontMatterMatch = result.match(/FRONTMATTER:\s*---\s*([\s\S]*?)\s*---/);
            let translatedFrontMatter = originalPrompt.frontMatter; // fallback
            
            if (frontMatterMatch) {
                translatedFrontMatter = frontMatterMatch[1].trim();
            }
            
            // Extract sections
            const sectionsMatch = result.match(/CONTENT SECTIONS:\s*([\s\S]*?)$/);
            let translatedSections = originalPrompt.sections; // fallback
            
            if (sectionsMatch) {
                const sectionsText = sectionsMatch[1];
                const sectionMatches = sectionsText.match(/Section \d+ \([^)]+\):\s*([\s\S]*?)(?=\nSection \d+|\n*$)/g);
                
                if (sectionMatches) {
                    translatedSections = sectionMatches.map((match, index) => {
                        const contentMatch = match.match(/Section \d+ \([^)]+\):\s*([\s\S]*)/);
                        const content = contentMatch ? contentMatch[1].trim() : originalPrompt.sections[index]?.content || '';
                        
                        return {
                            type: originalPrompt.sections[index]?.type || 'paragraph',
                            content: content
                        };
                    });
                }
            }
            
            return {
                frontMatter: translatedFrontMatter,
                sections: translatedSections
            };
            
        } catch (error) {
            console.warn(`    Warning: Failed to parse simplified result, using fallback structure`);
            return {
                frontMatter: originalPrompt.frontMatter,
                sections: originalPrompt.sections
            };
        }
    }

    /**
     * Extract translation from reasoning content when main content is empty
     */
    extractTranslationFromReasoning(reasoningContent) {
        if (!reasoningContent) return null;
        
        // Try to find quoted translations in reasoning content
        // Look for patterns like "translation" or 'translation'
        const quotedMatches = reasoningContent.match(/"([^"]+)"/g);
        
        if (quotedMatches && quotedMatches.length > 0) {
            // For keywords, try to reconstruct the list format
            if (reasoningContent.includes('keywords') || reasoningContent.includes('translate these')) {
                // Filter out obvious non-translations (technical terms, instructions)
                const translations = quotedMatches.filter(match => {
                    const content = match.slice(1, -1); // Remove quotes
                    return !content.includes('translate') && 
                           !content.includes('Bulgarian') && 
                           !content.includes('Spanish') &&
                           !content.includes('Armenian') &&
                           !content.includes('French') &&
                           !content.includes('German') &&
                           !content.toLowerCase().includes('using') &&
                           content.length > 8 && // Skip very short matches
                           !content.includes('API') &&
                           !content.includes('rule') &&
                           !content.includes('field');
                });
                
                if (translations.length > 0) {
                    // Format as proper keyword list
                    return translations.join(',\n        ');
                }
            } else {
                // For single translations, return the first reasonable match
                for (const match of quotedMatches) {
                    const content = match.slice(1, -1);
                    if (content.length > 5 && !content.includes('translate')) {
                        return content;
                    }
                }
            }
        }
        
        // Try to find translation patterns without quotes
        const patterns = [
            /Bulgarian equivalents?:\s*(.+?)(?:\n|$)/i,
            /translation:\s*(.+?)(?:\n|$)/i,
            /(?:->|→)\s*(.+?)(?:\n|$)/i,
            /produce:\s*(.+?)(?:\n|$)/i
        ];
        
        for (const pattern of patterns) {
            const match = reasoningContent.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        console.warn('Could not extract translation from reasoning content');
        return null;
    }

    /**
     * Get language full name from code
     */
    getLanguageName(langCode) {
        return this.languageNames[langCode] || langCode.toUpperCase();
    }
}

module.exports = LLMTranslator;