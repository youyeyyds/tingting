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
    activeTab: 0,
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
    this.initCache();
    app.registerCallback?.('onCoverRefresh', (data) => {
      if (data?.coverLoadTime) {
        app.globalData.coverLoadTime = data.coverLoadTime;
        app.globalData.bannerLoadTime = data.bannerLoadTime || data.coverLoadTime;
        // 清空缓存，重新加载数据
        app.globalData.homePageHeadlines = [];
        app.globalData.homePageCourses = [];
        this.setData({
          bannerTime: app.globalData.bannerLoadTime,
          coverTime: app.globalData.coverLoadTime,
          headlines: [],
          courses: []
        }, () => {
          this.loadHeadlines();
          if (app.globalData.isLoggedIn) {
            this.loadCourses();
          } else {
            this.loadMinimalCourses();
          }
        });
      }
    });
  },

  initLayout() {
    const { statusBarHeight, windowHeight, windowWidth } = wx.getWindowInfo();
    const menu = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menu.top - statusBarHeight) * 2 + menu.height;
    const headerHeight = statusBarHeight + navBarHeight;
    const tabH = 100 * windowWidth / 750; // 100rpx 转 px

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

  initCache() {
    // 武功池不缓存，每次从数据库读取
    app.globalData.martialArtsPool = [];
    this._martialArtsPool = null;

    // 优先使用带时间戳的首页缓存
    let cachedHeadlines = app.globalData.homePageHeadlines;
    let cachedCourses = app.globalData.homePageCourses;

    if (cachedHeadlines?.length) {
      // 使用缓存的带时间戳数据
      this.setData({ headlines: cachedHeadlines, loading: false });
    } else {
      // 没有缓存，加载数据
      this.setData({ loading: true });
      this.loadHeadlines();
    }

    if (cachedCourses?.length) {
      // 使用缓存的带时间戳数据
      this.setData({ courses: cachedCourses, loading: false });
      // 如果已登录且没有真实课程数据，加载课程
      if (app.globalData.isLoggedIn && !this._realCourses?.length) {
        this.loadCourses();
      } else if (!app.globalData.isLoggedIn && !this._realCourses?.length) {
        this.loadMinimalCourses();
      }
    } else {
      // 没有缓存，加载数据
      if (app.globalData.isLoggedIn) {
        this.loadCourses();
      } else {
        this.loadMinimalCourses();
      }
    }
  },

  onShow() {
    // logout 后首次回到首页，恢复脱敏数据
    if (app.globalData.needRestoreMaskedData && !app.globalData.loginFlag) {
      app.globalData.needRestoreMaskedData = false;
      app.globalData.indexCourses = [];
      wx.removeStorageSync('indexCourses');
      const maskedCourses = this.getMaskedCoursesFromCache();
      const courses = Object.values(maskedCourses);
      this._realCourses = null;
      this.setData({ isLoggedIn: false, courses, loading: false });
      this.showStatusToast();
      return;
    }

    // 更新登录状态
    const isLoggedIn = app.globalData.isLoggedIn || false;
    const wasLoggedIn = this.data.isLoggedIn;
    if (wasLoggedIn !== isLoggedIn) {
      this.setData({ isLoggedIn });
      // 登录状态变化：从未登录变登录，需要重新加载真实课程
      if (isLoggedIn) {
        this._realCourses = null;
        this.loadCourses();
        this.showStatusToast();
        return;
      }
    }

    // 已登录：加载或显示课程
    if (isLoggedIn) {
      if (!this._realCourses?.length) {
        this.loadCourses();
      } else {
        this.setData({ courses: this._realCourses, loading: false });
      }
      this.syncCoverUrls();
      this.showStatusToast();
      return;
    }

    // 未登录：热启动时重新加载武功和课程
    if (app.globalData.isHotStart) {
      app.globalData.martialArtsPool = [];
      this._martialArtsPool = null;
      app.globalData.homePageMaskedCourses = {};
      this._realCourses = null;
      this.loadMartialArts().then(() => {
        this.loadMinimalCourses().then(() => {
          this._onShowUnauthenticated();
        });
      });
    } else {
      this._onShowUnauthenticated();
    }
  },

