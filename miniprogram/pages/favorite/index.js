// favorite/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: 1,
    isLoggedIn: false,
    favoriteChapters: [],
    headlines: [],
    loading: true,
    refresherTriggered: false
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight
    });
    this.checkLoginStatus();
    this.loadHeadlines();
  },

  onShow() {
    this.checkLoginStatus();
    this.loadHeadlines();
    if (this.data.isLoggedIn && app.globalData.userId) {
      this.loadFavorites();
    }
  },

  onRefresh() {
    this.setData({ refresherTriggered: true });
    this.checkLoginStatus();
    this.loadHeadlines(true);
    if (this.data.isLoggedIn && app.globalData.userId) {
      this.loadFavoritesAsync().then(() => {
        this.setData({ refresherTriggered: false });
      });
    } else {
      this.setData({ refresherTriggered: false });
    }
  },

  loadFavoritesAsync() {
    if (!app.globalData.userId) {
      this.setData({ loading: false, favoriteChapters: [] });
      return Promise.resolve();
    }

    this.setData({ loading: true });

    return wx.cloud.callFunction({
      name: 'userFunctions',
      data: {
        type: 'getUserStats',
        userId: app.globalData.userId
      }
    })
    .then(res => {
      if (res.result.success) {
        const favorites = res.result.data.favoriteChapters || [];
        this.setData({
          favoriteChapters: favorites.map(ch => this.formatChapter(ch)),
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    })
    .catch(err => {
      console.error('获取收藏失败:', err);
      this.setData({ loading: false });
    });
  },

  loadHeadlines(refresh = false) {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'favorite' }
    })
    .then(res => {
      if (res.result.success) {
        let headlines = res.result.data;
        if (refresh) {
          headlines = headlines.map(h => ({
            ...h,
            image: this.addTimestamp(h.image)
          }));
        }
        this.setData({ headlines: headlines });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  addTimestamp(url) {
    if (!url) return url;
    const t = Date.now();
    return url.includes('?') ? `${url}&t=${t}` : `${url}?t=${t}`;
  },

  checkLoginStatus() {
    const { isLoggedIn, userId } = app.globalData;
    this.setData({ isLoggedIn: isLoggedIn || false });

    if (!isLoggedIn && userId) {
      // 尝试从本地存储恢复登录状态
      const storedUserId = wx.getStorageSync('userId');
      if (storedUserId) {
        app.globalData.isLoggedIn = true;
        app.globalData.userId = storedUserId;
        this.setData({ isLoggedIn: true });
      }
    }
  },

  async loadFavorites() {
    if (!app.globalData.userId) {
      this.setData({ loading: false, favoriteChapters: [] });
      return;
    }

    this.setData({ loading: true });

    try {
      const res = await wx.cloud.callFunction({
        name: 'userFunctions',
        data: {
          type: 'getUserStats',
          userId: app.globalData.userId
        }
      });

      if (res.result.success) {
        const favorites = res.result.data.favoriteChapters || [];
        this.setData({
          favoriteChapters: favorites.map(ch => this.formatChapter(ch)),
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('获取收藏失败:', err);
      this.setData({ loading: false });
    }
  },

  formatChapter(chapter) {
    const duration = Number(chapter.duration) || 0;
    const progress = chapter.userProgress?.finished ? 100 : 0;
    let progressText = '未学习';
    if (progress === 100) progressText = '已学完';

    return {
      ...chapter,
      progressText,
      durationText: this.formatDuration(duration)
    };
  },

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  },

  handleLogin() {
    wx.navigateTo({ url: '/pages/login/index' });
  },

  onChapterTap(e) {
    const chapterId = e.currentTarget.dataset.id;
    const courseId = e.currentTarget.dataset.course;
    wx.navigateTo({ url: `/pages/chapter/index?id=${courseId}` });
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index === 1) return;
    // 点击首页或个人，正常跳转
    wx.redirectTo({ url: `/pages/${['index', '', 'mine'][index]}/index` });
  }
});