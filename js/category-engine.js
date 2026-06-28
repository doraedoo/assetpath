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
 *   var engine = createCategoryEngine('/articles.json');
 *   engine.init().then(function() {
 *     var articles = engine.getArticlesByCategory('tax-identity');
 *   });
 */

function createCategoryEngine(jsonUrl) {
  var _jsonUrl = jsonUrl;
  var _articles = [];
  var _categoryIndex = {};
  var _ready = false;

  function _buildIndex() {
    _categoryIndex = {};
    var i, article, cat;
    for (i = 0; i < _articles.length; i++) {
      article = _articles[i];
      cat = article.category;
      if (!cat) { continue; }
      if (!_categoryIndex[cat]) {
        _categoryIndex[cat] = [];
      }
      _categoryIndex[cat].push(article);
    }
  }

  function _assertReady() {
    if (!_ready) {
      throw new Error('[CategoryEngine] Not initialized. Call engine.init() first.');
    }
  }

  function init() {
    return fetch(_jsonUrl).then(function(res) {
      if (!res.ok) {
        throw new Error('Failed to fetch articles.json: ' + res.status);
      }
      return res.json();
    }).then(function(data) {
      _articles = data;
      _buildIndex();
      _ready = true;
    }).catch(function(err) {
      console.error('[CategoryEngine] init failed:', err);
      _ready = false;
    });
  }

  function getArticlesByCategory(categoryId) {
    _assertReady();
    return _categoryIndex[categoryId] || [];
  }

  function getCategoryStats(categoryId) {
    _assertReady();
    var articles = getArticlesByCategory(categoryId);
    var latestDate = articles.length > 0 ? articles[0].date : null;
    return {
      articles: articles,
      count: articles.length,
      latestDate: latestDate
    };
  }

  function getAllCategoryStats() {
    _assertReady();
    var result = {};
    var keys = Object.keys(_categoryIndex);
    var i;
    for (i = 0; i < keys.length; i++) {
      result[keys[i]] = getCategoryStats(keys[i]);
    }
    return result;
  }

  function getAllArticles() {
    _assertReady();
    return _articles;
  }

  function getLatestArticles(n) {
    _assertReady();
    var count = n || 1;
    return _articles.slice(0, count);
  }

  function getArticlesBySeries(series) {
    _assertReady();
    var result = [];
    var i;
    for (i = 0; i < _articles.length; i++) {
      if (_articles[i].series === series) {
        result.push(_articles[i]);
      }
    }
    return result;
  }

  function getIsReady() {
    return _ready;
  }

  return {
    init: init,
    getArticlesByCategory: getArticlesByCategory,
    getCategoryStats: getCategoryStats,
    getAllCategoryStats: getAllCategoryStats,
    getAllArticles: getAllArticles,
    getLatestArticles: getLatestArticles,
    getArticlesBySeries: getArticlesBySeries,
    get isReady() { return getIsReady(); }
  };
}

// 全局单例（供首页、分类页共用）
var assetpathEngine = createCategoryEngine('/articles/articles.json');

// 导出（兼容 ES Module 和普通 script 两种用法）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createCategoryEngine: createCategoryEngine, assetpathEngine: assetpathEngine };
}
