#!/usr/bin/env node

/**
 * Translation Processor
 * 
 * Main processor that handles file structure replication, content parsing,
 * and translation coordination for each target language
 */

const fs = require('fs');
const path = require('path');
const LLMTranslator = require('./llm-translator');

class TranslationProcessor {
    constructor() {
        this.repoRoot = path.resolve(__dirname, '../../');
        this.translator = new LLMTranslator();
        this.processedCount = 0;
        this.errorCount = 0;
        this.totalTranslations = 0;
        this.successfulTranslations = 0;
        this.failedTranslations = 0;
        this.failedLanguagesDetails = [];
    }

    /**
     * Process all translation tasks
     */
    async processTranslationTasks() {
        try {
            // Load translation tasks
            const tasksPath = path.join(this.repoRoot, 'translation-tasks.json');
            if (!fs.existsSync(tasksPath)) {
                throw new Error('No translation tasks file found. Run translation-detector.js first.');
            }

            const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
            const { tasks } = tasksData;

            if (!tasks || tasks.length === 0) {
                console.log('No translation tasks to process');
                return { success: true, processed: 0, errors: 0 };
            }

            console.log(`Starting translation processing for ${tasks.length} articles...`);

            // Process each article
            for (const task of tasks) {
                console.log(`\nProcessing: ${task.title} (${task.product}/${task.platform})`);
                console.log(`Target languages: ${task.targetLanguages.join(', ')}`);
                
                try {
                    await this.processArticleTranslation(task);
                    this.processedCount++;
                } catch (error) {
                    console.error(`Critical error processing ${task.title}:`, error.message);
                    this.errorCount++;
                }
            }

            console.log(`\nTranslation processing completed:`);
            console.log(`- Articles processed: ${this.processedCount}/${tasks.length}`);
            console.log(`- Critical article errors: ${this.errorCount}`);
            console.log(`- Total language translations: ${this.totalTranslations}`);
            console.log(`- Successful translations: ${this.successfulTranslations}`);
            console.log(`- Failed translations: ${this.failedTranslations}`);
            console.log(`- Success rate: ${((this.successfulTranslations / this.totalTranslations) * 100).toFixed(1)}%`);

            if (this.failedLanguagesDetails.length > 0) {
                console.log(`\nFailed translation details:`);
                const failuresByLanguage = {};
                this.failedLanguagesDetails.forEach(failure => {
                    if (!failuresByLanguage[failure.language]) {
                        failuresByLanguage[failure.language] = [];
                    }
                    failuresByLanguage[failure.language].push(`${failure.article} (${failure.platform})`);
                });

                Object.keys(failuresByLanguage).forEach(lang => {
                    console.log(`  ${lang}: ${failuresByLanguage[lang].join(', ')}`);
                });
            }

            // Generate processing report
            this.generateProcessingReport(tasks);

            return { 
                success: this.errorCount === 0, 
                processed: this.processedCount, 
                errors: this.errorCount,
                totalTranslations: this.totalTranslations,
                successfulTranslations: this.successfulTranslations,
                failedTranslations: this.failedTranslations,
                failedLanguagesDetails: this.failedLanguagesDetails
            };
        } catch (error) {
            console.error('Error in translation processing:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Process translation for a single article to all target languages
     */
    async processArticleTranslation(task) {
        // Read the source English article
        const sourceContent = fs.readFileSync(task.fullPath, 'utf8');
        const parsedContent = this.parseMarkdownContent(sourceContent);

        let successCount = 0;
        let failedLanguages = [];

        // Process translation for each target language with resilient error handling
        for (const targetLang of task.targetLanguages) {
            console.log(`  Translating to ${targetLang}...`);
            this.totalTranslations++;
            
            const success = await this.translateWithRetry(task, parsedContent, targetLang);
            if (success) {
                successCount++;
                this.successfulTranslations++;
                console.log(`  ✓ Successfully translated to ${targetLang}`);
            } else {
                failedLanguages.push(targetLang);
                this.failedTranslations++;
                this.failedLanguagesDetails.push({
                    article: task.title,
                    language: targetLang,
                    product: task.product,
                    platform: task.platform
                });
                console.error(`  ✗ Failed to translate to ${targetLang} after all retry attempts`);
            }
        }

        console.log(`  Summary: ${successCount}/${task.targetLanguages.length} languages translated successfully`);
        if (failedLanguages.length > 0) {
            console.warn(`  Failed languages: ${failedLanguages.join(', ')}`);
        }
    }

    /**
     * Translate content with retry logic and fallback strategies
     */
    async translateWithRetry(task, parsedContent, targetLang, maxRetries = 3) {
        const maxAttempts = maxRetries + 1; // Initial attempt + retries
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`    Attempt ${attempt}/${maxAttempts} for ${targetLang}...`);
                
                // Enable detailed logging for retry attempts and troublesome languages
                const enableDebug = attempt > 1 || targetLang === 'hy' || targetLang === 'ar' || targetLang === 'th';
                
                const translatedContent = await this.translateArticleContent(
                    parsedContent, 
                    targetLang,
                    attempt > 1, // isRetry flag
                    enableDebug  // debug flag
                );
                
                const outputPath = this.createTargetFilePath(task, targetLang);
                this.saveTranslatedArticle(translatedContent, outputPath);
                
                console.log(`    ✓ Saved to: ${path.relative(this.repoRoot, outputPath)}`);
                return true; // Success
                
            } catch (error) {
                console.error(`    ✗ Attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxAttempts) {
                    // Wait before retry with exponential backoff
                    const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    console.log(`    Waiting ${waitTime}ms before retry...`);
                    await this.sleep(waitTime);
                } else if (attempt === maxAttempts) {
                    // Last attempt - try with LLM suggestion for troubleshooting
                    console.log(`    Final attempt with LLM troubleshooting assistance...`);
                    try {
                        const troubleshootResult = await this.attemptWithTroubleshooting(
                            parsedContent, 
                            targetLang, 
                            error.message,
                            task
                        );
                        
                        if (troubleshootResult.success) {
                            const outputPath = this.createTargetFilePath(task, targetLang);
                            this.saveTranslatedArticle(troubleshootResult.content, outputPath);
                            console.log(`    ✓ Recovered with troubleshooting! Saved to: ${path.relative(this.repoRoot, outputPath)}`);
                            return true;
                        }
                    } catch (troubleshootError) {
                        console.error(`    ✗ Troubleshooting attempt also failed:`, troubleshootError.message);
                    }
                }
            }
        }
        
                        // All attempts failed - don't increment errorCount here as it's for critical article errors
        return false;
    }

    /**
     * Sleep utility for retry delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Attempt translation with LLM troubleshooting assistance
     */
    async attemptWithTroubleshooting(parsedContent, targetLang, lastError, task) {
        console.log(`    Requesting LLM troubleshooting for ${targetLang}...`);
        console.log(`    Attempting simplified translation for ${this.getLanguageName(targetLang)}...`);
        
        try {
            // Create a simplified version of the content for troubleshooting
            const troubleshootPrompt = this.createTroubleshootingPrompt(parsedContent, targetLang, lastError);
            
            // Use a simplified translation approach
            const result = await this.translator.translateWithTroubleshooting(
                troubleshootPrompt,
                targetLang
            );
            
            return {
                success: true,
                content: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create a troubleshooting prompt for difficult translations
     */
    createTroubleshootingPrompt(parsedContent, targetLang, error) {
        return {
            frontMatter: parsedContent.frontMatter,
            // Use only the first few sections to reduce complexity
            sections: parsedContent.sections.slice(0, 3),
            targetLanguage: targetLang,
            previousError: error,
            isSimplified: true
        };
    }

    /**
     * Parse markdown content into structured sections
     */
    parseMarkdownContent(content) {
        // Extract frontmatter - handle both Unix (\n) and Windows (\r\n) line endings
        const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!frontMatterMatch) {
            throw new Error('No frontmatter found in the article');
        }

        const frontMatter = frontMatterMatch[1];
        const bodyContent = content.substring(frontMatterMatch[0].length).trim();

        // Split body into sections (headings and paragraphs)
        const sections = this.parseContentSections(bodyContent);

        return {
            frontMatter,
            sections
        };
    }

    /**
     * Parse content into sections (headings, paragraphs, lists, code blocks, etc.)
     */
    parseContentSections(content) {
        const sections = [];
        const lines = content.split('\n');
        let currentSection = '';
        let sectionType = 'paragraph';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for heading
            if (line.match(/^#{1,6}\s+/)) {
                // Save previous section if exists
                if (currentSection.trim()) {
                    sections.push({
                        type: sectionType,
                        content: currentSection.trim()
                    });
                }
                
                // Start new heading section
                currentSection = line;
                sectionType = 'heading';
            }
            // Check for code block start
            else if (line.match(/^```/)) {
                // Save previous section if exists
                if (currentSection.trim()) {
                    sections.push({
                        type: sectionType,
                        content: currentSection.trim()
                    });
                }
                
                // Find code block end
                let codeContent = line + '\n';
                i++; // Move to next line
                while (i < lines.length && !lines[i].match(/^```/)) {
                    codeContent += lines[i] + '\n';
                    i++;
                }
                if (i < lines.length) {
                    codeContent += lines[i]; // Add closing ```
                }
                
                sections.push({
                    type: 'code',
                    content: codeContent
                });
                
                currentSection = '';
                sectionType = 'paragraph';
            }
            // Check for gist shortcode
            else if (line.match(/{{<\s*gist\s+[\w-]+\s+[\w-]+\s*>}}/)) {
                // Save previous section if exists
                if (currentSection.trim()) {
                    sections.push({
                        type: sectionType,
                        content: currentSection.trim()
                    });
                }
                
                sections.push({
                    type: 'gist',
                    content: line
                });
                
                currentSection = '';
                sectionType = 'paragraph';
            }
            // Check for list items (numbered or bulleted)
            else if (line.match(/^\s*(\d+\.|\*|-|\+)\s+/) && sectionType !== 'list') {
                // Save previous section if exists
                if (currentSection.trim()) {
                    sections.push({
                        type: sectionType,
                        content: currentSection.trim()
                    });
                }
                
                // Start new list section
                currentSection = line;
                sectionType = 'list';
            }
            // Continue list items
            else if (line.match(/^\s*(\d+\.|\*|-|\+)\s+/) && sectionType === 'list') {
                currentSection += '\n' + line;
            }
            // Empty line - might indicate section break
            else if (line.trim() === '') {
                if (sectionType === 'list') {
                    // End list section on empty line
                    if (currentSection.trim()) {
                        sections.push({
                            type: sectionType,
                            content: currentSection.trim()
                        });
                        currentSection = '';
                        sectionType = 'paragraph';
                    }
                } else if (currentSection.trim()) {
                    currentSection += '\n' + line;
                }
            }
            // Regular content line
            else {
                if (sectionType === 'heading') {
                    // Continue with heading content (multiline headings are rare but possible)
                    currentSection += '\n' + line;
                } else if (sectionType === 'list') {
                    // End list and start new paragraph
                    sections.push({
                        type: sectionType,
                        content: currentSection.trim()
                    });
                    currentSection = line;
                    sectionType = 'paragraph';
                } else {
                    // Add to paragraph
                    if (currentSection) {
                        currentSection += '\n' + line;
                    } else {
                        currentSection = line;
                    }
                    sectionType = 'paragraph';
                }
            }
        }

        // Add final section if exists
        if (currentSection.trim()) {
            sections.push({
                type: sectionType,
                content: currentSection.trim()
            });
        }

        return sections;
    }

    /**
     * Translate article content to target language
     */
    async translateArticleContent(parsedContent, targetLanguage, isRetry = false, enableDebug = false) {
        const retryPrefix = isRetry ? '[RETRY] ' : '';
        const debugPrefix = enableDebug ? '[DEBUG] ' : '';
        
        console.log(`    ${retryPrefix}${debugPrefix}Translating frontmatter...`);
        
        // Set debug mode on translator if needed
        if (enableDebug) {
            this.translator.enableDetailedLogging = true;
        }
        // Protect template directives, shortcodes, code blocks and inline code in frontmatter
        const frontMatterProtection = this.extractPlaceholders(parsedContent.frontMatter);
        const frontMatterForTranslation = frontMatterProtection.text;

        const translatedFrontmatterRaw = await this.translator.translateFrontmatter(
            frontMatterForTranslation,
            targetLanguage
        );

        // Restore protected placeholders in translated frontmatter
        const translatedFrontmatter = this.restorePlaceholders(translatedFrontmatterRaw, frontMatterProtection.map);

        console.log(`    Translating content sections...`);
        const translatedSections = [];
        
        for (let i = 0; i < parsedContent.sections.length; i++) {
            const section = parsedContent.sections[i];
            console.log(`    Processing section ${i + 1}/${parsedContent.sections.length} (${section.type})...`);

            // Extract placeholders for this section to protect shortcodes/templates/code
            const protection = this.extractPlaceholders(section.content);
            const forTranslation = protection.text;

            let translatedSection;

            switch (section.type) {
                case 'heading': {
                    const translatedRaw = await this.translator.translateHeading(forTranslation, targetLanguage);
                    translatedSection = {
                        type: 'heading',
                        content: this.restorePlaceholders(translatedRaw, protection.map)
                    };
                    break;
                }

                case 'paragraph': {
                    // Only translate non-technical paragraphs
                    if (this.translator.containsTechnicalContent(section.content)) {
                        console.log(`      Skipping technical content...`);
                        translatedSection = section; // Keep original technical content untouched
                    } else {
                        const translatedRaw = await this.translator.translateParagraph(forTranslation, targetLanguage);
                        translatedSection = {
                            type: 'paragraph',
                            content: this.restorePlaceholders(translatedRaw, protection.map)
                        };
                    }
                    break;
                }

                case 'list': {
                    console.log(`      Translating list items...`);
                    const translatedRaw = await this.translator.translateList(forTranslation, targetLanguage);
                    translatedSection = {
                        type: 'list',
                        content: this.restorePlaceholders(translatedRaw, protection.map)
                    };
                    break;
                }

                case 'code':
                case 'gist':
                    // Keep code blocks and gists as-is (they were preserved by extraction too)
                    translatedSection = section;
                    break;

                default: {
                    // Default: translate and restore placeholders
                    const translatedRaw = await this.translator.translateParagraph(forTranslation, targetLanguage);
                    translatedSection = {
                        type: section.type,
                        content: this.restorePlaceholders(translatedRaw, protection.map)
                    };
                }
            }

            translatedSections.push(translatedSection);
        }

        return {
            frontMatter: this.buildTranslatedFrontmatter(parsedContent.frontMatter, translatedFrontmatter),
            sections: translatedSections
        };
    }

    /**
     * Build translated frontmatter by replacing translated fields
     */
    buildTranslatedFrontmatter(originalFrontmatter, translations) {
        let translatedFrontmatter = originalFrontmatter;

        // Replace title
        if (translations.title) {
            translatedFrontmatter = translatedFrontmatter.replace(
                /title:\s*"(.+)"/,
                `title: "${translations.title}"`
            );
        }

        // Replace description
        if (translations.description) {
            translatedFrontmatter = translatedFrontmatter.replace(
                /description:\s*"(.+)"/,
                `description: "${translations.description}"`
            );
        }

        // Replace keywords
        if (translations.keywords) {
            translatedFrontmatter = translatedFrontmatter.replace(
                /keywords:\s*\[([\s\S]*?)\]/,
                `keywords: [\n    ${translations.keywords}\n    ]`
            );
        }

        // Replace steps
        for (const [stepKey, stepValue] of Object.entries(translations.steps)) {
            if (stepValue) {
                const stepPattern = new RegExp(`${stepKey}:\\s*"(.+)"`);
                translatedFrontmatter = translatedFrontmatter.replace(
                    stepPattern,
                    `${stepKey}: "${stepValue}"`
                );
            }
        }

        return translatedFrontmatter;
    }

    /**
     * Create target file path for translated article
     */
    createTargetFilePath(task, targetLanguage) {
        const targetPath = path.join(
            this.repoRoot,
            'content',
            targetLanguage,
            task.product,
            task.platform,
            task.articlePath
        );

        // Ensure directory exists
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        return targetPath;
    }

    /**
     * Save translated article to file
     */
    saveTranslatedArticle(translatedContent, outputPath) {
        // Build final content
        let finalContent = '---\n' + translatedContent.frontMatter + '\n---\n\n';
        
        // Add sections
        for (const section of translatedContent.sections) {
            finalContent += section.content + '\n\n';
        }

        // Clean up extra newlines
        finalContent = finalContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';

        // Write to file
        fs.writeFileSync(outputPath, finalContent, 'utf8');
    }

    /**
     * Generate detailed processing report
     */
    generateProcessingReport(tasks) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalArticles: tasks.length,
                processedArticles: this.processedCount,
                criticalErrors: this.errorCount,
                totalTranslations: this.totalTranslations,
                successfulTranslations: this.successfulTranslations,
                failedTranslations: this.failedTranslations,
                successRate: parseFloat(((this.successfulTranslations / this.totalTranslations) * 100).toFixed(1))
            },
            failedTranslations: this.failedLanguagesDetails,
            processedArticles: tasks.map(task => ({
                title: task.title,
                product: task.product,
                platform: task.platform,
                targetLanguages: task.targetLanguages.length,
                estimatedFiles: task.targetLanguages.length
            }))
        };

        const reportPath = path.join(__dirname, 'processing-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`Processing report saved to: ${reportPath}`);
    }

    /**
     * Extract placeholders for constructs that must be preserved exactly by the LLM
     * Returns { text, map } where text is the input with placeholders and map is an index->original map
     */
    extractPlaceholders(text) {
        if (!text || typeof text !== 'string') return { text: text || '', map: {} };

        const map = {};
        let idx = 0;

        // Patterns to preserve: Hugo shortcodes {{< ... >}}, Hugo templates {{ ... }}, code blocks ```...```, inline code `...`
        const pattern = /(\{\{<[^>]*>\}\}|\{\{[^}]*\}\}|```[\s\S]*?```|`[^`]*`)/g;

        const replaced = text.replace(pattern, (match) => {
            const key = `__PLACEHOLDER_${idx}__`;
            map[key] = match;
            idx++;
            return key;
        });

        return { text: replaced, map };
    }

    /**
     * Restore previously extracted placeholders into text
     */
    restorePlaceholders(text, map) {
        if (!text || typeof text !== 'string') return text;
        if (!map) return text;

        let restored = text;
        Object.keys(map).forEach(key => {
            // Replace all occurrences of the key with the original
            restored = restored.split(key).join(map[key]);
        });

        return restored;
    }
}

// Command line execution
if (require.main === module) {
    const processor = new TranslationProcessor();
    processor.processTranslationTasks()
        .then(result => {
            if (result.success) {
                console.log('Translation processing completed successfully');
                process.exit(0);
            } else {
                console.error('Translation processing failed:', result.error);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = TranslationProcessor;