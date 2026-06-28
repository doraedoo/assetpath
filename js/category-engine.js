/**
 * AssetPath Category Engine V1
 * 
 * 职责：
 * - 从 articles.json 读取所有文章数据
 * - 建立分类索引（Category Index）
 * - 提供统一的分类查询接口
 * - 为首页、分类页等所有消费者提供数据
 *
 * 使用方式：
 *   const engine = new CategoryEngine('./articles.json');
 *   await engine.init();
 *   const stats = engine.getCategoryStats('company-business');
 *   const articles = engine.getArticlesByCategory('tax-identity');
 */

class CategoryEngine {

  /**
   * @param {string} jsonUrl - articles.json 的路径
   */
  constructor(jsonUrl) {
    this.jsonUrl = jsonUrl;
    this._articles = [];       // 原始文章数组
    this._categoryIndex = {};  // { categoryId: [article, ...] }
    this._ready = false;
  }

  // ─────────────────────────────────────────
  // 初始化：加载 JSON，建立索引
  // ─────────────────────────────────────────

  async init() {
    try {
      const res = await fetch(this.jsonUrl);
      if (!res.ok) throw new Error(`Failed to fetch articles.json: ${res.status}`);
      this._articles = await res.json();
      this._buildIndex();
      this._ready = true;
    } catch (err) {
      console.error('[CategoryEngine] init failed:', err);
      this._ready = false;
    }
    return this;
  }

  /**
   * 建立分类索引
   * 遍历一次文章数组，按 category 字段归类
   * 顺序保持 articles.json 中的顺序（发布日期倒序）
   */
  _buildIndex() {
    this._categoryIndex = {};
    for (const article of this._articles) {
      const cat = article.category;
      if (!cat) continue;
      if (!this._categoryIndex[cat]) {
        this._categoryIndex[cat] = [];
      }
      this._categoryIndex[cat].push(article);
    }
  }

  // ─────────────────────────────────────────
  // 公开查询接口
  // ─────────────────────────────────────────

  /**
   * 获取某分类下所有文章
   * @param {string} categoryId
   * @returns {Array} articles（保持倒序）
   */
  getArticlesByCategory(categoryId) {
    this._assertReady();
    return this._categoryIndex[categoryId] || [];
  }

  /**
   * 获取某分类的统计数据
   * @param {string} categoryId
   * @returns {{ articles: Array, count: number, latestDate: string|null }}
   */
  getCategoryStats(categoryId) {
    this._assertReady();
    const articles = this.getArticlesByCategory(categoryId);
    const latestDate = articles.length > 0 ? articles[0].date : null;
    return {
      articles,
      count: articles.length,
      latestDate,
    };
  }

  /**
   * 获取所有分类的统计数据（Map 形式）
   * @returns {{ [categoryId]: { articles, count, latestDate } }}
   */
  getAllCategoryStats() {
    this._assertReady();
    const result = {};
    for (const categoryId of Object.keys(this._categoryIndex)) {
      result[categoryId] = this.getCategoryStats(categoryId);
    }
    return result;
  }

  /**
   * 获取全部文章（原始顺序）
   * @returns {Array}
   */
  getAllArticles() {
    this._assertReady();
    return this._articles;
  }

  /**
   * 获取最新 N 篇文章
   * @param {number} n
   * @returns {Array}
   */
  getLatestArticles(n = 1) {
    this._assertReady();
    return this._articles.slice(0, n);
  }

  /**
   * 按 series 筛选文章
   * @param {string} series - 'Insights' | 'Framework'
   * @returns {Array}
   */
  getArticlesBySeries(series) {
    this._assertReady();
    return this._articles.filter(a => a.series === series);
  }

  // ─────────────────────────────────────────
  // 内部工具
  // ─────────────────────────────────────────

  _assertReady() {
    if (!this._ready) {
      throw new Error('[CategoryEngine] Not initialized. Call await engine.init() first.');
    }
  }

  get isReady() {
    return this._ready;
  }
}

// ─────────────────────────────────────────
// 全局单例（供首页、分类页共用）
// ─────────────────────────────────────────

const assetpathEngine = new CategoryEngine('./articles.json');

// 导出（兼容 ES Module 和普通 script 两种用法）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CategoryEngine, assetpathEngine };
}
