// mine/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: 2,
    isLoggedIn: false,
    userInfo: null
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height;
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: navBarHeight
    });
    this.checkLoginStatus();
  },

  onShow() {
    const systemInfo = wx.getSystemInfoSync();
    app.globalData.tabBarHeight = 80 + systemInfo.safeAreaInsetBottom;
    this.checkLoginStatus();
  },

  onHide() {
    app.globalData.tabBarHeight = 0;
  },

  checkLoginStatus() {
    const { isLoggedIn, userInfo } = app.globalData;
    this.setData({
      isLoggedIn: isLoggedIn || false,
      userInfo: userInfo || null
    });
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index === 2) return;
    const pages = ['index', 'favorite', ''];
    wx.redirectTo({
      url: `/pages/${pages[index]}/index`
    });
  }
});