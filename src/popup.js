const sourceUrlInput = document.getElementById('sourceUrl');
const targetUrlInput = document.getElementById('targetUrl');
const cookieCheckbox = document.getElementById('cookieSync');
const localStorageCheckbox = document.getElementById('localStorageSync');
const sessionStorageCheckbox = document.getElementById('sessionStorageSync');
const syncButton = document.getElementById('syncButton');
const statusDiv = document.getElementById('status');
const clearBeforeSyncCheckbox = document.getElementById('clearBeforeSync');

/**
 * 获取当前标签页的域名并设置为目标域名输入框的值
 */
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]?.url) {
    const url = new URL(tabs[0].url);
    targetUrlInput.value = url.origin;
    
    await checkCurrentPage();
  }
});

/**
 * 加载保存的配置
 */
chrome.storage.local.get(['sourceUrl', 'syncOptions'], (result) => {
  if (result.sourceUrl) {
    sourceUrlInput.value = result.sourceUrl;
  }
  if (result.syncOptions) {
    cookieCheckbox.checked = result.syncOptions.cookie;
    localStorageCheckbox.checked = result.syncOptions.localStorage;
    sessionStorageCheckbox.checked = result.syncOptions.sessionStorage;
    // 清空本地数据配置默认关闭，不保留上一次选择结果
    // clearBeforeSyncCheckbox.checked = result.syncOptions.clearBeforeSync || false;
  }
});

/**
 * 检查当前页面是否支持同步
 * 非http和https的页面不支持同步
 * @returns 
 */
async function checkCurrentPage() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  
  if (!currentTab?.url || (!currentTab.url.startsWith('http') && !currentTab.url.startsWith('https'))) {
    // 禁用同步按钮
    syncButton.disabled = true;
    syncButton.style.backgroundColor = '#ccc';
    syncButton.style.cursor = 'not-allowed';
    
    // 显示提示信息
    showStatus('当前页面不支持数据同步，仅支持http和https协议的页面', true);
    return false;
  }
  return true;
}

/**
 * 持久化输入的内容
 */
function saveConfig() {
  const config = {
    sourceUrl: sourceUrlInput.value?.trim(),
    targetUrl: targetUrlInput.value?.trim(),
    syncOptions: {
      cookie: cookieCheckbox.checked,
      localStorage: localStorageCheckbox.checked,
      sessionStorage: sessionStorageCheckbox.checked,
      clearBeforeSync: clearBeforeSyncCheckbox.checked
    }
  };
  chrome.storage.local.set(config);
  return config;
}

/**
 * 显示状态信息
 * @param {string} message 
 * @param {boolean} isError 
 */
function showStatus(message, isError = false) {
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
  statusDiv.className = `status ${isError ? 'error' : 'success'}`;
}

/**
 * 同步按钮点击事件
 */
syncButton.addEventListener('click', async () => {
  // 再次检查当前页面是否支持
  if (!await checkCurrentPage()) {
    return;
  }
  
  const config = saveConfig();
  
  try {
    const { sourceUrl, targetUrl } = config || {};
    // 非http和https的域名则报错
    if (!/^https?:\/\//i.test(sourceUrl)) {
      showStatus('请输入正确的源域名，格式如：https://xxx.com 或 http://xxx.com');
      return;
    }
    
    if (!targetUrl) {
      showStatus('未检测到当前页面的域名');
      return;
    }
    
    // 发送消息给background script开始同步
    const response = await chrome.runtime.sendMessage({
      action: 'startSync',
      config,
    });

    if (response.success) {
      showStatus('数据同步成功！');
    } else {
      showStatus(response.error, true);
    }
  } catch (error) {
    showStatus('同步过程中发生错误：' + error.message, true);
  }
}); 