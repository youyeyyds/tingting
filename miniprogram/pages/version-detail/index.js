// version-detail/index.js
Page({
  data: {
    title: '',
    publishDate: '',
    description: '',
    headerHeight: 0
  },

  initLayout() {
    const { statusBarHeight } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    this.setData({ headerHeight });
  },

  onLoad(options) {
    this.initLayout();
    const title = decodeURIComponent(options.title || '');
    const publishDate = decodeURIComponent(options.publishDate || '');
    const description = decodeURIComponent(options.description || '');
    this.setData({ title, publishDate, description });
  }
});