// 同步封面URL（只更新封面字段，保留其他数据）
  syncCoverUrls() {
    // 如果有带时间戳的缓存，直接使用缓存数据
    const cachedCourses = app.globalData.homePageCourses;
    if (cachedCourses?.length) {
      this.setData({ coverTime: app.globalData.coverLoadTime, courses: cachedCourses });
      return;
    }

    const ct = app.globalData.coverLoadTime;
    if (!ct) return;

    // 只更新现有 courses 的封面，保持其他字段不变
    const courses = this.data.courses.map(c => ({
      ...c, cover: this.processUrl(c.cover, ct, 'cover')
    }));

    this.setData({ coverTime: ct, courses });
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

    // 已有时间戳格式，更新时间戳
    const m1 = url.match(/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
    if (m1 && m1[1] != t) {
      return url.replace(/seed\/\d+_(banner|cover)_/, `seed/${t}_${type}_`);
    }
    if (m1) return url;

    // seed格式（非时间戳），添加时间戳
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
    app.globalData.indexHeadlines = [];
    app.globalData.indexCourses = [];
    // 清空带时间戳的首页缓存
    app.globalData.homePageHeadlines = [];
    app.globalData.homePageCourses = [];

    // 重新加载武功池和脱敏数据
    app.globalData.martialArtsPool = [];
    this._martialArtsPool = null;
    app.globalData.homePageMaskedCourses = {};

    app.notifyCallbacks?.('onCoverRefresh', { coverLoadTime: t });

    this.setData({ refreshing: true, bannerTime: t, coverTime: t, headlines: [], courses: [] });

    Promise.all([this.loadHeadlines(), this.loadMinimalCourses()]).then(() => {
      this.setData({ refreshing: false });
    });
  },

  loadHeadlines() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'index' }
    }).then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({ ...h, image: this.processUrl(h.image, null, 'banner') }));
        app.globalData.indexHeadlines = headlines;
        app.globalData.homePageHeadlines = headlines;
        wx.setStorageSync('indexHeadlines', headlines);
        this.setData({
          headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    }).catch(e => console.error('获取头条失败', e));
  },

  loadCourses() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourses', limit: 20, filterDraft: true, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        const courses = res.result.data.map(c => ({ ...c, cover: this.processUrl(c.cover, null, 'cover') }));
        this._realCourses = courses;
        app.globalData.indexCourses = courses;
        app.globalData.homePageCourses = courses;
        wx.setStorageSync('indexCourses', courses);
        this.setData({ courses, loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => this.setData({ loading: false }));
  },

  // 加载武功数据（每次都从数据库读取，云函数已随机）
  loadMartialArts() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getMartialArts' }
    }).then(res => {
      if (res.result && res.result.success && res.result.data) {
        this._martialArtsPool = res.result.data;
        app.globalData.martialArtsPool = res.result.data;
        this._martialArtIndex = 0;
      }
    });
  },

  // 获取下一个武功
  getNextMartialArt() {
    const pool = app.globalData.martialArtsPool;
    if (!pool?.length) return null;
    if (!this._martialArtIndex) {
      this._martialArtIndex = 0;
    }
    if (this._martialArtIndex >= pool.length) {
      // 武功池用完，清空后下次会自动重新加载
      app.globalData.martialArtsPool = [];
      this._martialArtsPool = null;
      this._martialArtIndex = 0;
      return null;
    }
    return pool[this._martialArtIndex++];
  },

  // 获取武功作者（人物/门派）
  getMartialArtAuthor(art) {
    if (art.users?.length) return art.users[0];
    if (art.faction) return art.faction;
    return '江湖';
  },

  // 获取缓存的脱敏课程
  getMaskedCoursesFromCache() {
    let masked = app.globalData.homePageMaskedCourses || {};
    const ct = app.globalData.coverLoadTime;
    Object.keys(masked).forEach(id => {
      masked[id] = { ...masked[id], cover: this.processUrl(masked[id].cover, ct, 'cover') };
    });
    return masked;
  },

  // 加载最小课程信息（未登录用户）
  loadMinimalCourses() {
    // 先确保武功池已加载
    const martialArtsPromise = (app.globalData.martialArtsPool?.length > 0)
      ? Promise.resolve()
      : this.loadMartialArts();

    return martialArtsPromise.then(() => {
      return wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'getMinimalCourses', limit: 20 }
      }).then(res => {
        if (res.result.success) {
          const courses = res.result.data.map(c => ({ ...c, cover: this.processUrl(c.cover, null, 'cover') }));
          this._realCourses = courses;
          this.maskCourses();
        } else {
          this.setData({ loading: false });
        }
      }).catch(() => this.setData({ loading: false }));
    });
  },

  // 处理未登录状态（武功池已就绪）
  _onShowUnauthenticated() {
    if (this._realCourses?.length) {
      this.maskCourses();
    }
    this.syncCoverUrls();
    this.showStatusToast();
  },

  // 脱敏课程（用武功替换 title/author/categoryName）
  maskCourses() {
    // 武功池未加载完成时，等待
    if (!app.globalData.martialArtsPool?.length) {
      return this.loadMartialArts().then(() => this.maskCourses());
    }

    // 课程数据未就绪时，等待
    if (!this._realCourses?.length) {
      const checkCourses = () => {
        if (this._realCourses?.length) {
          this.maskCourses();
        } else {
          setTimeout(checkCourses, 50);
        }
      };
      checkCourses();
      return;
    }

    const courses = this._realCourses;
    let maskedCourses = app.globalData.homePageMaskedCourses;
    if (!maskedCourses) maskedCourses = {};

    const masked = courses.map(c => {
      let cached = maskedCourses[c._id];
      if (!cached) {
        const art = this.getNextMartialArt();
        if (art) {
          cached = {
            ...c,
            title: art.name,
            author: this.getMartialArtAuthor(art),
            categoryName: art.type,
            progress: 0
          };
        } else {
          cached = { ...c, title: '未知武功', author: '江湖', categoryName: '', progress: 0 };
        }
        maskedCourses[c._id] = cached;
      }
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

    // 清理课程缓存
    app.globalData.indexCourses = [];
    app.globalData.homePageCourses = [];
    wx.removeStorageSync('indexCourses');

    // 清理播放状态
    wx.removeStorageSync('playingCourse');
    wx.removeStorageSync('playingChapter');
    wx.removeStorageSync('playingSeq');
    wx.removeStorageSync('playlistSortOrder');
    wx.removeStorageSync('playMode');

    // 显示脱敏数据
    const maskedCourses = this.getMaskedCoursesFromCache();
    const courses = Object.values(maskedCourses);

    this.setData({ isLoggedIn: false, courses, loading: false }, () => {
      this.showStatusToast();
    });
  },

  onCourseTap(e) {
    if (!app.globalData.isLoggedIn) {
      const courseId = e.currentTarget.dataset.id;
      const maskedCourse = app.globalData.homePageMaskedCourses?.[courseId];
      if (maskedCourse) {
        const martialArt = app.globalData.martialArtsPool?.find(m => m.name === maskedCourse.title);
        const description = martialArt?.description || '暂无描述';
        const lines = description.split(/\r?\n|\\n/).filter(l => l.trim());
        this.setData({
          martialArtsVisible: true,
          currentMartialArt: martialArt || {
            name: maskedCourse.title,
            description: description,
            novel: maskedCourse.categoryName || '',
            users: maskedCourse.author ? [maskedCourse.author] : []
          },
          currentMartialArtLines: lines.length > 0 ? lines : ['暂无描述']
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
    const targetUrl = `/pages/${['', 'favorite', 'mine'][idx]}/index`;
    const pages = getCurrentPages();
    const targetPage = pages.find(p => p.route === `pages/${['', 'favorite', 'mine'][idx]}/index`);
    if (targetPage) {
      const delta = pages.length - pages.indexOf(targetPage) - 1;
      if (delta > 0) {
        wx.navigateBack({ delta });
      } else {
        wx.navigateTo({ url: targetUrl });
      }
    } else {
      wx.navigateTo({ url: targetUrl });
    }
  }
});