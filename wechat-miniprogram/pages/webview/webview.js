const DEFAULT_PAGE_PATH = '/login.html';
const ALLOWED_PAGE_PATHS = new Set(['/login.html', '/index.html', '/stats.html']);
const RESERVED_OPTION_KEYS = new Set(['path']);
const FALLBACK_BASE_WEB_URL = 'https://panshaker-timer.azurewebsites.net';

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

function normalizeBaseWebUrl(rawBaseWebUrl) {
  if (typeof rawBaseWebUrl !== 'string') {
    return FALLBACK_BASE_WEB_URL;
  }

  const trimmed = rawBaseWebUrl.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) {
    return FALLBACK_BASE_WEB_URL;
  }

  return trimmed.replace(/\/+$/, '');
}

function splitPathAndQuery(pathWithQuery) {
  const hashIndex = pathWithQuery.indexOf('#');
  const noHash = hashIndex >= 0 ? pathWithQuery.slice(0, hashIndex) : pathWithQuery;
  const queryIndex = noHash.indexOf('?');

  if (queryIndex === -1) {
    return {
      pathname: noHash,
      query: ''
    };
  }

  return {
    pathname: noHash.slice(0, queryIndex),
    query: noHash.slice(queryIndex + 1)
  };
}

function parseQueryToMap(queryString) {
  const queryMap = {};
  if (!queryString) {
    return queryMap;
  }

  queryString.split('&').forEach((pair) => {
    if (!pair) {
      return;
    }

    const equalIndex = pair.indexOf('=');
    const rawKey = equalIndex >= 0 ? pair.slice(0, equalIndex) : pair;
    const rawValue = equalIndex >= 0 ? pair.slice(equalIndex + 1) : '';

    const key = safeDecode(rawKey);
    if (!key) {
      return;
    }

    queryMap[key] = safeDecode(rawValue);
  });

  return queryMap;
}

function stringifyQueryFromMap(queryMap) {
  return Object.keys(queryMap)
    .filter((key) => key)
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(queryMap[key]))}`)
    .join('&');
}

function normalizeEntryPath(rawPath, baseWebUrl) {
  if (!rawPath) {
    return DEFAULT_PAGE_PATH;
  }

  const decoded = safeDecode(String(rawPath).trim());
  if (!decoded) {
    return DEFAULT_PAGE_PATH;
  }

  if (/^https?:\/\//i.test(decoded)) {
    if (!decoded.startsWith(`${baseWebUrl}/`)) {
      return DEFAULT_PAGE_PATH;
    }

    const stripped = decoded.slice(baseWebUrl.length);
    const absoluteParts = splitPathAndQuery(stripped || '/');
    if (!ALLOWED_PAGE_PATHS.has(absoluteParts.pathname)) {
      return DEFAULT_PAGE_PATH;
    }

    return absoluteParts.query
      ? `${absoluteParts.pathname}?${absoluteParts.query}`
      : absoluteParts.pathname;
  }

  const prefixedPath = decoded.startsWith('/') ? decoded : `/${decoded}`;

  const relativeParts = splitPathAndQuery(prefixedPath);
  if (!ALLOWED_PAGE_PATHS.has(relativeParts.pathname)) {
    return DEFAULT_PAGE_PATH;
  }

  return relativeParts.query
    ? `${relativeParts.pathname}?${relativeParts.query}`
    : relativeParts.pathname;
}

function buildWebViewUrl(baseWebUrl, options) {
  const normalizedBaseWebUrl = normalizeBaseWebUrl(baseWebUrl);
  const entryPath = normalizeEntryPath(options.path, normalizedBaseWebUrl);
  const entryParts = splitPathAndQuery(entryPath);
  const queryMap = parseQueryToMap(entryParts.query);

  Object.keys(options).forEach((key) => {
    if (RESERVED_OPTION_KEYS.has(key)) {
      return;
    }

    const value = options[key];
    if (typeof value === 'string' && value.trim()) {
      queryMap[key] = safeDecode(value);
    }
  });

  // Let the website know it is being rendered inside WeChat mini program.
  queryMap.from = 'wxmini';
  queryMap.entry = 'miniprogram';

  const queryString = stringifyQueryFromMap(queryMap);
  if (!queryString) {
    return `${normalizedBaseWebUrl}${entryParts.pathname}`;
  }

  return `${normalizedBaseWebUrl}${entryParts.pathname}?${queryString}`;
}

Page({
  data: {
    webViewUrl: ''
  },

  onLoad(options) {
    const app = getApp();
    const baseWebUrl =
      app &&
      app.globalData &&
      typeof app.globalData.baseWebUrl === 'string' &&
      app.globalData.baseWebUrl
        ? app.globalData.baseWebUrl
        : FALLBACK_BASE_WEB_URL;

    const webViewUrl = buildWebViewUrl(baseWebUrl, options || {});
    this.setData({ webViewUrl });

    wx.showLoading({
      title: '加载中',
      mask: true
    });
  },

  onWebLoad() {
    wx.hideLoading();
  },

  onWebError() {
    wx.hideLoading();

    const encodedUrl = encodeURIComponent(this.data.webViewUrl || '');
    wx.redirectTo({
      url: `/pages/error/error?url=${encodedUrl}`
    });
  },

  onHide() {
    wx.hideLoading();
  },

  onUnload() {
    wx.hideLoading();
  },

  onShareAppMessage() {
    return {
      title: 'Panshaker 工时系统',
      path: '/pages/webview/webview'
    };
  }
});
