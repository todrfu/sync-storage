/**
 * 监听来自background script的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'drfu:sync-storage:get-storage-data') {
    const data = {
      localStorage: request.options.localStorage ? getLocalStorageData() : null,
      sessionStorage: request.options.sessionStorage ? getSessionStorageData() : null
    };
    
    sendResponse({ data });
  }
  
  if (request.action === 'drfu:sync-storage:set-storage-data') {
    const { data, clearBeforeSync } = request;
    if (data.localStorage) {
      setLocalStorageData(data.localStorage, clearBeforeSync);
    }
    if (data.sessionStorage) {
      setSessionStorageData(data.sessionStorage, clearBeforeSync);
    }
    sendResponse({ success: true });
  }
});

/**
 * 获取localStorage数据
 * @returns {object}
 */
function getLocalStorageData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    data[key] = localStorage.getItem(key);
  }
  return data;
}

/**
 * 获取sessionStorage数据
 * @returns {object}
 */
function getSessionStorageData() {
  const data = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    data[key] = sessionStorage.getItem(key);
  }
  return data;
}

/**
 * 设置localStorage数据
 * @param {object} data 
 * @param {boolean} clearBeforeSync 是否在同步前清空已有数据
 */
function setLocalStorageData(data, clearBeforeSync = false) {
  if (clearBeforeSync) {
    localStorage.clear();
  }
  // 覆盖或新增数据
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, value);
  }
}

/**
 * 设置sessionStorage数据
 * @param {object} data 
 * @param {boolean} clearBeforeSync 是否在同步前清空已有数据
 */
function setSessionStorageData(data, clearBeforeSync = false) {
  if (clearBeforeSync) {
    sessionStorage.clear();
  }
  // 覆盖或新增数据
  for (const [key, value] of Object.entries(data)) {
    sessionStorage.setItem(key, value);
  }
} 