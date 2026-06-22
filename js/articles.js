/**
 * AssetPath Articles System
 * 支持 Markdown 文章、Front Matter、列表和详情页
 */

// 配置
const ARTICLES_CONFIG = {
  apiUrl: '/articles/api/articles.json',
  markdownDir: '/articles/markdown/',
  defaultImage: 'https://assetpath.app/og-image.png'
};

// Markdown 解析器（使用 marked.js CDN）
async function loadMarked() {
  if (window.marked) return window.marked;
  
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/marked@11.0.0/+esm';
  script.type = 'module';
  
  return new Promise((resolve) => {
    script.onload = () => {
      import('https://cdn.jsdelivr.net/npm/marked@11.0.0/+esm').then(module => {
        window.marked = module.marked;
        resolve(window.marked);
      });
    };
    document.head.appendChild(script);
  });
}

/**
 * 解析 Front Matter
 * 格式：---
 *       key: value
 *       ---
 *       content
 */
function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { frontMatter: {}, content };
  }
  
  const [, frontMatterStr, markdown] = match;
  const frontMatter = {};
  
  // 简单的 YAML 解析
  frontMatterStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      let value = valueParts.join(':').trim();
      
      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // 解析数组
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim());
      }
      
      frontMatter[key.trim()] = value;
    }
  });
  
  return { frontMatter, content: markdown };
}

/**
 * 获取所有文章
 */
async function getAllArticles() {
  try {
    const response = await fetch(ARTICLES_CONFIG.apiUrl);
    const articles = await response.json();
    return articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    console.error('Error loading articles:', error);
    return [];
  }
}

/**
 * 获取单篇文章及其内容
 */
async function getArticle(slug) {
  try {
    const articles = await getAllArticles();
    const article = articles.find(a => a.slug === slug);
    
    if (!article) {
      return null;
    }
    
    // 加载 Markdown 内容
    const response = await fetch(ARTICLES_CONFIG.markdownDir + article.markdown);
    const markdown = await response.text();
    
    // 解析 Front Matter
    const { frontMatter, content } = parseFrontMatter(markdown);
    
    return {
      ...article,
      ...frontMatter,
      markdown: content
    };
  } catch (error) {
    console.error('Error loading article:', error);
    return null;
  }
}

/**
 * 渲染文章列表
 */
async function renderArticlesList(containerId, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const articles = await getAllArticles();
  const { maxItems = null, featured = false, tag = null, category = null } = options;
  
  // 过滤
  let filtered = articles;
  if (featured) {
    filtered = filtered.filter(a => a.featured === true);
  }
  if (tag) {
    filtered = filtered.filter(a => a.tags && a.tags.includes(tag));
  }
  if (category) {
    filtered = filtered.filter(a => a.category === category);
  }
  if (maxItems) {
    filtered = filtered.slice(0, maxItems);
  }
  
  // 生成 HTML
  const html = filtered.map(article => `
    <a href="/articles/${article.slug}" class="article-card">
      <div class="article-card-header">
        <h3 class="article-card-title">${escapeHtml(article.title)}</h3>
        <div class="article-card-meta">
          <span class="article-reading-time">${article.readingTime}</span>
        </div>
      </div>
      <p class="article-card-excerpt">${escapeHtml(article.excerpt)}</p>
      <div class="article-card-footer">
        <span class="article-category">${article.category}</span>
      </div>
    </a>
  `).join('');
  
  container.innerHTML = html;
}

/**
 * 渲染文章详情页
 */
async function renderArticleDetail(slug, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  // 显示加载状态
  container.innerHTML = '<div class="loading">加载中...</div>';
  
  const article = await getArticle(slug);
  if (!article) {
    container.innerHTML = '<div class="error">文章未找到</div>';
    return;
  }
  
  // 加载 Markdown 解析器
  const marked = await loadMarked();
  const html = marked.parse(article.markdown);
  
  // 生成完整的文章 HTML
  const articleHtml = `
    <article class="article-detail">
      <header class="article-header">
        <h1 class="article-title">${escapeHtml(article.title)}</h1>
        <div class="article-meta">
          <div class="article-info">
            <span class="article-author">作者：${escapeHtml(article.author || 'AssetPath')}</span>
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
  
  // 更新页面 SEO
  updatePageSEO({
    title: `${article.title} | AssetPath`,
    description: article.excerpt,
    url: `https://assetpath.app/articles/${slug}`,
    image: ARTICLES_CONFIG.defaultImage
  });
}

/**
 * 获取相关文章
 */
async function getRelatedArticles(currentSlug, maxItems = 3) {
  const articles = await getAllArticles();
  const current = articles.find(a => a.slug === currentSlug);
  
  if (!current) return [];
  
  // 找有相同标签或分类的文章
  const related = articles
    .filter(a => a.slug !== currentSlug)
    .filter(a => {
      const sameCategory = a.category === current.category;
      const sameTag = a.tags && current.tags && 
        a.tags.some(tag => current.tags.includes(tag));
      return sameCategory || sameTag;
    })
    .slice(0, maxItems);
  
  return related;
}

/**
 * 搜索文章
 */
async function searchArticles(query) {
  const articles = await getAllArticles();
  const lowercaseQuery = query.toLowerCase();
  
  return articles.filter(article => {
    const title = article.title.toLowerCase();
    const excerpt = article.excerpt.toLowerCase();
    const tags = (article.tags || []).map(t => t.toLowerCase()).join(' ');
    
    return title.includes(lowercaseQuery) ||
           excerpt.includes(lowercaseQuery) ||
           tags.includes(lowercaseQuery);
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
  
  // 更新标题
  if (title) {
    document.title = title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
  }
  
  // 更新描述
  if (description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
  }
  
  // 更新 URL
  if (url) {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', url);
    
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', url);
  }
  
  // 更新图片
  if (image) {
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute('content', image);
    
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.setAttribute('content', image);
  }
}

/**
 * 路由处理
 */
async function handleArticlesRoute() {
  const path = window.location.pathname;
  const match = path.match(/^\/articles(?:\/([a-z0-9-]+))?/);
  
  if (!match) return false;
  
  if (match[1]) {
    // 详情页
    await renderArticleDetail(match[1], 'article-container');
  } else {
    // 列表页
    await renderArticlesList('articles-container');
  }
  
  return true;
}

// 导出用于模块化使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAllArticles,
    getArticle,
    renderArticlesList,
    renderArticleDetail,
    getRelatedArticles,
    searchArticles,
    parseFrontMatter,
    handleArticlesRoute
  };
}
