// favorite/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    activeTab: 1,
    isLoggedIn: false,
    favoriteChapters: [],
    loading: true
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
  },

  onShow() {
    this.checkLoginStatus();
    if (this.data.isLoggedIn && app.globalData.userId) {
      this.loadFavorites();
    }
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
    wx.redirectTo({ url: `/pages/${['index', '', 'mine'][index]}/index` });
  }
});