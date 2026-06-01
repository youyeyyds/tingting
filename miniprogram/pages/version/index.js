// version/index.js
const app = getApp();

Page({
  data: {
    headlines: [],
    versions: [],
    bannerSpeed: 5000,
    loadTime: 0,
    activeTab: 2,
    headerHeight: 0,
    scrollHeight: 0
  },

  onLoad() {
    const loadTime = app.globalData.bannerLoadTime;
    this.setData({
      headerHeight: app.globalData.headerHeight,
      scrollHeight: app.globalData.scrollHeightNoTab
    });
    let cachedHeadlines = app.globalData.mineHeadlines || [];

    if (cachedHeadlines.length > 0) {
      cachedHeadlines = cachedHeadlines.map(h => ({
        ...h,
        image: app.processImageUrl(h.image, 'banner', loadTime)
      }));
    }

    this.setData({
      loadTime: loadTime,
      headlines: cachedHeadlines
    });

    if (cachedHeadlines.length === 0) {
      this.loadHeadlines();
    }
    this.loadVersions();
  },

  onBack() {
    wx.navigateBack({ fail: () => {
      wx.reLaunch({ url: '/pages/index/index' });
    }});
  },

  onShow() {
    this.syncImageTimes();
  },

  syncImageTimes() {
    const bt = app.globalData.bannerLoadTime;
    if (bt !== this.data.loadTime) {
      const headlines = this.data.headlines.map(h => ({
        ...h,
        image: app.processImageUrl(h.image, 'banner', bt)
      }));
      this.setData({ loadTime: bt, headlines });
      app.globalData.mineHeadlines = headlines;
    }
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'mine' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: app.processImageUrl(h.image, 'banner', this.data.loadTime)
        }));
        app.globalData.mineHeadlines = headlines;
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    }).catch(err => console.error('获取头条失败', err));
  },

  loadVersions() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getVersions' }
    }).then(res => {
      if (res.result.success) {
        // 与后台排序一致（seq desc）
        this.setData({ versions: res.result.data });
      }
    }).catch(err => console.error('获取版本失败', err));
  },

  onVersionTap(e) {
    const index = e.currentTarget.dataset.index;
    const version = this.data.versions[index];
    wx.navigateTo({
      url: `/pages/version-detail/index?title=${encodeURIComponent(version.title)}&publishDate=${encodeURIComponent(version.publishDate || '')}&description=${encodeURIComponent(version.description || '')}`
    });
  },

  onTabChange(e) {
    const index = e.currentTarget.dataset.index;
    if (index == 2) return; // 当前在"我的"分组，但 version 本身不是 tabBar 页面
    app.switchTab(index);
  }
});
