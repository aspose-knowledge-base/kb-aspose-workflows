#!/usr/bin/env node

/**
 * Translation Content Validator
 * 
 * Validates translation quality, structure preservation, and proper handling
 * of Hugo shortcodes and links
 */

const fs = require('fs');
const path = require('path');

class TranslationValidator {
    constructor() {
        this.repoRoot = path.resolve(__dirname, '../../');
        this.validationResults = [];
        this.errorCount = 0;
        this.warningCount = 0;
    }

    /**
     * Validate all translated files
     */
    async validateTranslations() {
        try {
            // Load translation tasks to know what files to validate
            const tasksPath = path.join(this.repoRoot, 'translation-tasks.json');
            if (!fs.existsSync(tasksPath)) {
                throw new Error('No translation tasks file found.');
            }

            const tasksData = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
            const { tasks } = tasksData;

            if (!tasks || tasks.length === 0) {
                console.log('No translation tasks to validate');
                return { success: true, errors: 0, warnings: 0 };
            }

            console.log(`Starting validation for ${tasks.length} articles...`);

            // Validate each translated article
            for (const task of tasks) {
                console.log(`\nValidating: ${task.title} (${task.product}/${task.platform})`);
                
                // Read source file
                const sourceContent = fs.readFileSync(task.fullPath, 'utf8');
                
                // Validate each target language
                for (const targetLang of task.targetLanguages) {
                    const targetPath = this.getTargetFilePath(task, targetLang);
                    
                    if (fs.existsSync(targetPath)) {
                        console.log(`  Validating ${targetLang}...`);
                        await this.validateSingleTranslation(
                            sourceContent, 
                            targetPath, 
                            targetLang,
                            task
                        );
                    } else {
                        this.addError(`Missing translated file: ${targetPath}`, task, targetLang);
                    }
                }
            }

            console.log(`\nValidation completed:`);
            console.log(`- Errors: ${this.errorCount}`);
            console.log(`- Warnings: ${this.warningCount}`);

            // Save validation report
            this.saveValidationReport();

            return { 
                success: this.errorCount === 0, 
                errors: this.errorCount, 
                warnings: this.warningCount,
                results: this.validationResults
            };
        } catch (error) {
            console.error('Error in validation:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Validate a single translation
     */
    async validateSingleTranslation(sourceContent, targetPath, targetLanguage, task) {
        try {
            const targetContent = fs.readFileSync(targetPath, 'utf8');
            
            const sourceData = this.parseMarkdownFile(sourceContent);
            const targetData = this.parseMarkdownFile(targetContent);

            // Validate structure
            this.validateStructure(sourceData, targetData, task, targetLanguage);
            
            // Validate frontmatter
            this.validateFrontmatter(sourceData.frontMatter, targetData.frontMatter, task, targetLanguage);
            
            // Validate content preservation
            this.validateContentPreservation(sourceData, targetData, task, targetLanguage);
            
            // Validate technical elements
            this.validateTechnicalElements(sourceData, targetData, task, targetLanguage);

            console.log(`    ✓ Validation passed for ${targetLanguage}`);
        } catch (error) {
            this.addError(`Validation failed: ${error.message}`, task, targetLanguage);
        }
    }

    /**
     * Parse markdown file into structured data
     */
    parseMarkdownFile(content) {
        // Extract frontmatter - handle both Unix (\n) and Windows (\r\n) line endings
        const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!frontMatterMatch) {
            throw new Error('No frontmatter found');
        }

        const frontMatter = frontMatterMatch[1];
        const bodyContent = content.substring(frontMatterMatch[0].length).trim();

        // Extract gists
        const gists = [...bodyContent.matchAll(/{{<\s*gist\s+([\w-]+)\s+([\w-]+)\s*>}}/g)];
        
        // Extract links
        const links = [...bodyContent.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
        
        // Extract code blocks
        const codeBlocks = [...bodyContent.matchAll(/```[\s\S]*?```/g)];
        
        // Extract headings
        const headings = [...bodyContent.matchAll(/^#{1,6}\s+(.+)$/gm)];

        return {
            frontMatter,
            bodyContent,
            gists: gists.map(match => ({ full: match[0], user: match[1], id: match[2] })),
            links: links.map(match => ({ full: match[0], text: match[1], url: match[2] })),
            codeBlocks: codeBlocks.map(match => match[0]),
            headings: headings.map(match => ({ full: match[0], text: match[1] }))
        };
    }

    /**
     * Validate structure consistency
     */
    validateStructure(sourceData, targetData, task, targetLanguage) {
        // Check gist count
        if (sourceData.gists.length !== targetData.gists.length) {
            this.addError(
                `Gist count mismatch: source=${sourceData.gists.length}, target=${targetData.gists.length}`,
                task,
                targetLanguage
            );
        }

        // Check code block count
        if (sourceData.codeBlocks.length !== targetData.codeBlocks.length) {
            this.addError(
                `Code block count mismatch: source=${sourceData.codeBlocks.length}, target=${targetData.codeBlocks.length}`,
                task,
                targetLanguage
            );
        }

        // Check heading count
        if (sourceData.headings.length !== targetData.headings.length) {
            this.addWarning(
                `Heading count mismatch: source=${sourceData.headings.length}, target=${targetData.headings.length}`,
                task,
                targetLanguage
            );
        }
    }

    /**
     * Validate frontmatter fields
     */
    validateFrontmatter(sourceFrontmatter, targetFrontmatter, task, targetLanguage) {
        // Check required fields exist
        const requiredFields = ['title', 'description', 'productname', 'productkey', 'platformkey'];
        
        for (const field of requiredFields) {
            const sourceField = this.extractFrontmatterField(sourceFrontmatter, field);
            const targetField = this.extractFrontmatterField(targetFrontmatter, field);
            
            if (sourceField && !targetField) {
                this.addError(`Missing frontmatter field: ${field}`, task, targetLanguage);
            }
        }

        // Check that technical fields are not translated
        const technicalFields = ['productname', 'productkey', 'platformkey', 'productplatform', 'date', 'lastmod', 'weight', 'draft', 'type'];
        
        for (const field of technicalFields) {
            const sourceValue = this.extractFrontmatterField(sourceFrontmatter, field);
            const targetValue = this.extractFrontmatterField(targetFrontmatter, field);
            
            if (sourceValue && targetValue && sourceValue !== targetValue) {
                this.addWarning(`Technical field '${field}' was modified: '${sourceValue}' -> '${targetValue}'`, task, targetLanguage);
            }
        }
    }

    /**
     * Validate content preservation (links, gists, code)
     */
    validateContentPreservation(sourceData, targetData, task, targetLanguage) {
        // Check gist preservation
        for (let i = 0; i < Math.min(sourceData.gists.length, targetData.gists.length); i++) {
            const sourceGist = sourceData.gists[i];
            const targetGist = targetData.gists[i];
            
            if (sourceGist.user !== targetGist.user || sourceGist.id !== targetGist.id) {
                this.addError(
                    `Gist modified: source='${sourceGist.full}', target='${targetGist.full}'`,
                    task,
                    targetLanguage
                );
            }
        }

        // Check link URL preservation
        const sourceUrls = sourceData.links.map(link => link.url);
        const targetUrls = targetData.links.map(link => link.url);
        
        for (const sourceUrl of sourceUrls) {
            if (!targetUrls.includes(sourceUrl)) {
                this.addWarning(`URL missing in translation: ${sourceUrl}`, task, targetLanguage);
            }
        }

        // Check code block preservation
        for (let i = 0; i < Math.min(sourceData.codeBlocks.length, targetData.codeBlocks.length); i++) {
            if (sourceData.codeBlocks[i] !== targetData.codeBlocks[i]) {
                this.addWarning(`Code block ${i + 1} was modified`, task, targetLanguage);
            }
        }
    }

    /**
     * Validate technical elements are preserved
     */
    validateTechnicalElements(sourceData, targetData, task, targetLanguage) {
        // Check for common technical patterns that should be preserved
        const technicalPatterns = [
            /C#/g,
            /\.NET/g,
            /PDF/g,
            /API/g,
            /JSON/g,
            /XML/g,
            /HTML/g,
            /CSS/g,
            /JavaScript/g,
            /Java/g
        ];

        for (const pattern of technicalPatterns) {
            const sourceMatches = (sourceData.bodyContent.match(pattern) || []).length;
            const targetMatches = (targetData.bodyContent.match(pattern) || []).length;
            
            if (sourceMatches > 0 && targetMatches < sourceMatches * 0.8) {
                this.addWarning(
                    `Technical term '${pattern.source}' count significantly reduced: ${sourceMatches} -> ${targetMatches}`,
                    task,
                    targetLanguage
                );
            }
        }
    }

    /**
     * Extract frontmatter field value
     */
    extractFrontmatterField(frontmatter, fieldName) {
        const match = frontmatter.match(new RegExp(`^${fieldName}:\\s*"?([^"\\n]+)"?$`, 'm'));
        return match ? match[1].replace(/"/g, '') : null;
    }

    /**
     * Get target file path
     */
    getTargetFilePath(task, targetLanguage) {
        return path.join(
            this.repoRoot,
            'content',
            targetLanguage,
            task.product,
            task.platform,
            task.articlePath
        );
    }

    /**
     * Add error to validation results
     */
    addError(message, task, targetLanguage) {
        this.validationResults.push({
            type: 'error',
            message,
            article: task.title,
            product: task.product,
            platform: task.platform,
            language: targetLanguage
        });
        this.errorCount++;
        console.log(`    ✗ ERROR: ${message}`);
    }

    /**
     * Add warning to validation results
     */
    addWarning(message, task, targetLanguage) {
        this.validationResults.push({
            type: 'warning',
            message,
            article: task.title,
            product: task.product,
            platform: task.platform,
            language: targetLanguage
        });
        this.warningCount++;
        console.log(`    ⚠ WARNING: ${message}`);
    }

    /**
     * Save validation report
     */
    saveValidationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalErrors: this.errorCount,
                totalWarnings: this.warningCount,
                validationPassed: this.errorCount === 0
            },
            results: this.validationResults
        };

        const reportPath = path.join(this.repoRoot, 'translation-validation-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nValidation report saved to: ${reportPath}`);
    }
}

// Command line execution
if (require.main === module) {
    const validator = new TranslationValidator();
    validator.validateTranslations()
        .then(result => {
            if (result.success) {
                console.log('Translation validation completed successfully');
                process.exit(0);
            } else {
                console.error('Translation validation failed:', result.error || `${result.errors} errors found`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = TranslationValidator;