const getElementById = (id) => document.getElementById(id)

const sourceUrlInput = getElementById('sourceUrl')
const targetUrlInput = getElementById('targetUrl')
const cookieCheckbox = getElementById('cookieSync')
const localStorageCheckbox = getElementById('localStorageSync')
const sessionStorageCheckbox = getElementById('sessionStorageSync')
const syncButton = getElementById('syncButton')
const statusDiv = getElementById('status')
const clearBeforeSyncCheckbox = getElementById('clearBeforeSync')

/**
 * 检测是否为url
 * @param {string} url 
 * @returns {boolean}
 */
const isUrl = (url) => /^https?:\/\//.test(url)

/**
 * 禁用数据同步按钮
 */
const disableSyncButton = () => {
  syncButton.disabled = true
  syncButton.style.backgroundColor = '#ccc'
  syncButton.style.cursor = 'not-allowed'
}

/**
 * 检测当前页面是否支持数据同步
 * 
 * 支持：设置目标域名输入框的值
 * 不支持：禁用数据同步按钮
 */
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  const { url } = tabs[0] || {}
  targetUrlInput.value = url ? new URL(url).origin : '未获取到当前页面地址'
  if (!isUrl(url)) {
    disableSyncButton()

    showStatus('当前页面不支持数据同步，仅支持http和https协议的页面', true)
  }
})

/**
 * 加载保存的配置
 */
chrome.storage.local.get(['sourceUrl', 'syncOptions'], (result) => {
  if (result.sourceUrl) {
    sourceUrlInput.value = result.sourceUrl
  }
  if (result.syncOptions) {
    cookieCheckbox.checked = result.syncOptions.cookie
    localStorageCheckbox.checked = result.syncOptions.localStorage
    sessionStorageCheckbox.checked = result.syncOptions.sessionStorage
    // 清空本地数据配置默认关闭，不保留上一次选择结果
    // clearBeforeSyncCheckbox.checked = result.syncOptions.clearBeforeSync || false;
  }
})

/**
 * 持久化用户配置
 */
function saveConfig() {
  const config = {
    sourceUrl: sourceUrlInput.value?.trim(),
    targetUrl: targetUrlInput.value?.trim(),
    syncOptions: {
      cookie: cookieCheckbox.checked,
      localStorage: localStorageCheckbox.checked,
      sessionStorage: sessionStorageCheckbox.checked,
      clearBeforeSync: clearBeforeSyncCheckbox.checked,
    },
  }
  chrome.storage.local.set(config)
  return config
}

/**
 * 显示状态信息
 * @param {string} message
 * @param {boolean} isError
 */
function showStatus(message, isError = false) {
  statusDiv.textContent = message
  statusDiv.style.display = 'block'
  statusDiv.className = `status ${isError ? 'error' : 'success'}`
}

/**
 * 同步按钮点击事件
 */
syncButton.addEventListener('click', async () => {
  const config = saveConfig()

  try {
    const { sourceUrl, targetUrl } = config || {}
    if (!isUrl(sourceUrl)) {
      showStatus('请输入正确的源域名地址', true)
      return
    }

    if (!targetUrl) {
      showStatus('未检测到当前页面的域名')
      return
    }

    // 发送消息给background script开始同步
    const response = await chrome.runtime.sendMessage({
      action: 'drfu:sync-storage:start-sync',
      config,
    })

    if (response.success) {
      showStatus('数据同步成功！')
    } else {
      showStatus(response.error, true)
    }
  } catch (error) {
    showStatus('同步过程中发生错误：' + error.message, true)
  }
})
