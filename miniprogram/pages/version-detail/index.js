// version-detail/index.js
Page({
  data: {
    title: '',
    publishDate: '',
    description: '',
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0
  },

  initLayout() {
    const { statusBarHeight } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    this.setData({
      statusBarHeight,
      navBarHeight,
      headerHeight
    });
  },

  onLoad(options) {
    this.initLayout();
    const title = decodeURIComponent(options.title || '');
    const publishDate = decodeURIComponent(options.publishDate || '');
    const description = decodeURIComponent(options.description || '');
    this.setData({ title, publishDate, description });
  },

  onBack() {
    wx.navigateBack({ fail: () => {
      wx.reLaunch({ url: '/pages/index/index' });
    }});
  }
});
