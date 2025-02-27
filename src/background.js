/**
 * 检测是否为url
 * @param {string} url 
 * @returns {boolean}
 */
const isUrl = (url) => /^https?:\/\//.test(url)

/**
 * 非有效页面插件icon置灰
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && !isUrl(tab.url)) {
    setIconState(tabId, false)
  }
})

/**
 * 设置icon状态
 * @param {number} tabId
 * @param {boolean} isEnabled
 */
function setIconState(tabId, isEnabled) {
  chrome.action.setIcon({
    tabId: tabId,
    path: {
      16: `/icons/${isEnabled ? 'enabled' : 'disabled'}_16.png`,
      32: `/icons/${isEnabled ? 'enabled' : 'disabled'}_32.png`,
      48: `/icons/${isEnabled ? 'enabled' : 'disabled'}_48.png`,
      128: `/icons/${isEnabled ? 'enabled' : 'disabled'}_128.png`,
    },
  })
}

/**
 * 监听来自popup触发同步的消息
 *
 * @param {object} request
 * @param {string} request.action 消息类型
 * @param {object} request.config 用户配置
 *
 * 1. 解析用户配置
 * 2. 同步Cookie
 * 3. 同步Storage数据
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'drfu:sync-storage:start-sync') {
    handleDataSync(request.config)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    // 异步场景下，return true 保持消息通道开启，否则无法响应sendResponse
    return true
  }
})

/**
 * 处理数据同步
 * @param {object} config
 * @returns
 */
async function handleDataSync(config) {
  try {
    const { sourceUrl, targetUrl, syncOptions } = config

    // 同步Cookie
    if (syncOptions.cookie) {
      await syncCookies(sourceUrl, targetUrl)
    }

    // 同步Storage数据
    if (syncOptions.localStorage || syncOptions.sessionStorage) {
      await syncStorage(sourceUrl, targetUrl, syncOptions)
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

/**
 * 同步Cookie
 * @param {string} sourceUrl
 * @param {string} targetUrl
 * @returns
 */
async function syncCookies(sourceUrl, targetUrl) {
  if (!sourceUrl) {
    // 没有sourceUrl会获取到所有域名下的cookie，此处直接提前报错处理
    throw new Error('同步Cookie失败: 源域名不能为空')
  }
  try {
    // 获取所有cookie
    const cookies = await chrome.cookies.getAll({
      url: sourceUrl,
    })

    for (const cookie of cookies) {
      try {
        const newCookie = {
          url: targetUrl,
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate,
        }

        await chrome.cookies.set(newCookie)
      } catch (err) {
        console.error('设置单个cookie失败:', err, cookie)
      }
    }

    return true
  } catch (error) {
    throw new Error(`同步Cookie失败: ${error.message}`)
  }
}

/**
 * 同步Storage数据
 * @param {string} sourceUrl
 * @param {string} targetUrl
 * @param {object} syncOptions
 * @returns
 */
async function syncStorage(sourceUrl, targetUrl, syncOptions) {
  try {
    // 解析源URL以获取域名部分
    const sourceUrlObj = new URL(sourceUrl)
    const sourceDomain = sourceUrlObj.hostname

    // 使用通配符匹配该域名下的所有页面
    const tabs = await chrome.tabs.query({
      url: [`*://${sourceDomain}/*`, `${sourceUrlObj.origin}/*`],
    })

    if (tabs.length === 0) {
      throw new Error('未找到源域名的标签页，请确保已打开源域名页面')
    }

    const sourceTab = tabs[0]

    // 给源域名所在标签页注入content script，获取localStorage和sessionStorage数据
    try {
      await chrome.scripting.executeScript({
        target: { tabId: sourceTab.id },
        files: ['contentScript.js'],
      })
    } catch (err) {
      console.log('Content script 可能已经存在:', err)
    }

    // 等待一小段时间确保content script已加载
    await new Promise((resolve) => setTimeout(resolve, 100))

    // 发送消息并等待响应
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        sourceTab.id,
        {
          action: 'drfu:sync-storage:get-storage-data',
          options: syncOptions,
        },
        (rst) => {
          if (chrome.runtime.lastError) {
            reject(new Error('无法连接到目标页面，请刷新页面后重试'))
          } else {
            resolve(rst)
          }
        }
      )
    })

    if (!response || !response.data) {
      throw new Error('无法获取到源页面数据，请刷新页面后重试')
    }

    // 如果成功获取到数据，发送到目标页面
    const targetTabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    const [currentTab] = targetTabs || []
    if (!currentTab?.url) {
      throw new Error('未找到当前标签页，请确保已打开目标页面')
    }
    // 向所有匹配的标签页发送消息
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'drfu:sync-storage:set-storage-data',
      data: response.data,
      clearBeforeSync: syncOptions.clearBeforeSync,
    }, (rst) => {
      if (chrome.runtime.lastError) {
        throw new Error('无法连接到目标页面，请刷新页面后重试')
      } else {
        console.log('同步Storage数据成功', rst)
      }
    })
  } catch (error) {
    throw new Error(`同步Storage失败: ${error.toString()}`)
  }
}
