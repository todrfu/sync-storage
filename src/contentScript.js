/**
 * 监听来自background script的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script收到消息:', request);
  
  if (request.action === 'getStorageData') {
    const data = {
      localStorage: request.options.localStorage ? getLocalStorageData() : null,
      sessionStorage: request.options.sessionStorage ? getSessionStorageData() : null
    };
    
    sendResponse({ data });
    return true;
  }
  
  if (request.action === 'setStorageData') {
    if (request.data.localStorage) {
      setLocalStorageData(request.data.localStorage);
    }
    if (request.data.sessionStorage) {
      setSessionStorageData(request.data.sessionStorage);
    }
    sendResponse({ success: true });
    return true;
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
 */
function setLocalStorageData(data) {
  localStorage.clear();
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, value);
  }
}

/**
 * 设置sessionStorage数据
 * @param {object} data 
 */
function setSessionStorageData(data) {
  sessionStorage.clear();
  for (const [key, value] of Object.entries(data)) {
    sessionStorage.setItem(key, value);
  }
} 