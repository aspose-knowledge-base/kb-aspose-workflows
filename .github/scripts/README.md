# Automated Knowledge Base Management System

An intelligent, autonomous system for managing and maintaining the Conholdate Knowledge Base. This system uses AI-powered workflows to continuously enhance content quality, maintain multilingual coverage, and ensure site reliability through automated testing and deployment.

## 🎯 System Overview

The system consists of three interconnected workflows that work together as an autonomous body:

1. **Content Rewriter** - Enhances article quality and SEO
2. **Translation Workflow** - Maintains multilingual content coverage
3. **PR Review Automation** - Validates and auto-merges changes

### 🔄 How They Work Together

```
┌─────────────────────────────────────────────────────────────────┐
│                    Autonomous KB Management System               │
└─────────────────────────────────────────────────────────────────┘

        ┌──────────────────────────────────────────┐
        │   CONTENT REWRITER (2 AM UTC Daily)      │
        │  Selects 2-5 articles older than 30 days │
        │  Enhances SEO & readability with AI      │
        └──────────────┬───────────────────────────┘
                       │
                       ▼ Creates PR
        ┌──────────────────────────────────────────┐
        │  PR REVIEW AUTOMATION (Auto-triggered)   │
        │  Tests Hugo build (QA config)            │
        │  Validates site integrity                │
        └──────────────┬───────────────────────────┘
                       │
                       ▼ Auto-merge if build succeeds
        ┌──────────────────────────────────────────┐
        │      MERGED TO MASTER BRANCH             │
        │  Content deployed to staging (QA)        │
        └──────────────┬───────────────────────────┘
                       │
                       ▼ Triggers translation
        ┌──────────────────────────────────────────┐
        │  TRANSLATION WORKFLOW (3 AM UTC Daily)   │
        │  Detects yesterday's changes             │
        │  Translates to 27 languages              │
        └──────────────┬───────────────────────────┘
                       │
                       ▼ Creates PR
        ┌──────────────────────────────────────────┐
        │  PR REVIEW AUTOMATION (Auto-triggered)   │
        │  Tests Hugo build with translations      │
        │  Validates multilingual site             │
        └──────────────┬───────────────────────────┘
                       │
                       ▼ Auto-merge if build succeeds
        ┌──────────────────────────────────────────┐
        │      COMPLETE DEPLOYMENT CYCLE           │
        │  Full multilingual site ready for prod   │
        └──────────────────────────────────────────┘
```

---

## 📋 Workflow 1: Content Rewriter

### Purpose
Automatically enhances Knowledge Base articles using AI-powered rewriting to improve SEO and readability while maintaining technical accuracy.

### Schedule
Runs daily at **2 AM UTC**

### What It Does
- Randomly selects 2-5 articles from `content/en/total/{java|net}/` that haven't been modified in 30+ days
- Uses LiteLLM API to rewrite opening and closing paragraphs
- Updates the `lastmod` field to current date
- Creates Pull Requests for automated review
- Preserves all technical content, links, and code samples

### What It Does
- Randomly selects 2-5 articles from `content/en/total/{java|net}/` that haven't been modified in 30+ days
- Uses LiteLLM API to rewrite opening and closing paragraphs
- Updates the `lastmod` field to current date
- Creates Pull Requests for automated review
- Preserves all technical content, links, and code samples

### Components

**Scripts:**
- `article-selector.js` - Identifies eligible articles for rewriting
- `llm-rewriter.js` - Handles LiteLLM API communication
- `content-processor.js` - Main processing logic with validation
- `content-validator.js` - Ensures content integrity and quality

**Workflow:**
- `.github/workflows/content-rewriter.yml` - Orchestrates the process

### What Gets Modified

✅ **Modified:**
- `lastmod` field in front matter (updated to current date)
- Opening paragraph (before first heading/gist)
- Closing paragraph (after last gist)

❌ **Preserved:**
- All front matter fields except `lastmod`
- Headings and structure
- Code samples and gist shortcodes
- Links and references
- Technical accuracy and API names

---

## 🌍 Workflow 2: Translation Workflow

### Purpose
Automatically translates newly modified English articles to 27 languages, maintaining consistent multilingual content across the Knowledge Base.

