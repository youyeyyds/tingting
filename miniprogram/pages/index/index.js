// index.js
const app = getApp();
const ANIMATION_DURATION = 300;

Page({
  data: {
    activeTab: 0,
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
    scrollTop: 0,
    logoutConfirmVisible: false,
    martialArtsVisible: false,
    isClosing: false,
    currentMartialArt: null,
    currentMartialArtLines: []
  },

  onLoad() {
    this.setData({
      headerHeight: app.globalData.headerHeight,
      scrollHeightNoTab: app.globalData.scrollHeightNoTab,
      scrollHeightWithTab: app.globalData.scrollHeightWithTab
    });
    this.initTimes();
    this.loadData();

    // 预加载登录页版权信息
    if (!app.globalData.loginCopyright?.copyrightLines) {
      this.preloadCopyright();
    }

    // 监听其他页面刷新图片
    app.registerMiniPlayer({
      onCoverRefresh: (data) => {
        app.globalData.coverLoadTime = data.coverLoadTime;
        app.globalData.bannerLoadTime = data.bannerLoadTime || data.coverLoadTime;
        app.globalData.homePageHeadlines = [];
        this.setData({
          bannerTime: app.globalData.bannerLoadTime,
          coverTime: app.globalData.coverLoadTime
        }, () => {
          this.loadHeadlines();
          const courses = this.data.courses.map(c => ({
            ...c,
            cover: app.processImageUrl(c.cover, 'cover', this.data.coverTime)
          }));
          this.setData({ courses });
        });
      },
      onProgressUpdate: ({ chapterId, lastPlayTime, finished }) => {
        // 清除课程缓存，首页下次显示时会重新加载最新进度（课程平均进度）
        app.globalData.homePageCourses = [];
      }
    });
  },

  initTimes() {
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
    this.setData({ activeTab: 0 });

    // 如果课程缓存被清除（进度更新），重新加载以获取最新课程进度
    if (!app.globalData.homePageCourses?.length && app.globalData.isLoggedIn) {
      this._realCourses = null;
      this.loadCourses();
    }

    // logout 后恢复脱敏数据（从mine页退出登录时触发）
    if (app.globalData.needRestoreMaskedData && !app.globalData.loginFlag) {
      app.globalData.needRestoreMaskedData = false;
      const masked = this.getMaskedCoursesFromCache();
      if (Object.keys(masked).length > 0) {
        this.setData({ isLoggedIn: false, courses: Object.values(masked), loading: false, scrollTop: 0 });
        app.globalData.homePageCourses = [];
        wx.removeStorageSync('indexCourses');
        this._realCourses = null;
        this.showStatusToast();
        return;
      }
      if (this._realCourses?.length) {
        if (!app.globalData.martialArtsPool?.length) {
          this.loadMartialArts().then(() => {
            this.maskCourses();
            this.setData({ isLoggedIn: false, scrollTop: 0 });
            this.showStatusToast();
          });
          return;
        }
        this.maskCourses();
        this.setData({ isLoggedIn: false, scrollTop: 0 });
        this.showStatusToast();
        return;
      }
      this.setData({ isLoggedIn: false, courses: [], loading: false, scrollTop: 0 });
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
          image: app.processImageUrl(h.image, 'banner', this.data.bannerTime)
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
          cover: app.processImageUrl(c.cover, 'cover', this.data.coverTime)
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

  // 预加载登录页版权信息
  preloadCopyright() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCopyright' }
    }).then(res => {
      if (res.result.success) {
        const data = res.result.data || {};
        const text = data.copyrightText || 'youyeyyds\nPowered by Claude Code\n版本号：v0.1.0';
        const copyrightLines = text.split('\n').filter(l => l.trim());
        app.globalData.loginCopyright = { copyrightLines, icpNumber: data.icpNumber || '' };
      }
    }).catch(e => console.error('预加载版权信息失败', e));
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
      masked[id] = { ...masked[id], cover: app.processImageUrl(masked[id].cover, 'cover', ct) };
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
          cover: app.processImageUrl(c.cover, 'cover', this.data.coverTime)
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
    if (!pool?.length || !this._realCourses?.length) return;

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

    const masked = this.getMaskedCoursesFromCache();
    if (Object.keys(masked).length > 0) {
      this.setData({ isLoggedIn: false, courses: Object.values(masked), loading: false, scrollTop: 0 });
      app.globalData.homePageCourses = [];
      wx.removeStorageSync('indexCourses');
      wx.removeStorageSync('playingCourse');
      wx.removeStorageSync('playingChapter');
      wx.removeStorageSync('playingSeq');
      this.showStatusToast();
      return;
    }

    // 没有缓存时，清空homePageMaskedCourses
    app.globalData.homePageMaskedCourses = {};
    wx.removeStorageSync('indexCourses');
    wx.removeStorageSync('playingCourse');
    wx.removeStorageSync('playingChapter');
    wx.removeStorageSync('playingSeq');

    if (this._realCourses?.length) {
      if (!app.globalData.martialArtsPool?.length) {
        this.loadMartialArts().then(() => {
          this.maskCourses();
          this.setData({ isLoggedIn: false, scrollTop: 0 });
          this.showStatusToast();
        });
        return;
      }
      this.maskCourses();
      this.setData({ isLoggedIn: false, scrollTop: 0 });
      this.showStatusToast();
      return;
    }

    this.setData({ isLoggedIn: false, courses: [], loading: false, scrollTop: 0 });
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
    app.switchTab(e.currentTarget.dataset.index);
  }
});