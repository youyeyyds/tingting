// version-detail/index.js
const app = getApp();

Page({
  data: {
    title: '',
    publishDate: '',
    description: '',
    headerHeight: 0
  },

  onLoad(options) {
    const title = decodeURIComponent(options.title || '');
    const publishDate = decodeURIComponent(options.publishDate || '');
    const description = decodeURIComponent(options.description || '');
    this.setData({
      title,
      publishDate,
      description,
      headerHeight: app.globalData.headerHeight
    });
  }
});
