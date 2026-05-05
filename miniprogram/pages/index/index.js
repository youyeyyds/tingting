// index.js
const app = getApp();

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
    homeProtect: true,
    loading: true,
    activeTab: 0,
    refreshing: false,
    maskedCourses: {},
    bannerTime: 0,
    coverTime: 0,
    logoutConfirmVisible: false, // 退出登录确认弹窗
    martialArtsVisible: false, // 武功详情弹窗
    isClosing: false, // 是否正在关闭动画
    currentMartialArt: null, // 当前武功详情
    currentMartialArtLines: [], // 当前武功描述行（用于换行渲染）
    displayedMartialArts: [], // 已显示的武功列表（用于随机不重复）
    martialArtsPool: [] // 武功池（用于随机选择）
  },

  onLoad() {
    this.initLayout();
    this.initTimes();
    this.initCache();
    this.checkLogin();
    // 注册封面刷新回调
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
    if (!app.globalData.homePageMaskedCourses) app.globalData.homePageMaskedCourses = {};

    this.setData({
      bannerTime: app.globalData.bannerLoadTime,
      coverTime: app.globalData.coverLoadTime,
      maskedCourses: app.globalData.homePageMaskedCourses
    });
  },

  initCache() {
    // 优先从本地存储读取缓存，避免空白页
    let headlines = app.globalData.indexHeadlines;
    let courses = app.globalData.indexCourses;

    if (!headlines?.length) {
      headlines = wx.getStorageSync('indexHeadlines') || [];
      app.globalData.indexHeadlines = headlines;
    }
    if (!courses?.length) {
      courses = wx.getStorageSync('indexCourses') || [];
      app.globalData.indexCourses = courses;
    }

    // 如果有缓存，需要用当前时间戳重建 URL
    const bannerTime = app.globalData.bannerLoadTime;
    const coverTime = app.globalData.coverLoadTime;
    if (headlines.length > 0) {
      headlines = headlines.map(h => ({
        ...h,
        image: this.processUrl(h.image, bannerTime, 'banner')
      }));
    }
    if (courses.length > 0) {
      courses = courses.map(c => ({
        ...c,
        cover: this.processUrl(c.cover, coverTime, 'cover')
      }));
    }

    this.setData({
      headlines,
      loading: true // 始终显示 loading，等数据加载完成后再决定显示什么
    });

    if (!headlines.length) this.loadHeadlines();
    else this.maskCourses();

    this.loadCourses(); // 始终重新加载课程数据，加载完成后再根据登录状态决定显示
  },

  onShow() {
    console.log('[Index onShow] start');
    console.log('[Index onShow] globalData.isLoggedIn:', app.globalData.isLoggedIn);
    console.log('[Index onShow] globalData.loginFlag:', app.globalData.loginFlag);
    console.log('[Index onShow] globalData.needRestoreMaskedData:', app.globalData.needRestoreMaskedData);
    console.log('[Index onShow] globalData.logoutFlag:', app.globalData.logoutFlag);
    console.log('[Index onShow] data.isLoggedIn:', this.data.isLoggedIn);
    console.log('[Index onShow] _realCourses:', this._realCourses?.length);
    console.log('[Index onShow] data.courses:', this.data.courses.length);
    // 先检查是否需要恢复脱敏数据（在 checkLogin 之前，防止恢复旧课程）
    if (app.globalData.needRestoreMaskedData && !app.globalData.loginFlag) {
      console.log('[Index onShow] needRestoreMaskedData branch');
      app.globalData.needRestoreMaskedData = false;
      app.globalData.indexCourses = [];
      wx.removeStorageSync('indexCourses');
      const ct = app.globalData.coverLoadTime;
      const maskedCourses = { ...app.globalData.homePageMaskedCourses };
      Object.keys(maskedCourses).forEach(id => {
        maskedCourses[id] = {
          ...maskedCourses[id],
          cover: this.processUrl(maskedCourses[id].cover, ct, 'cover')
        };
      });
      app.globalData.homePageMaskedCourses = maskedCourses;
      const courses = Object.values(maskedCourses);
      this._realCourses = null;
      this.setData({ isLoggedIn: false, courses, maskedCourses, loading: false });
      console.log('[Index onShow] restored masked data, _realCourses set to null');
      this.showStatusToast();
      return;
    }

    // 更新登录状态
    const wasLoggedIn = this.data.isLoggedIn;
    const isLoggedIn = app.globalData.isLoggedIn || false;
    console.log('[Index onShow] wasLoggedIn:', wasLoggedIn, ', isLoggedIn:', isLoggedIn);
    if (wasLoggedIn !== isLoggedIn) {
      console.log('[Index onShow] login state changed, setData');
      this.setData({ isLoggedIn });
    }

    // 根据登录状态显示正确数据
    if (isLoggedIn) {
      if (this._realCourses && this._realCourses.length) {
        console.log('[Index onShow] calling maskCourses with _realCourses, length:', this._realCourses.length);
        this.maskCourses();
      } else if (this.data.courses.length) {
        console.log('[Index onShow] re-login detected, calling loadCourses');
        this.loadCourses();
      } else {
        console.log('[Index onShow] no _realCourses and no courses, calling loadCourses');
        this.loadCourses();
      }
    } else {
      // 未登录，显示脱敏数据
      if (this._realCourses && this._realCourses.length) {
        console.log('[Index onShow] calling maskCourses for masked display');
        this.maskCourses();
      }
    }

    this.syncTimes();
    this.showStatusToast();
    this.syncCoverUrls();
  },

  syncTimes() {
    const bt = app.globalData.bannerLoadTime;
    const ct = app.globalData.coverLoadTime;

    if (bt !== this.data.bannerTime) {
      const headlines = this.data.headlines.map(h => ({
        ...h, image: this.processUrl(h.image, bt, 'banner')
      }));
      this.setData({ bannerTime: bt, headlines });
      app.globalData.indexHeadlines = headlines; // 同步回全局缓存
    }

    if (ct !== this.data.coverTime) {
      const courses = this.data.courses.map(c => ({
        ...c, cover: this.processUrl(c.cover, ct, 'cover')
      }));
      this.setData({ coverTime: ct, courses });
      app.globalData.indexCourses = courses; // 同步回全局缓存
    }
  },

