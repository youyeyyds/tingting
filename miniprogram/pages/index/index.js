// index.js
const app = getApp();
const ANIMATION_DURATION = 300;

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    scrollHeightNoTab: 0,
    scrollHeightWithTab: 0,
    isLoggedIn: false,
    courses: [],
    headlines: [],
    bannerSpeed: 5000,
    loading: true,
    refreshing: false,
    bannerTime: 0,
    coverTime: 0,
    logoutConfirmVisible: false,
    martialArtsVisible: false,
    isClosing: false,
    currentMartialArt: null,
    currentMartialArtLines: []
  },

  onLoad() {
    this.initLayout();
    this.initTimes();
    this.loadData();

    // 监听其他页面刷新图片
    app.registerCallback?.('onCoverRefresh', (data) => {
      app.globalData.coverLoadTime = data.coverLoadTime;
      app.globalData.bannerLoadTime = data.bannerLoadTime || data.coverLoadTime;
      // 清空缓存，重新加载
      app.globalData.homePageHeadlines = [];
      app.globalData.homePageCourses = [];
      this.setData({
        bannerTime: app.globalData.bannerLoadTime,
        coverTime: app.globalData.coverLoadTime,
        headlines: [],
        courses: []
      }, () => {
        this.loadData();
      });
    });
  },

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    const tabH = 100 * windowWidth / 750;

    this.setData({
      statusBarHeight,
      navBarHeight,
      headerHeight,
      scrollHeightNoTab: windowHeight - headerHeight,
      scrollHeightWithTab: windowHeight - headerHeight - tabH
    });
  },

  initTimes() {
    if (!app.globalData.bannerLoadTime) app.globalData.bannerLoadTime = Date.now();
    if (!app.globalData.coverLoadTime) app.globalData.coverLoadTime = Date.now();
    if (!app.globalData.martialArtsPool) app.globalData.martialArtsPool = [];

    this.setData({
      bannerTime: app.globalData.bannerLoadTime,
      coverTime: app.globalData.coverLoadTime
    });
  },

  // 统一加载数据
  loadData() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const cachedHeadlines = app.globalData.homePageHeadlines;
    const cachedCourses = app.globalData.homePageCourses;

    if (cachedHeadlines?.length) {
      this.setData({ headlines: cachedHeadlines });
    } else {
      this.loadHeadlines();
    }

    if (cachedCourses?.length) {
      this.setData({ courses: cachedCourses, loading: false });
      return;
    }

    // 无缓存或非登录状态，重新加载
    this._realCourses = null;
    if (isLoggedIn) {
      this.loadCourses();
    } else {
      this.loadMinimalCourses();
    }
  },

  onShow() {
    // logout 后恢复脱敏数据
    if (app.globalData.needRestoreMaskedData && !app.globalData.loginFlag) {
      app.globalData.needRestoreMaskedData = false;
      app.globalData.homePageCourses = [];
      wx.removeStorageSync('indexCourses');
      const maskedCourses = this.getMaskedCoursesFromCache();
      this._realCourses = null;
      this.setData({ isLoggedIn: false, courses: Object.values(maskedCourses), loading: false });
      this.showStatusToast();
      return;
    }

    const isLoggedIn = app.globalData.isLoggedIn;
    const wasLoggedIn = this.data.isLoggedIn;

    // 登录状态变化
    if (wasLoggedIn !== isLoggedIn) {
      this.setData({ isLoggedIn });
      if (isLoggedIn) {
        this._realCourses = null;
        this.loadCourses();
      }
      this.showStatusToast();
      return;
    }

    // 热启动：重新加载武功池和脱敏数据
    if (app.globalData.isHotStart && !isLoggedIn) {
      app.globalData.martialArtsPool = [];
      app.globalData.homePageMaskedCourses = {};
      this._realCourses = null;
      this.loadMartialArts().then(() => this.loadMinimalCourses());
    }

    this.showStatusToast();
  },