### Schedule
Runs daily at **3 AM UTC** (1 hour after content rewriter)

### What It Does
- Detects articles modified in the English content directory on the previous day
- Translates each article to 27 target languages using LiteLLM API
- Preserves all technical elements (class names, APIs, code blocks)
- Maintains Hugo shortcodes and gist references
- Creates comprehensive Pull Requests with translation summary
- Validates translation quality and structural integrity

### Target Languages (27)

| Region | Languages |
|--------|-----------|
| **Middle East & Africa** | Arabic (ar), Persian/Farsi (fa) |
| **Europe** | Bulgarian (bg), Czech (cs), German (de), Greek (el), Spanish (es), French (fr), Croatian (hr), Hungarian (hu), Armenian (hy), Italian (it), Lithuanian (lt), Dutch (nl), Polish (pl), Portuguese (pt), Russian (ru), Swedish (sv), Turkish (tr), Ukrainian (uk) |
| **Asia** | Hindi (hi), Indonesian (id), Japanese (ja), Korean (ko), Thai (th), Vietnamese (vi), Chinese (zh) |

### Components

**Scripts:**
- `translation-detector.js` - Identifies articles modified on target date
- `llm-translator.js` - Handles multilingual LiteLLM API calls
- `translation-processor.js` - Main translation orchestration
- `translation-validator.js` - Validates translation quality and structure

**Workflow:**
- `.github/workflows/translation-workflow.yml` - Orchestrates translation process

### What Gets Translated

✅ **Translated:**
- Article title and description
- All paragraph content
- Headings and subheadings
- Meta descriptions for SEO
- Keywords and tags

❌ **Preserved (Not Translated):**
- Code blocks and samples
- Class names and API references
- URLs and links
- Hugo shortcodes (gists, etc.)
- Technical terminology
- File paths and commands

### Output
For each article, creates/updates files in:
```
content/{lang}/total/{java|net}/{article-name}.md
```
Total files per article: **27 language files**

---

## 🔍 Workflow 3: PR Review Automation

### Purpose
Automatically validates Pull Requests by testing Hugo builds and auto-merges successful changes, ensuring only working code reaches production.

### Triggers
- **Automatic:** When PRs are opened/updated targeting `main` or `master` branches
- **Manual:** Can be triggered via workflow dispatch with PR number

### What It Does
- Detects PR details (number, author, branch, changes)
- Checks out the PR branch
- Runs Hugo build with QA configuration
- Tests site compilation and integrity
- Posts build status comment on PR
- **Auto-merges PR if build succeeds** (no manual intervention needed)
- Posts success/failure notifications

### Components

**Workflow:**
- `.github/workflows/pr-review-automation.yml` - Full automation pipeline

### Build Validation

**QA Build Test:**
```bash
hugo --config config-qa.toml --buildDrafts=false --minify
```

**Checks:**
- ✅ Hugo compilation succeeds
- ✅ All content files are valid
- ✅ No broken references or links
- ✅ Proper front matter structure
- ✅ Template rendering works
- ✅ Assets are accessible

### Auto-merge Behavior

**Conditions for Auto-merge:**
1. Hugo QA build passes successfully
2. No compilation errors

**If Build Fails:**
- Posts failure comment on PR
- Does NOT auto-merge
- Requires manual intervention

**If Build Succeeds:**
- Posts success comment
- Automatically merges PR with squash commit
- Deletes source branch
- Triggers deployment pipeline

