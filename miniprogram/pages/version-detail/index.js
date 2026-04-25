// version-detail/index.js
Page({
  data: {
    title: '',
    publishDate: '',
    description: ''
  },

  onLoad(options) {
    const title = decodeURIComponent(options.title || '');
    const publishDate = decodeURIComponent(options.publishDate || '');
    const description = decodeURIComponent(options.description || '');
    this.setData({ title, publishDate, description });
    wx.setNavigationBarTitle({ title: '版本介绍' });
  }
});
