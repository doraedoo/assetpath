/**
 * AssetPath Markdown-Driven Articles System
 * 纯 Markdown 驱动，自动扫描和加载
 * 
 * 使用方式：
 * 1. 创建 MD 文件到 /articles/xxx.md
 * 2. 更新 /articles/manifest.json 添加一行
 * 3. 完成 - 自动上线
 */

const ARTICLES_CONFIG = {
  manifestUrl: '/articles/manifest.json',
  markdownDir: '/articles/',
  defaultImage: 'https://assetpath.app/og-image.png'
};

// 加载 marked.js
async function loadMarked() {
  if (window.marked) return window.marked;
  
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    script.onload = () => {
      resolve(window.marked);
    };
    document.head.appendChild(script);
  });
}

/**
 * 解析 Front Matter
 */
function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { frontMatter: {}, content };
  }
  
  const [, frontMatterStr, markdown] = match;
  const frontMatter = {};
  
  frontMatterStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      let value = valueParts.join(':').trim();
      
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim());
      }
      
      frontMatter[key.trim()] = value;
    }
  });
  
  return { frontMatter, content: markdown };
}

/**
 * 加载 manifest 并获取所有文章信息
 */
async function loadArticlesManifest() {
  try {
    const response = await fetch(ARTICLES_CONFIG.manifestUrl);
    return await response.json();
  } catch (error) {
    console.error('Error loading manifest:', error);
    return { articles: [] };
  }
}

/**
 * 加载单个 Markdown 文件
 */
async function loadMarkdownFile(filename) {
  try {
    const response = await fetch(ARTICLES_CONFIG.markdownDir + filename);
    const text = await response.text();
    return text;
  } catch (error) {
    console.error('Error loading markdown file:', filename, error);
    return null;
  }
}

/**
 * 获取所有文章（解析 Front Matter）
 */
async function getAllArticles() {
  const manifest = await loadArticlesManifest();
  const articles = [];
  
  for (const item of manifest.articles) {
    const markdown = await loadMarkdownFile(item.file);
    if (!markdown) continue;
    
    const { frontMatter, content } = parseFrontMatter(markdown);
    
    // 计算阅读时间
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);
    
    articles.push({
      slug: item.slug,
      file: item.file,
      title: frontMatter.title || 'Untitled',
      date: frontMatter.date || new Date().toISOString().split('T')[0],
      category: frontMatter.category || 'Uncategorized',
      tags: frontMatter.tags || [],
      summary: frontMatter.summary || '',
      author: frontMatter.author || 'AssetPath',
      content: content,
      readingTime: `${readingTime} 分钟`,
      wordCount: wordCount,
      featured: frontMatter.featured === 'true' || frontMatter.featured === true
    });
  }
  
  return articles.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * 获取单篇文章
 */
async function getArticle(slug) {
  const articles = await getAllArticles();
  return articles.find(a => a.slug === slug) || null;
}

/**
 * 渲染文章列表
 */
async function renderArticlesList(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const articles = await getAllArticles();
  const { maxItems = null, category = null } = options;
  
  let filtered = articles;
  
  if (category) {
    filtered = filtered.filter(a => a.category === category);
  }
  
  if (maxItems) {
    filtered = filtered.slice(0, maxItems);
  }
  
  const html = filtered.map(article => `
    <a href="/articles/${article.slug}" class="article-card">
      <div class="article-card-header">
        <h3 class="article-card-title">${escapeHtml(article.title)}</h3>
        <div class="article-card-meta">
          <span class="article-reading-time">${article.readingTime}</span>
        </div>
      </div>
      <p class="article-card-excerpt">${escapeHtml(article.summary)}</p>
      <div class="article-card-footer">
        <span class="article-category">${article.category}</span>
      </div>
    </a>
  `).join('');
  
  container.innerHTML = html || '<p style="text-align: center; color: #64748B;">暂无文章</p>';
}

/**
 * 渲染文章详情
 */
async function renderArticleDetail(slug, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '<div class="loading">加载中...</div>';
  
  const article = await getArticle(slug);
  if (!article) {
    container.innerHTML = '<div class="error">文章未找到</div>';
    return;
  }
  
  const marked = await loadMarked();
  const html = marked.parse(article.content);
  
  const articleHtml = `
    <article class="article-detail">
      <header class="article-header">
        <h1 class="article-title">${escapeHtml(article.title)}</h1>
        <div class="article-meta">
          <div class="article-info">
            <span class="article-author">作者：${escapeHtml(article.author)}</span>
            <span class="article-date">${formatDate(article.date)}</span>
            <span class="article-reading-time">${article.readingTime}</span>
          </div>
          <div class="article-category-badge">${escapeHtml(article.category)}</div>
        </div>
      </header>
      
      <div class="article-body">
        ${html}
      </div>
    </article>
  `;
  
  container.innerHTML = articleHtml;
  
  updatePageSEO({
    title: `${article.title} | AssetPath`,
    description: article.summary,
    url: `https://assetpath.app/articles/${slug}`,
    image: ARTICLES_CONFIG.defaultImage
  });
}

/**
 * 获取分类列表
 */
async function getCategories() {
  const articles = await getAllArticles();
  const categories = [...new Set(articles.map(a => a.category))];
  return categories.sort();
}

/**
 * 搜索文章
 */
async function searchArticles(query) {
  const articles = await getAllArticles();
  const lowercaseQuery = query.toLowerCase();
  
  return articles.filter(article => {
    const title = article.title.toLowerCase();
    const summary = article.summary.toLowerCase();
    const tags = article.tags.map(t => t.toLowerCase()).join(' ');
    const category = article.category.toLowerCase();
    
    return title.includes(lowercaseQuery) ||
           summary.includes(lowercaseQuery) ||
           tags.includes(lowercaseQuery) ||
           category.includes(lowercaseQuery);
  });
}

/**
 * 工具函数
 */

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('zh-CN', options);
}

function updatePageSEO(data) {
  const { title, description, url, image } = data;
  
  if (title) {
    document.title = title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
  }
  
  if (description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
  }
  
  if (url) {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', url);
  }
  
  if (image) {
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', image);
    
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.setAttribute('content', image);
  }
}

// 导出函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAllArticles,
    getArticle,
    getCategories,
    renderArticlesList,
    renderArticleDetail,
    searchArticles,
    parseFrontMatter,
    loadMarkdownFile
  };
}
