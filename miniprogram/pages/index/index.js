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
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height;

    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: systemInfo.statusBarHeight + navBarHeight
    });
    this.checkLoginStatus();
    this.loadHeadlines();
    this.loadCourses();
  },

  onShow() {
    const app = getApp();
    const systemInfo = wx.getSystemInfoSync();
    app.globalData.tabBarHeight = 80 + systemInfo.safeAreaInsetBottom;
    this.checkLoginStatus();
    this.loadHeadlines();
    this.loadCourses();
  },

  onHide() {
    const app = getApp();
    app.globalData.tabBarHeight = 0;
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
        filterDraft: true
      }
    })
    .then(res => {
      if (res.result.success) {
        this.setData({
          courses: res.result.data,
          loading: false
        });
      } else {
        console.error('获取课程失败', res.result.errMsg);
        this.setData({ loading: false });
      }
    })
    .catch(err => {
      console.error('调用云函数失败', err);
      this.setData({ loading: false });
    });
  },

  checkLoginStatus() {
    this.setData({ isLoggedIn: app.globalData.isLoggedIn || false });
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      app.globalData.isLoggedIn = false;
      app.globalData.userInfo = null;
      this.setData({ isLoggedIn: false });
      wx.showToast({ title: '已退出', icon: 'success' });
    } else {
      wx.getUserProfile({
        desc: '用于完善用户资料',
        success: (res) => {
          app.globalData.isLoggedIn = true;
          app.globalData.userInfo = res.userInfo;
          this.setData({ isLoggedIn: true });
          wx.showToast({ title: '登录成功', icon: 'success' });
        },
        fail: () => wx.showToast({ title: '登录取消', icon: 'none' })
      });
    }
  },

  onCourseTap(e) {
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