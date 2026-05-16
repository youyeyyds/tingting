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

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    const tabH = 100 * windowWidth / 750;
    this.setData({
      headerHeight,
      scrollHeight: windowHeight - headerHeight - tabH
    });
  },

  onLoad() {
    this.initLayout();
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    const loadTime = app.globalData.bannerLoadTime;
    let cachedHeadlines = app.globalData.mineHeadlines || [];

    if (cachedHeadlines.length > 0) {
      cachedHeadlines = cachedHeadlines.map(h => ({
        ...h,
        image: this.fixImageUrl(h.image, 'banner', loadTime)
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
        image: this.fixImageUrl(h.image, 'banner', bt)
      }));
      this.setData({ loadTime: bt, headlines });
      app.globalData.mineHeadlines = headlines;
    }
  },

  fixImageUrl(url, type = 'banner', loadTime) {
    if (!url) return url;
    if (url.match(/picsum\.photos\/seed\/fixed_/)) {
      return url;
    }
    if (loadTime === undefined) {
      loadTime = this.data.loadTime;
    }
    if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_banner_/)) {
      const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_banner_([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const oldTime = seedMatch[1];
        const originalSeed = seedMatch[2];
        const size = seedMatch[3];
        if (oldTime != loadTime) {
          const newSeed = `${loadTime}_banner_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }
        return url;
      }
    }
    if (url.includes('picsum.photos')) {
      const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const originalSeed = seedMatch[1];
        const size = seedMatch[2];
        const newSeed = `${loadTime}_${type}_${originalSeed}`;
        return `https://picsum.photos/seed/${newSeed}/${size}`;
      }
      const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
      const randomMatch = url.match(/random=(\d+)/);
      if (sizeMatch) {
        const size = sizeMatch[1];
        const originalRandom = randomMatch ? randomMatch[1] : '0';
        const seed = `${loadTime}_${type}_${originalRandom}`;
        return `https://picsum.photos/seed/${seed}/${size}`;
      }
    }
    return url.includes('?') ? `${url}&t=${loadTime}` : `${url}?t=${loadTime}`;
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'mine' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.fixImageUrl(h.image, 'banner', this.data.loadTime)
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
    if (index == 2) return;
    if (index == 0) {
      wx.navigateTo({ url: '/pages/index/index' });
    } else {
      wx.navigateTo({ url: '/pages/favorite/index' });
    }
  }
});