// 同步封面URL
  syncCoverUrls() {
    const cachedCourses = app.globalData.homePageCourses;
    if (cachedCourses?.length) {
      this.setData({ coverTime: app.globalData.coverLoadTime, courses: cachedCourses });
    }
  },

  showStatusToast() {
    if (app.globalData.loginFlag) {
      app.globalData.loginFlag = false;
      setTimeout(() => wx.showToast({ title: '已登录', icon: 'success' }), 500);
    } else if (app.globalData.logoutFlag) {
      setTimeout(() => {
        if (app.globalData.logoutFlag) {
          app.globalData.logoutFlag = false;
          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }, 500);
    }
  },

  processUrl(url, time, type) {
    if (!url || url.includes('seed/fixed_')) return url;
    const t = time || this.data[type === 'banner' ? 'bannerTime' : 'coverTime'];

    // 时间戳格式已存在
    const m1 = url.match(/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
    if (m1) {
      return m1[1] != t ? url.replace(/seed\/\d+_(banner|cover)_/, `seed/${t}_${type}_`) : url;
    }

    // seed格式添加时间戳
    const m2 = url.match(/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
    if (m2) return `https://picsum.photos/seed/${t}_${type}_${m2[1]}/${m2[2]}`;

    // 无seed格式
    const m3 = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
    if (m3) {
      const r = url.match(/random=(\d+)/)?.[1] || '0';
      return `https://picsum.photos/seed/${t}_${type}_${r}/${m3[1]}`;
    }

    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  onRefresh() {
    const t = Date.now();
    app.globalData.bannerLoadTime = t;
    app.globalData.coverLoadTime = t;
    wx.setStorageSync('bannerLoadTime', t);
    wx.setStorageSync('coverLoadTime', t);
    app.globalData.homePageHeadlines = [];
    app.globalData.homePageCourses = [];
    app.globalData.martialArtsPool = [];
    app.globalData.homePageMaskedCourses = {};
    this._martialArtsPool = null;
    this._realCourses = null;

    this.setData({ refreshing: true, bannerTime: t, coverTime: t, headlines: [], courses: [] });
    this.loadData();
    setTimeout(() => this.setData({ refreshing: false }), 500);
  },

  loadHeadlines() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'index' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.processUrl(h.image, this.data.bannerTime, 'banner')
        }));
        app.globalData.homePageHeadlines = headlines;
        wx.setStorageSync('indexHeadlines', headlines);
        this.setData({ headlines, bannerSpeed: (res.result.speed || 5) * 1000 });
      }
    }).catch(e => console.error('获取头条失败', e));
  },

  loadCourses() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourses', limit: 20, filterDraft: true, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        const courses = res.result.data.map(c => ({
          ...c,
          cover: this.processUrl(c.cover, this.data.coverTime, 'cover')
        }));
        this._realCourses = courses;
        app.globalData.homePageCourses = courses;
        wx.setStorageSync('indexCourses', courses);
        this.setData({ courses, loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => this.setData({ loading: false }));
  },

  // 加载武功数据
  loadMartialArts() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getMartialArts' }
    }).then(res => {
      if (res.result?.success) {
        app.globalData.martialArtsPool = res.result.data;
        this._martialArtIndex = 0;
      }
    });
  },

  // 获取下一个武功
  getNextMartialArt() {
    const pool = app.globalData.martialArtsPool;
    if (!pool?.length) return null;
    if (this._martialArtIndex >= pool.length) {
      app.globalData.martialArtsPool = [];
      this._martialArtIndex = 0;
      return null;
    }
    return pool[this._martialArtIndex++];
  },

  // 获取武功作者
  getMartialArtAuthor(art) {
    return art.users?.[0] || art.faction || '江湖';
  },

  // 获取缓存的脱敏课程
  getMaskedCoursesFromCache() {
    const masked = app.globalData.homePageMaskedCourses || {};
    const ct = this.data.coverTime;
    Object.keys(masked).forEach(id => {
      masked[id] = { ...masked[id], cover: this.processUrl(masked[id].cover, ct, 'cover') };
    });
    return masked;
  },

  // 加载最小课程信息（未登录用户）
  loadMinimalCourses() {
    if (!app.globalData.martialArtsPool?.length) {
      return this.loadMartialArts().then(() => this.loadMinimalCourses());
    }

    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getMinimalCourses', limit: 20 }
    }).then(res => {
      if (res.result.success) {
        this._realCourses = res.result.data.map(c => ({
          ...c,
          cover: this.processUrl(c.cover, this.data.coverTime, 'cover')
        }));
        this.maskCourses();
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => this.setData({ loading: false }));
  },

  // 脱敏课程
  maskCourses() {
    const pool = app.globalData.martialArtsPool;
    if (!pool?.length || !this._realCourses?.length) {
      return;
    }

    let maskedCourses = app.globalData.homePageMaskedCourses || {};
    const masked = this._realCourses.map(c => {
      if (maskedCourses[c._id]) return maskedCourses[c._id];

      const art = this.getNextMartialArt();
      const cached = art ? {
        ...c,
        title: art.name,
        author: this.getMartialArtAuthor(art),
        categoryName: art.type,
        progress: 0
      } : { ...c, title: '未知武功', author: '江湖', categoryName: '', progress: 0 };

      maskedCourses[c._id] = cached;
      return cached;
    });

    app.globalData.homePageMaskedCourses = maskedCourses;
    app.globalData.homePageCourses = masked;
    this.setData({ courses: masked, loading: false });
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      this.setData({ logoutConfirmVisible: true });
    } else {
      app.globalData.wasInBackground = false;
      wx.navigateTo({ url: '/pages/login/index' });
    }
  },

  // 取消退出登录
  onLogoutCancel() {
    this.setData({ logoutConfirmVisible: false });
  },

  // 确认退出登录
  onLogoutConfirm() {
    this.setData({ logoutConfirmVisible: false });
    app.logout();

    // 清理缓存
    app.globalData.homePageCourses = [];
    wx.removeStorageSync('indexCourses');
    wx.removeStorageSync('playingCourse');
    wx.removeStorageSync('playingChapter');
    wx.removeStorageSync('playingSeq');

    // 显示脱敏数据
    const masked = this.getMaskedCoursesFromCache();
    this.setData({ isLoggedIn: false, courses: Object.values(masked), loading: false });
    this.showStatusToast();
  },

  onCourseTap(e) {
    if (!app.globalData.isLoggedIn) {
      const masked = app.globalData.homePageMaskedCourses?.[e.currentTarget.dataset.id];
      if (masked) {
        const art = app.globalData.martialArtsPool?.find(m => m.name === masked.title);
        const desc = art?.description || '暂无描述';
        this.setData({
          martialArtsVisible: true,
          currentMartialArt: art || {
            name: masked.title,
            description: desc,
            novel: masked.categoryName || '',
            users: masked.author ? [masked.author] : []
          },
          currentMartialArtLines: desc.split(/\r?\n|\\n/).filter(l => l.trim())
        });
        return;
      }
    }
    wx.navigateTo({ url: `/pages/chapter/index?id=${e.currentTarget.dataset.id}` });
  },

  // 关闭武功详情弹窗
  onCloseMartialArt() {
    this.setData({ isClosing: true });
    setTimeout(() => {
      this.setData({ martialArtsVisible: false, isClosing: false, currentMartialArt: null, currentMartialArtLines: [] });
    }, ANIMATION_DURATION);
  },

  // 阻止弹窗触摸穿透
  preventModalMove() {
    return true;
  },

  onTabChange(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx == 0) return;
    if (!app.globalData.isLoggedIn) {
      app.globalData.wasInBackground = false;
      wx.navigateTo({ url: '/pages/login/index' });
      return;
    }
    const urls = ['', 'favorite', 'mine'];
    const target = `pages/${urls[idx]}/index`;
    const pages = getCurrentPages();
    const exist = pages.find(p => p.route === target);
    if (exist) {
      wx.navigateBack({ delta: pages.length - pages.indexOf(exist) - 1 });
    } else {
      wx.navigateTo({ url: `/pages/${urls[idx]}/index` });
    }
  }
});