### Permissions Required
```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

---

## 🤖 System Collaboration & Autonomous Operation

### The Complete Cycle

This system operates as a **fully autonomous body** that requires minimal human intervention:

1. **Daily Content Enhancement (2 AM UTC)**
   - Content Rewriter selects and enhances articles
   - Creates PR with improvements
   - **→ Triggers PR Review Automation**

2. **Automated Validation (Immediately after)**
   - PR Review builds and tests changes
   - Validates site integrity
   - **→ Auto-merges if successful**

3. **Deployment to Staging**
   - Merged changes deploy to QA environment
   - Live staging site updated
   - **→ Ready for translation detection**

4. **Multilingual Translation (3 AM UTC)**
   - Translation Workflow detects yesterday's changes
   - Translates to 27 languages (~27 files per article)
   - Creates massive multilingual PR
   - **→ Triggers PR Review Automation again**

5. **Final Validation & Deployment**
   - PR Review tests multilingual build
   - Validates all 27 language versions
   - **→ Auto-merges if successful**

6. **Complete Deployment**
   - Full multilingual site ready
   - All languages in sync
   - **→ System ready for next cycle**

### 🔄 Autonomous Features

**Zero-Touch Operation:**
- Runs automatically on schedule
- No manual PR reviews required
- Self-healing validation
- Automatic rollback on failures

**Intelligent Selection:**
- Smart article selection (age-based)
- Random distribution for fairness
- Platform balance (Java/NET)
- Avoid recent articles

**Quality Assurance:**
- Multi-layer validation
- Content preservation checks
- Technical accuracy verification
- Link integrity validation

**Error Handling:**
- Graceful failure recovery
- Detailed error reporting
- Automatic retry mechanisms
- Rate limiting protection

### 📊 System Metrics

**Daily Processing:**
- 2-5 articles enhanced
- 54-135 translation files created (27 languages × 2-5 articles)
- 2-3 PRs created and merged
- ~10-15 minute total processing time

**Monthly Impact:**
- ~75 articles enhanced (2.5 avg × 30 days)
- ~2,025 translation files created
- 100% automated deployment
- Zero manual intervention required

---

## 🔧 All System Components

### Scripts Directory (`/.github/scripts/`)

**Content Rewriter:**
- `article-selector.js` - Identifies eligible articles for rewriting
- `llm-rewriter.js` - Handles LiteLLM API communication for rewriting
- `content-processor.js` - Main processing logic with validation
- `content-validator.js` - Ensures content integrity and quality

**Translation System:**
- `translation-detector.js` - Identifies articles modified on target date
- `llm-translator.js` - Handles multilingual LiteLLM API calls
- `translation-processor.js` - Main translation orchestration
- `translation-validator.js` - Validates translation quality

### Workflows Directory (`/.github/workflows/`)

- `content-rewriter.yml` - Content enhancement workflow (2 AM UTC)
- `translation-workflow.yml` - Multilingual translation workflow (3 AM UTC)
- `pr-review-automation.yml` - PR validation and auto-merge workflow
- `main-qa.yml` - QA deployment workflow (on push to master)
- `main-live.yml` - Production deployment workflow (manual trigger)

## 🚀 Setup

### 1. Required GitHub Secrets

Add these secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Description | Required For |
|-------------|-------------|--------------|
| `LLM_API_KEY` | LiteLLM API key for AI operations | Content Rewriter, Translation |
| `GH_PAT` | Personal Access Token with `repo` & `workflow` permissions | Auto-triggering PR workflows |
| `ACCESS_KEY` | AWS Access Key for S3 deployment | QA/Live deployment |
| `SECRET_ACCESS` | AWS Secret Key for S3 deployment | QA/Live deployment |

### 2. Personal Access Token Setup (Critical!)

**Why needed:** PRs created with `GITHUB_TOKEN` don't trigger other workflows. The `GH_PAT` allows workflow chaining.

**How to create:**
1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Name: `kb-conholdate-workflows`
4. Scopes: ✅ `repo`, ✅ `workflow`
5. Copy token and add as `GH_PAT` secret

**Without GH_PAT:** Workflows create PRs but don't auto-trigger PR Review  
**With GH_PAT:** Full autonomous operation with automatic PR reviews ✅

### 3. Verify Workflow Permissions

Ensure workflows have proper permissions in repository settings:

**Settings → Actions → General → Workflow permissions**
- ✅ Read and write permissions
- ✅ Allow GitHub Actions to create and approve pull requests

### 4. Test the System

**Test Content Rewriter:**
```
Repository → Actions → Automated Content Rewriting → Run workflow
```

**Test Translation Workflow:**
```
Repository → Actions → Automated Translation Workflow → Run workflow
Input target date: YYYY-MM-DD (e.g., 2025-11-23)
```

**Test PR Review (Manual Trigger):**
```
Repository → Actions → Automated PR Review and Merge → Run workflow
Input PR number: (e.g., 123)
```

---

## 🎨 Visual System Diagram

```
╔══════════════════════════════════════════════════════════════════╗
║           AUTONOMOUS KNOWLEDGE BASE MANAGEMENT SYSTEM            ║
╚══════════════════════════════════════════════════════════════════╝

   ┌─────────────────────────────────────────────────────────┐
   │                    DAILY CYCLE START                     │
   │                      (2:00 AM UTC)                       │
   └────────────────────────┬────────────────────────────────┘
                            │
                            ▼
   ╔═════════════════════════════════════════════════════════╗
   ║          🤖 CONTENT REWRITER WORKFLOW                   ║
   ║  • Scans articles > 30 days old                         ║
   ║  • Randomly selects 2-5 articles                        ║
   ║  • AI-enhances opening & closing paragraphs             ║
   ║  • Updates lastmod field                                ║
   ║  • Creates PR: "Automated Content Enhancement"          ║
   ╚═══════════════════════════╦═════════════════════════════╝
                               │
                               ▼ [PR Created]
   ╔═════════════════════════════════════════════════════════╗
   ║        🔍 PR REVIEW AUTOMATION (Auto-triggered)         ║
   ║  • Checks out PR branch                                 ║
   ║  • Runs Hugo build (config-qa.toml)                     ║
   ║  • Validates site compilation                           ║
   ║  • Posts build status comment                           ║
   ╚═══════════════════════════╦═════════════════════════════╝
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼ [Build Success]             ▼ [Build Failed]
   ┌────────────────────────┐    ┌──────────────────────────┐
   │  ✅ AUTO-MERGE PR      │    │  ❌ STOP & NOTIFY        │
   │  • Squash commit       │    │  • Comment on PR         │
   │  • Delete branch       │    │  • Await manual fix      │
   │  • Deploy to QA        │    │  • Workflow ends         │
   └─────────┬──────────────┘    └──────────────────────────┘
             │
             ▼ [Merged to Master]
   ╔═════════════════════════════════════════════════════════╗
   ║            📤 MAIN-QA WORKFLOW (Auto)                   ║
   ║  • Triggered by push to master                          ║
   ║  • Builds site with QA config                           ║
   ║  • Deploys to S3 staging environment                    ║
   ╚═══════════════════════════╦═════════════════════════════╝
                               │
                               ▼ [1 Hour Later: 3:00 AM UTC]
   ╔═════════════════════════════════════════════════════════╗
   ║         🌍 TRANSLATION WORKFLOW                         ║
   ║  • Detects yesterday's English changes                  ║
   ║  • Identifies 1-N modified articles                     ║
   ║  • Translates each to 27 languages                      ║
   ║  • Preserves technical content                          ║
   ║  • Creates PR: "Automated Translation Update"           ║
   ║  • Total files: N articles × 27 languages               ║
   ╚═══════════════════════════╦═════════════════════════════╝
                               │
                               ▼ [PR Created]
   ╔═════════════════════════════════════════════════════════╗
   ║        🔍 PR REVIEW AUTOMATION (Auto-triggered)         ║
   ║  • Checks out PR branch                                 ║
   ║  • Runs Hugo build with all 27 languages                ║
   ║  • Validates multilingual site                          ║
   ║  • Posts build status comment                           ║
   ╚═══════════════════════════╦═════════════════════════════╝
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼ [Build Success]             ▼ [Build Failed]
   ┌────────────────────────┐    ┌──────────────────────────┐
   │  ✅ AUTO-MERGE PR      │    │  ❌ STOP & NOTIFY        │
   │  • Squash commit       │    │  • Comment on PR         │
   │  • Delete branch       │    │  • Await manual fix      │
   │  • Deploy to QA        │    │  • Workflow ends         │
   └─────────┬──────────────┘    └──────────────────────────┘
             │
             ▼ [Merged to Master]
   ╔═════════════════════════════════════════════════════════╗
   ║            📤 MAIN-QA WORKFLOW (Auto)                   ║
   ║  • Triggered by push to master                          ║
   ║  • Builds full multilingual site                        ║
   ║  • Deploys to S3 staging environment                    ║
   ╚═══════════════════════════╦═════════════════════════════╝
                               │
                               ▼ [Manual Review & Approval]
   ╔═════════════════════════════════════════════════════════╗
   ║          🚀 MAIN-LIVE WORKFLOW (Manual)                 ║
   ║  • Manually triggered when ready                        ║
   ║  • Builds production site                               ║
   ║  • Deploys to S3 production environment                 ║
   ║  • Invalidates CDN cache                                ║
   ╚═══════════════════════════╦═════════════════════════════╝
                               │
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │              ✅ CYCLE COMPLETE                           │
   │  • Content enhanced ✓                                   │
   │  • Translations published ✓                             │
   │  • QA environment updated ✓                             │
   │  • Ready for production deployment ✓                    │
   │  • System ready for next cycle (tomorrow 2 AM) ↻        │
   └─────────────────────────────────────────────────────────┘

   ╔═════════════════════════════════════════════════════════╗
   ║                    KEY FEATURES                         ║
   ║  🤖 Fully Autonomous - Zero manual intervention         ║
   ║  🔄 Self-Healing - Auto-stops on build failures         ║
   ║  🌍 Multilingual - 27 languages automatically           ║
   ║  ✅ Quality Assured - Build validation on every PR      ║
   ║   Safe - Preserves technical accuracy & code          ║
   ╚═════════════════════════════════════════════════════════╝
