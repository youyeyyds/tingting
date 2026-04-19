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
      learnedCourses: 0,
      graduatedCourses: 0,
      finishedCount: 0,
      favoriteCount: 0,
      totalPlayCount: 0,
      totalStudyMinutes: 0,
      joinedMinutes: 0
    },
    studyTimeText: '', // 学习时长格式化文本
    joinedTimeText: '', // 加入听听格式化文本
    loading: false,
    refresherTriggered: false,
    loadTime: ''
  },

  // 格式化分钟数为 X天X时X分
  formatMinutes(minutes) {
    if (!minutes || minutes <= 0) return '0分';
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    let result = '';
    if (days > 0) result += `${days}天`;
    if (hours > 0) result += `${hours}时`;
    if (mins > 0 || result === '') result += `${mins}分`;
    return result;
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    const loadTime = Date.now();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      loadTime: loadTime
    });
    this.checkLoginStatus();
    this.loadHeadlines();
  },

  onShow() {
    this.checkLoginStatus();
    // 未登录时跳转到登录页
    if (!this.data.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/index' });
      return;
    }
    // 切换页面时不重新加载，保持原有数据
    if (app.globalData.userId) {
      this.loadUserStats();
    }
  },

  onRefresh() {
    const newLoadTime = Date.now();
    this.setData({ refresherTriggered: true, loadTime: newLoadTime });
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
        const stats = res.result.data;
        const studyTimeText = this.formatMinutes(stats.totalStudyMinutes || 0);
        const joinedTimeText = this.formatMinutes(stats.joinedMinutes || 0);
        this.setData({
          stats: stats,
          studyTimeText: studyTimeText,
          joinedTimeText: joinedTimeText
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
    const t = this.data.loadTime;
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
        const stats = res.result.data;
        const studyTimeText = this.formatMinutes(stats.totalStudyMinutes || 0);
        const joinedTimeText = this.formatMinutes(stats.joinedMinutes || 0);
        this.setData({
          stats: stats,
          studyTimeText: studyTimeText,
          joinedTimeText: joinedTimeText
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

    // 直接跳转到登录页
    wx.redirectTo({ url: '/pages/login/index' });
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