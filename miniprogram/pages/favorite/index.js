// favorite/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: 1
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight
    });
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index === 1) return;
    wx.redirectTo({ url: `/pages/${['index', '', 'mine'][index]}/index` });
  }
});