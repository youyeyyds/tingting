// favorite/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: 1
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - systemInfo.statusBarHeight) * 2 + menuButton.height;
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      navBarHeight: navBarHeight
    });
  },

  onShow() {
    const systemInfo = wx.getSystemInfoSync();
    app.globalData.tabBarHeight = 80 + systemInfo.safeAreaInsetBottom;
  },

  onHide() {
    app.globalData.tabBarHeight = 0;
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index === 1) return;
    const pages = ['index', '', 'mine'];
    wx.redirectTo({
      url: `/pages/${pages[index]}/index`
    });
  }
});