```

---

## � Configuration Options

### Content Rewriter Settings

Edit constants in `article-selector.js`:
```javascript
const DAYS_THRESHOLD = 30;        // Days since last modification
const MIN_ARTICLES_PER_RUN = 2;   // Minimum articles per execution
const MAX_ARTICLES_PER_RUN = 5;   // Maximum articles per execution
```

Edit prompts in `llm-rewriter.js` to adjust rewriting style and focus.

### Translation Workflow Settings

Edit constants in `translation-detector.js`:
```javascript
const TARGET_LANGUAGES = 27;      // Number of target languages
```

Edit prompts in `llm-translator.js` to adjust translation quality and style.

### Workflow Schedules

Modify cron expressions in workflow files:
```yaml
# Content Rewriter - .github/workflows/content-rewriter.yml
schedule:
  - cron: '0 2 * * *'  # Daily at 2 AM UTC

# Translation - .github/workflows/translation-workflow.yml
schedule:
  - cron: '0 3 * * *'  # Daily at 3 AM UTC (1 hour after rewriter)
```

---

## 📊 Monitoring & Debugging

### GitHub Actions Dashboard
- **View runs**: Repository → Actions tab
- **Download artifacts**: Click on workflow run → Artifacts section
- **Check logs**: Expand each step for detailed output

### Workflow Artifacts

**Content Rewriter produces:**
- `selected-articles.json` - List of articles selected
- `processing-report.json` - Processing results and errors

**Translation Workflow produces:**
- `translation-tasks.json` - Translation tasks generated
- `validation-report.json` - Translation quality checks
- `processing-report.json` - Translation results

**PR Review produces:**
- `validation-report.json` - Build validation results
- Build logs in workflow output

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No articles selected | All recent articles < 30 days old | Normal - wait for next cycle |
| API failures | Invalid/expired LLM_API_KEY | Update secret in repository settings |
| PR not auto-merging | Missing GH_PAT secret | Add Personal Access Token as GH_PAT |
| Build failures | Content structure errors | Check validation report, fix manually |
| Translation errors | API rate limits | Workflows have retry logic, will auto-recover |
| Workflows not triggering | Missing GH_PAT | Add PAT with repo + workflow permissions |

### Debug Mode

Enable verbose logging:
```yaml
env:
  DEBUG: true
  LOG_LEVEL: verbose
