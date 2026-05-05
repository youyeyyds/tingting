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
        this.syncCoverUrls();
      }
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

  initCache() {
    // 优先从本地存储读取缓存
    let headlines = app.globalData.indexHeadlines;

    if (!headlines?.length) {
      headlines = wx.getStorageSync('indexHeadlines') || [];
      app.globalData.indexHeadlines = headlines;
    }

    // 武功池不缓存，每次从数据库读取
    app.globalData.martialArtsPool = [];
    this._martialArtsPool = null;

    // 用当前时间戳重建 headline URL
    const bannerTime = app.globalData.bannerLoadTime;
    if (headlines.length > 0) {
      headlines = headlines.map(h => ({
        ...h,
        image: this.processUrl(h.image, bannerTime, 'banner')
      }));
    }

    this.setData({ headlines, loading: true });

    if (!headlines.length) {
      this.loadHeadlines();
    }

    // 根据登录状态加载数据
    if (app.globalData.isLoggedIn) {
      this.loadCourses();
    } else {
      this.loadMinimalCourses();
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
    if (this.data.isLoggedIn !== isLoggedIn) {
      this.setData({ isLoggedIn });
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

  // 处理未登录状态（武功池已就绪）
  _onShowUnauthenticated() {
    if (this._realCourses?.length) {
      this.maskCourses();
    }
    this.syncCoverUrls();
    this.showStatusToast();
  },
  // 同步封面URL（只更新封面字段，保留其他数据）
  syncCoverUrls() {
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

    const m1 = url.match(/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
    if (m1 && m1[1] != t) {
      return url.replace(/seed\/\d+_(banner|cover)_/, `seed/${t}_${type}_`);
    }
    if (m1) return url;

    const m2 = url.match(/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
    if (m2) return `https://picsum.photos/seed/${t}_${type}_${m2[1]}/${m2[2]}`;

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

    // 重新随机武功池
    this.shuffleMartialArts();

    // 重新生成脱敏数据
    const newMasked = {};
    this.data.courses.forEach(c => {
      const art = this.getNextMartialArt();
      if (art) {
        const user = this.getMartialArtAuthor(art);
        newMasked[c._id] = { ...c, title: art.name, author: user, categoryName: art.type || art.novel || '江湖' };
      }
    });

    app.globalData.homePageMaskedCourses = newMasked;
    app.notifyCallbacks?.('onCoverRefresh', { coverLoadTime: t });

    this.setData({ refreshing: true, bannerTime: t, coverTime: t, headlines: [], courses: [] });

    Promise.all([this.loadHeadlines(), this.loadCourses()]).then(() => {
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
        wx.setStorageSync('indexHeadlines', headlines);
        this.setData({
          headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    });
  },

  // 加载完整课程（已登录用户）
  loadCourses() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getCourses', limit: 20, filterDraft: true, userId: app.globalData.userId }
    }).then(res => {
      if (res.result.success) {
        const courses = res.result.data.map(c => ({ ...c, cover: this.processUrl(c.cover, null, 'cover') }));
        this._realCourses = courses;
        app.globalData.indexCourses = courses;
        wx.setStorageSync('indexCourses', courses);
        this.setData({ courses, loading: false });
      } else {
        this.setData({ loading: false });
      }
    }).catch(() => this.setData({ loading: false }));
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
          // 不缓存到 indexCourses（因为不是完整数据）
          this._realCourses = courses;
          this.maskCourses(courses);
        } else {
          this.setData({ loading: false });
        }
      }).catch(() => this.setData({ loading: false }));
    });
  },

  // 加载武功数据（每次都从数据库读取，确保随机）
  loadMartialArts() {
    console.log('[loadMartialArts] calling cloud function');
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getMartialArts' }
    }).then(res => {
      console.log('[loadMartialArts] result:', res.result?.success, ', count:', res.result?.data?.length);
      if (res.result && res.result.success && res.result.data) {
        this._martialArtsPool = res.result.data;
        app.globalData.martialArtsPool = res.result.data;
        // 重置已显示的武功，重新洗牌
        this._displayedIds = new Set();
        this.shuffleMartialArts();
        console.log('[loadMartialArts] pool reloaded and shuffled');
      }
    });
  },

  // 打乱武功池
  shuffleMartialArts() {
    const pool = app.globalData.martialArtsPool;
    if (!pool?.length) return;
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    app.globalData.martialArtsPool = arr;
    this._martialArtsPool = arr;
    this._displayedIds = new Set();
  },

  // 获取下一个随机武功
  getNextMartialArt() {
    const pool = app.globalData.martialArtsPool;
    if (!pool?.length) return null;
    if (!this._displayedIds) {
      this._displayedIds = new Set();
    }
    if (this._displayedIds.size >= pool.length) {
      this.shuffleMartialArts();
    }
    for (const art of pool) {
      if (!this._displayedIds.has(art._id)) {
        this._displayedIds.add(art._id);
        return art;
      }
    }
    return null;
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
            categoryName: art.type || art.novel || '江湖'
          };
        } else {
          cached = { ...c, title: '未知武功', author: '江湖', categoryName: '' };
        }
        maskedCourses[c._id] = cached;
      }
      return cached;
    });

    app.globalData.homePageMaskedCourses = maskedCourses;
    this.setData({ courses: masked, loading: false });
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      this.setData({ logoutConfirmVisible: true });
    } else {
      wx.navigateTo({ url: '/pages/login/index' });
    }
  },

  onLogoutCancel() {
    this.setData({ logoutConfirmVisible: false });
  },

  onLogoutConfirm() {
    this.setData({ logoutConfirmVisible: false });
    app.logout();

    // 清理课程缓存
    app.globalData.indexCourses = [];
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

  onCloseMartialArt() {
    this.setData({ isClosing: true });
    setTimeout(() => {
      this.setData({ martialArtsVisible: false, isClosing: false, currentMartialArt: null, currentMartialArtLines: [] });
    }, ANIMATION_DURATION);
  },

  preventModalMove() {
    return true;
  },

  onTabChange(e) {
    const idx = e.currentTarget.dataset.index;
    if (idx == 0) return;
    if (!app.globalData.isLoggedIn) {
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
