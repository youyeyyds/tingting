// index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    isLoggedIn: false,
    courses: [],
    headlines: [],
    bannerSpeed: 3000,
    loading: true,
    activeTab: 0
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;

    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: windowInfo.statusBarHeight + navBarHeight
    });

    this.checkLoginStatus();
    this.loadHeadlines();
    this.loadCourses();
  },

  onShow() {
    this.checkLoginStatus();
    this.loadHeadlines();
    this.loadCourses();
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines' }
    })
    .then(res => {
      if (res.result.success) {
        this.setData({
          headlines: res.result.data,
          bannerSpeed: (res.result.speed || 3) * 1000
        });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  loadCourses() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'getCourses',
        limit: 20,
        filterDraft: true,
        userId: app.globalData.userId
      }
    })
    .then(res => {
      if (res.result.success) {
        this.setData({
          courses: res.result.data,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    })
    .catch(err => {
      this.setData({ loading: false });
    });
  },

  checkLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn || false });
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 退出登录
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
      this.setData({ isLoggedIn: false });
      wx.showToast({ title: '已退出', icon: 'success' });
    } else {
      // 跳转到登录页
      wx.navigateTo({ url: '/pages/login/index' });
    }
  },

  onCourseTap(e) {
    // 检查登录状态，未登录则跳转到登录页
    if (!app.globalData.isLoggedIn || !app.globalData.userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      setTimeout(() => {
        wx.navigateTo({ url: '/pages/login/index' });
      }, 500);
      return;
    }
    wx.navigateTo({ url: `/pages/chapter/index?id=${e.currentTarget.dataset.id}` });
  },

  onHeadlineTap(e) {
    const link = e.currentTarget.dataset.link;
    if (link) {
      wx.setClipboardData({
        data: link,
        success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
      });
    }
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) return;
    wx.redirectTo({ url: `/pages/${['', 'favorite', 'mine'][index]}/index` });
  }
});