```

---

## 📝 Example Outputs

### Content Rewriter PR
```
🤖 Automated Content Enhancement - 2025-11-24

## 🤖 Automated Content Enhancement

### 📊 Summary
- **Articles processed**: Total: 3, Java: 2, .NET: 1
- **Branch**: `content-update-2025-11-24-1732435200`

### 📄 Modified Files
- `how-to-add-watermark-to-pdf-using-java.md` (JAVA)
- `compare-pdf-documents-using-csharp.md` (NET)
- `extract-text-from-pdf-in-java.md` (JAVA)
```

### Translation PR
```
🌍 Automated Translation Update - 2025-11-23

## 🌍 Automated Translation Update

### 📊 Summary
- **Articles translated**: 3 articles
- **Platforms**: Java (2), .NET (1)
- **Target languages**: 27 languages
- **Total files created/updated**: ~81 files

### � Translated Articles
- **How to Add Watermark to PDF using Java** (JAVA) → 27 languages
- **Compare PDF Documents using C#** (NET) → 27 languages
```

### PR Review Comment
```
## 🔍 PR Validation Results

**Hugo Build Status:**
- ✅ QA Build: success

✅ **All checks passed!** PR is ready to merge.

---
*Automated validation by PR Review Workflow*
```

---

## 🎯 Benefits & Impact

### SEO & Content Quality
- **Fresh Content Signals**: Regular updates improve search rankings
- **Enhanced Readability**: AI-powered writing improvements
- **Consistent Quality**: Automated validation ensures standards

### Operational Efficiency
- **Zero Manual Work**: Fully autonomous operation
- **24/7 Operation**: Runs on schedule without intervention
- **Scalable**: Handles increasing content volume automatically
- **Audit Trail**: Complete history via Git and PRs

### Multilingual Coverage
- **27 Languages**: Automatic translation to global audience
- **Consistency**: All languages updated simultaneously
- **Technical Accuracy**: Preserves code and API references
- **SEO Optimized**: Translated meta descriptions and keywords

### Risk Mitigation
- **Build Validation**: No broken deployments
- **Automatic Rollback**: Failed builds stop auto-merge
- **Content Preservation**: Technical accuracy maintained
- **Version Control**: Every change tracked in Git

---

## 🚨 Safety & Reliability

### Multi-Layer Validation
1. **Content Level**: Preserves technical elements, code, links
2. **Build Level**: Hugo compilation must succeed
3. **Structure Level**: Markdown and front matter validation
4. **Quality Level**: AI-generated content reviewed

### Failure Handling
- **Graceful Degradation**: System stops on errors, doesn't push bad content
- **Detailed Reporting**: Error messages posted to PR comments
- **Auto-Recovery**: Retry logic for transient failures
- **Manual Override**: Can always intervene if needed

### Data Safety
- **No Data Loss**: All changes in Git with full history
- **Instant Rollback**: `git revert` any problematic merge
- **Branch Protection**: Changes go through PR process
- **Backup**: S3 deployments maintain previous versions

---

## 🎓 Best Practices

### For Administrators

1. **Monitor Daily**: Check Actions tab for any failures
2. **Review PRs Occasionally**: Spot-check AI-generated content quality
3. **Update Secrets**: Rotate API keys periodically
4. **Check Metrics**: Review monthly processing stats
5. **Adjust Schedule**: Modify cron if needed for your timezone

### For Content Writers

1. **Manual Updates**: Still commit directly to English content
2. **Trust the System**: Auto-translation handles multilingual sync
3. **Review Suggestions**: Check rewritten content occasionally
4. **Report Issues**: Flag any AI-generated problems

### For Developers

1. **Test Changes**: Use workflow_dispatch for testing
2. **Monitor Logs**: Check workflow output for errors
3. **Update Dependencies**: Keep Node.js packages current
4. **Enhance Prompts**: Improve LLM prompts for better output
5. **Add Validations**: Extend validation logic as needed

---

## 📖 Additional Resources

- **GitHub Actions Docs**: https://docs.github.com/actions
- **Hugo Documentation**: https://gohugo.io/documentation/
- **LiteLLM API**: Check your API provider's documentation
- **Workflow Files**: `.github/workflows/` directory
- **Script Files**: `.github/scripts/` directory

---

## 📞 Support & Maintenance

### Getting Help
- Check workflow logs in Actions tab
- Review error messages in PR comments
- Consult this README for common issues
- Check individual script files for inline documentation

### Regular Maintenance
- **Weekly**: Review failed workflow runs
- **Monthly**: Check processing metrics and quality
- **Quarterly**: Update dependencies and API keys
- **Annually**: Review and optimize LLM prompts

---

**Last Updated**: November 24, 2025  
**System Version**: 2.0 (Fully Autonomous Multi-Workflow System)  
**Status**: ✅ Production Ready