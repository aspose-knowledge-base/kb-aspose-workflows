#!/usr/bin/env node

/**
 * Translation Article Detector
 * 
 * Identifies recently added/modified articles in content/en/{product}/{java|net} 
 * from a single date for translation workflow
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Available products
const PRODUCTS = [
    'annotation', 'comparison', 
    'conversion', 'editor', 'merger', 'metadata', 
    'parser', 'viewer', 'signature', 'total'
];

class TranslationDetector {
    constructor() {
        this.repoRoot = path.resolve(__dirname, '../../');
        this.contentEnPath = path.join(this.repoRoot, 'content/en');
        this.supportedLanguages = [
            'ar', 'bg', 'cs', 'de', 'el', 'es', 'fa', 'fr', 'hi', 'hr', 'hu', 'hy',
            'id', 'it', 'ja', 'ko', 'lt', 'nl', 'pl', 'pt', 'ru', 'sv', 'th', 'tr', 'uk', 'vi', 'zh'
        ];
        this.platforms = ['java', 'net'];
    }

    /**
     * Get the last commit date for a file
     */
    getLastCommitDate(filePath) {
        try {
            const relativePath = path.relative(this.repoRoot, filePath);
            const result = execSync(
                `git log -1 --format="%ad" --date=short -- "${relativePath}"`,
                { 
                    cwd: this.repoRoot, 
                    encoding: 'utf8' 
                }
            ).trim();
            
            return result.replace(/"/g, '') || null;
        } catch (error) {
            console.error(`Error getting commit date for ${filePath}:`, error.message);
            return null;
        }
    }

    /**
     * Get articles modified on a specific date
     */
    getArticlesFromDate(targetDate = null) {
        // If no date provided, use yesterday's date
        if (!targetDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            targetDate = yesterday.toISOString().split('T')[0];
        }

        console.log(`Looking for articles modified on: ${targetDate}`);
        
        const articlesForTranslation = [];

        // Check all products
        for (const product of PRODUCTS) {
            console.log(`Scanning product: ${product}`);
            
            // Check both java and net platforms for each product
            for (const platform of this.platforms) {
                const platformPath = path.join(this.contentEnPath, product, platform);
                
                if (!fs.existsSync(platformPath)) {
                    console.log(`Platform path does not exist: ${platformPath}`);
                    continue;
                }

                console.log(`  - Scanning ${product}/${platform}`);
                const articles = this.scanDirectory(platformPath, targetDate, product);
                articlesForTranslation.push(...articles);
            }
        }

        console.log(`Found ${articlesForTranslation.length} articles for translation from ${targetDate}`);
        return articlesForTranslation;
    }

    /**
     * Recursively scan directory for markdown files modified on target date
     */
    scanDirectory(dirPath, targetDate, product) {
        const articles = [];
        
        try {
            const items = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                
                if (item.isDirectory()) {
                    // Recursively scan subdirectories
                    articles.push(...this.scanDirectory(fullPath, targetDate, product));
                } else if (item.name.endsWith('.md') && !item.name.startsWith('_index')) {
                    // Check if this markdown file was modified on the target date
                    const lastCommitDate = this.getLastCommitDate(fullPath);
                    
                    if (lastCommitDate === targetDate) {
                        const articleInfo = this.extractArticleInfo(fullPath, product);
                        if (articleInfo) {
                            articles.push(articleInfo);
                            console.log(`Found article: ${articleInfo.title} (${articleInfo.product}/${articleInfo.platform})`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${dirPath}:`, error.message);
        }
        
        return articles;
    }

    /**
     * Extract article information from markdown file
     */
    extractArticleInfo(filePath, product) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(this.repoRoot, filePath);
            
            // Extract front matter - handle both Unix (\n) and Windows (\r\n) line endings
            const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (!frontMatterMatch) {
                console.warn(`No front matter found in: ${filePath}`);
                return null;
            }

            const frontMatter = frontMatterMatch[1];
            const titleMatch = frontMatter.match(/^title:\s*"(.+)"$/m);
            const platformMatch = frontMatter.match(/^platformkey:\s*"(.+)"$/m);
            
            if (!titleMatch || !platformMatch) {
                console.warn(`Missing title or platform in: ${filePath}`);
                return null;
            }

            // Determine target path structure
            const pathParts = relativePath.split('/');
            const platform = pathParts[3]; // content/en/{product}/{platform}/...
            const articlePath = pathParts.slice(4).join('/'); // remaining path after platform

            return {
                title: titleMatch[1],
                product: product,
                platform: platform,
                articlePath: articlePath,
                fullPath: filePath,
                relativePath: relativePath
            };
        } catch (error) {
            console.error(`Error extracting article info from ${filePath}:`, error.message);
            return null;
        }
    }

    /**
     * Check which languages need translation for each article
     * Note: Always includes all languages to ensure translations stay up-to-date
     */
    checkTranslationNeeds(articles) {
        const translationTasks = [];

        for (const article of articles) {
            // Always translate to all supported languages
            // This ensures translations are updated when source content changes
            translationTasks.push({
                ...article,
                targetLanguages: this.supportedLanguages
            });
            
            console.log(`Article "${article.title}" will be translated to all ${this.supportedLanguages.length} languages`);
        }

        return translationTasks;
    }

    /**
     * Main execution function
     */
    async detectArticlesForTranslation(targetDate = null) {
        try {
            console.log('Starting translation detection...');
            
            // Get articles from the target date
            const articles = this.getArticlesFromDate(targetDate);
            
            if (articles.length === 0) {
                console.log('No articles found for translation');
                return { success: true, tasks: [] };
            }

            // Prepare translation tasks for all languages
            const translationTasks = this.checkTranslationNeeds(articles);
            
            // Save results to JSON file
            const outputPath = path.join(this.repoRoot, 'translation-tasks.json');
            const result = {
                timestamp: new Date().toISOString(),
                targetDate: targetDate || new Date(Date.now() - 86400000).toISOString().split('T')[0],
                totalArticles: articles.length,
                totalTasks: translationTasks.length,
                tasks: translationTasks
            };

            fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
            console.log(`Translation tasks saved to: ${outputPath}`);
            console.log(`Total translation tasks: ${translationTasks.length}`);

            return { success: true, tasks: translationTasks };
        } catch (error) {
            console.error('Error in translation detection:', error);
            return { success: false, error: error.message };
        }
    }
}

// Command line execution
if (require.main === module) {
    const targetDate = process.argv[2]; // Optional date parameter (YYYY-MM-DD)
    
    const detector = new TranslationDetector();
    detector.detectArticlesForTranslation(targetDate)
        .then(result => {
            if (result.success) {
                console.log('Translation detection completed successfully');
                process.exit(0);
            } else {
                console.error('Translation detection failed:', result.error);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = TranslationDetector;