// mine/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: 2,
    isLoggedIn: false,
    userInfo: null,
    headlines: [],
    stats: {
      finishedCount: 0,
      favoriteCount: 0,
      totalPlayCount: 0,
      totalDuration: 0
    },
    loading: false,
    refresherTriggered: false
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight
    });
    this.checkLoginStatus();
    this.loadHeadlines();
  },

  onShow() {
    this.checkLoginStatus();
    this.loadHeadlines();
    if (this.data.isLoggedIn && app.globalData.userId) {
      this.loadUserStats();
    }
  },

  onRefresh() {
    this.setData({ refresherTriggered: true });
    this.checkLoginStatus();
    this.loadHeadlines();
    if (this.data.isLoggedIn && app.globalData.userId) {
      this.loadUserStatsAsync().then(() => {
        this.setData({ refresherTriggered: false });
      });
    } else {
      this.setData({ refresherTriggered: false });
    }
  },

  loadUserStatsAsync() {
    if (!app.globalData.userId) {
      return Promise.resolve();
    }

    return wx.cloud.callFunction({
      name: 'userFunctions',
      data: {
        type: 'getUserStats',
        userId: app.globalData.userId
      }
    })
    .then(res => {
      if (res.result.success) {
        this.setData({
          stats: res.result.data
        });
      }
    })
    .catch(err => {
      console.error('获取用户统计失败:', err);
    });
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'mine' }
    })
    .then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.addTimestamp(h.image)
        }));
        this.setData({ headlines: headlines });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  addTimestamp(url) {
    if (!url) return url;
    const t = Date.now();
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  checkLoginStatus() {
    const { isLoggedIn, userInfo, userId } = app.globalData;
    this.setData({
      isLoggedIn: isLoggedIn || false,
      userInfo: userInfo || null
    });
    if (!isLoggedIn && userId) {
      // 尝试从本地存储恢复登录状态
      const storedUserId = wx.getStorageSync('userId');
      const storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserId && storedUserInfo) {
        app.globalData.isLoggedIn = true;
        app.globalData.userId = storedUserId;
        app.globalData.userInfo = JSON.parse(storedUserInfo);
        this.setData({
          isLoggedIn: true,
          userInfo: app.globalData.userInfo
        });
      }
    }
  },

  async loadUserStats() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'userFunctions',
        data: {
          type: 'getUserStats',
          userId: app.globalData.userId
        }
      });

      if (res.result.success) {
        this.setData({
          stats: res.result.data
        });
      }
    } catch (err) {
      console.error('获取用户统计失败:', err);
    } finally {
      this.setData({ loading: false });
    }
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 停止播放器并清空播放状态
          app.bgAudioManager.stop();
          app.globalData.miniPlayerActive = false;
          app.globalData.miniPlayerIndexFadedIn = false;
          app.globalData.playingCourse = null;
          app.globalData.playingChapter = null;
          app.globalData.playingIndex = 0;
          app.globalData.playlistChaptersData = [];
          app.globalData.playMode = 'sequence';
          app.globalData.playlistSortOrder = 'asc';
          // 通知 mini-player 关闭
          app.notifyCallbacks('onClose', {});

          app.globalData.isLoggedIn = false;
          app.globalData.userInfo = null;
          app.globalData.userId = null;
          wx.removeStorageSync('userId');
          wx.removeStorageSync('userInfo');
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            stats: {
              finishedCount: 0,
              favoriteCount: 0,
              totalPlayCount: 0,
              totalDuration: 0
            }
          });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0分钟';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}小时${mins > 0 ? mins + '分钟' : ''}`;
    }
    return `${mins}分钟`;
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index === 2) return;
    // 未登录时跳转登录页
    if (!app.globalData.isLoggedIn) {
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    wx.redirectTo({ url: `/pages/${['index', 'favorite', ''][index]}/index` });
  }
});