// 同步封面URL到所有数据源：courses、_realCourses、maskedCourses、homePageMaskedCourses
  syncCoverUrls() {
    const ct = app.globalData.coverLoadTime;
    if (!ct) return;

    // 更新 courses
    const courses = (this._realCourses || this.data.courses).map(c => ({
      ...c, cover: this.processUrl(c.cover, ct, 'cover')
    }));

    // 更新 _realCourses
    if (this._realCourses) {
      this._realCourses = courses;
    }

    // 更新 maskedCourses 缓存中的封面
    const maskedCourses = { ...this.data.maskedCourses };
    Object.keys(maskedCourses).forEach(id => {
      const mc = maskedCourses[id];
      const realCourse = courses.find(c => c._id === id);
      if (realCourse) {
        maskedCourses[id] = { ...mc, cover: realCourse.cover };
      }
    });

    // 更新全局首页脱敏课程缓存
    app.globalData.homePageMaskedCourses = maskedCourses;

    this.setData({ coverTime: ct, courses, maskedCourses });
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
    console.log('[Index] onRefresh, bannerLoadTime:', t);
    // 不再清空其他页面的缓存（loginHeadlines, favoriteHeadlines, mineHeadlines）
    // 各页面通过 onShow 检测 bannerLoadTime 变化来同步图片

    // 重新加载武功数据
    this.loadMartialArts();

    // 重新随机脱敏数据
    this.shuffleMartialArts();
    const newMasked = {};
    this.data.courses.forEach(c => {
      const art = this.getNextMartialArt();
      if (art) {
        const user = art.users && art.users.length > 0 ? art.users[0] : (art.faction || '');
        newMasked[c._id] = { ...c, title: art.name, author: user, categoryName: art.type || art.novel || '' };
      }
    });
    app.globalData.homePageMaskedCourses = newMasked;
    app.notifyCallbacks?.('onCoverRefresh', { coverLoadTime: t });

    this.setData({ refreshing: true, bannerTime: t, coverTime: t, maskedCourses: newMasked, headlines: [], courses: [] });

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
          bannerSpeed: (res.result.speed || 5) * 1000,
          homeProtect: res.result.homeProtect !== false
        });
        this.maskCourses();
      }
    }).catch(e => console.error('获取头条失败', e));
  },

  loadCourses() {
    // 先确保武功数据加载完成
    const martialArtsPromise = this._martialArtsPool && this._martialArtsPool.length > 0
      ? Promise.resolve()
      : this.loadMartialArts();

    return martialArtsPromise.then(() => {
      return wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'getCourses', limit: 20, filterDraft: true, userId: app.globalData.userId }
      }).then(res => {
        if (res.result.success) {
          const courses = res.result.data.map(c => ({ ...c, cover: this.processUrl(c.cover, null, 'cover') }));
          app.globalData.indexCourses = courses;
          wx.setStorageSync('indexCourses', courses);
          // 先不设置 courses，等 maskCourses 处理后再设置
          this.maskCourses(courses);
        } else {
          this.setData({ loading: false });
        }
      }).catch(() => this.setData({ loading: false }));
    });
  },

  // 加载武功数据（从数据库）
  loadMartialArts() {
    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getMartialArts', limit: 100 }
    }).then(res => {
      console.log('[loadMartialArts] result:', JSON.stringify(res.result));
      if (res.result && res.result.success && res.result.data) {
        this._martialArtsPool = res.result.data;
        console.log('[loadMartialArts] loaded:', this._martialArtsPool.length, 'items');
        // 打乱顺序
        this.shuffleMartialArts();
      } else {
        console.log('[loadMartialArts] failed or no data, result:', res.result);
        this._martialArtsPool = [];
      }
    }).catch((err) => {
      console.error('[loadMartialArts] error:', err);
      this._martialArtsPool = [];
    });
  },

  // 打乱武功池
  shuffleMartialArts() {
    if (!this._martialArtsPool) return;
    // Fisher-Yates 洗牌算法
    const arr = [...this._martialArtsPool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this._martialArtsPool = arr;
    this._displayedMartialArtIds = new Set();
  },

  // 获取下一个随机武功（不重复）
  getNextMartialArt() {
    if (!this._martialArtsPool || this._martialArtsPool.length === 0) return null;
    // 如果都用完了，重新洗牌
    if (this._displayedMartialArtIds.size >= this._martialArtsPool.length) {
      this.shuffleMartialArts();
    }
    // 找一个未显示的武功
    for (const art of this._martialArtsPool) {
      if (!this._displayedMartialArtIds.has(art._id)) {
        this._displayedMartialArtIds.add(art._id);
        return art;
      }
    }
    return null;
  },

  maskCourses(realCourses) {
    // 如果传入了 realCourses，先保存到 this._realCourses
    if (realCourses) {
      this._realCourses = realCourses;
    }

    const { homeProtect } = this.data;
    const isLoggedIn = app.globalData.isLoggedIn || false; // 使用全局状态而非 this.data（避免 setData 异步问题）
    console.log('[maskCourses] homeProtect:', homeProtect, ', isLoggedIn:', isLoggedIn, ', _realCourses:', this._realCourses?.length, ', realCourses:', realCourses?.length);
    // 使用保存的真实课程数据
    const courses = this._realCourses || [];

    if (!homeProtect || isLoggedIn) {
      // 已登录或首页保护关闭，恢复真实课程数据
      console.log('[maskCourses] showing REAL courses, courses count:', courses.length);
      this.setData({ courses, loading: false });
      return;
    }

    // 未登录，显示脱敏数据（使用数据库武功）
    let maskedCourses = this.data.maskedCourses || {};
    const masked = courses.map(c => {
      let cached = maskedCourses[c._id];
      if (!cached) {
        const art = this.getNextMartialArt();
        if (art) {
          const user = art.users && art.users.length > 0 ? art.users[0] : (art.faction || '');
          cached = { ...c, title: art.name, author: user, categoryName: art.type || art.novel || '' };
        } else {
          cached = { ...c, title: '未知武功', author: '未知', categoryName: '' };
        }
        maskedCourses[c._id] = cached;
      }
      return cached;
    });

    app.globalData.homePageMaskedCourses = maskedCourses;
    this.setData({ courses: masked, maskedCourses, loading: false });
  },

  checkLogin() {
    const prevState = this.data.isLoggedIn;
    const newState = app.globalData.isLoggedIn || false;
    if (prevState !== newState) {
      this.setData({ isLoggedIn: newState });
      if (newState && this._realCourses && this._realCourses.length) {
        // 登录后通过 maskCourses 处理，确保正确显示
        this.maskCourses();
      }
    }
  },

  handleLogin() {
    if (this.data.isLoggedIn) {
      // 已登录，显示退出确认弹窗
      this.setData({ logoutConfirmVisible: true });
    } else {
      // 未登录，跳转到登录页
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

    // 退出登录（通用逻辑）
    app.logout();

    // 清理课程缓存，防止退出后真实数据残留在本地
    app.globalData.indexCourses = [];
    wx.removeStorageSync('indexCourses');

    // 清理播放状态缓存，确保重新进入时不恢复 mini-player
    wx.removeStorageSync('playingCourse');
    wx.removeStorageSync('playingChapter');
    wx.removeStorageSync('playingSeq');
    wx.removeStorageSync('playlistSortOrder');
    wx.removeStorageSync('playMode');

    // 恢复脱敏数据（保留 this._realCourses 用于第二次登录恢复）
    const maskedCourses = app.globalData.homePageMaskedCourses || {};
    const courses = Object.values(maskedCourses);

    this.setData({ isLoggedIn: false, courses, maskedCourses, loading: false }, () => {
      this.showStatusToast();
    });
  },

  onCourseTap(e) {
    if (!app.globalData.isLoggedIn) {
      // 未登录，显示武功详情弹窗
      const courseId = e.currentTarget.dataset.id;
      const maskedCourse = this.data.maskedCourses?.[courseId];
      if (maskedCourse) {
        // 从武功池中找到完整的武功信息
        const martialArt = this._martialArtsPool?.find(m => m.name === maskedCourse.title);
        const description = martialArt ? martialArt.description : '暂无描述';
        // 处理换行：支持 \r\n、\n 以及 literal \n 字符串
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
    }, 300);
  },

  // 阻止弹窗触摸穿透
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