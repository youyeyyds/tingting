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
    refresherTriggered: false,
    loadTime: '',
    bannerSpeed: 5000,
    loading: true
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    const loadTime = Date.now();
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      loadTime: loadTime
    });
    this.checkLoginStatus();
    this.loadHeadlines();
    if (this.data.isLoggedIn) {
      this.loadFavorites();
    }
  },

  onShow() {
    this.checkLoginStatus();
    // 切换页面时不重新加载，保持原有数据
    if (this.data.isLoggedIn && app.globalData.userId) {
      if (this.data.favoriteChapters.length === 0) {
        this.loadFavorites();
      }
    }
  },

  onRefresh() {
    const newLoadTime = Date.now();
    this.setData({ refresherTriggered: true, loadTime: newLoadTime });
    this.checkLoginStatus();
    this.loadHeadlines();
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
      this.setData({ favoriteChapters: [] });
      return Promise.resolve();
    }

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
          favoriteChapters: favorites.map(ch => this.formatChapter(ch))
        });
      }
    })
    .catch(err => {
      console.error('获取收藏失败:', err);
    });
  },

  loadHeadlines() {
    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getHeadlines', page: 'favorite' }
    })
    .then(res => {
      if (res.result.success) {
        const headlines = res.result.data.map(h => ({
          ...h,
          image: this.addTimestamp(h.image)
        }));
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  addTimestamp(url) {
    if (!url) return url;
    const t = this.data.loadTime;
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
      this.setData({ favoriteChapters: [], loading: false });
      return;
    }

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
      }
    } catch (err) {
      console.error('获取收藏失败:', err);
      this.setData({ loading: false });
    }
  },

  formatChapter(chapter) {
    const duration = Number(chapter.duration) || 0;
    const userProgress = chapter.userProgress || {};
    const lastPlayTime = Number(userProgress.lastPlayTime) || 0;
    const finished = userProgress.finished === true;

    // 计算进度
    let progress = 0;
    if (finished) {
      progress = 100;
    } else if (lastPlayTime > 0 && duration > 0) {
      progress = Math.min(Math.round((lastPlayTime / duration) * 100), 100);
    }

    let progressText = '未学习';
    if (progress === 100) progressText = '已学完';
    else if (progress > 0) progressText = `已学${progress}%`;

    return {
      ...chapter,
      // 用户进度信息（放到顶层，便于播放器使用）
      lastPlayTime,
      finished,
      progress,
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

  // 点击课程跳转到课程详情页
  onCourseTap(e) {
    const courseId = e.currentTarget.dataset.id;
    if (courseId) {
      wx.navigateTo({ url: `/pages/chapter/index?id=${courseId}` });
    }
  },

  // 点击卡片播放
  onChapterTap(e) {
    const index = e.currentTarget.dataset.index;
    this.playFavoriteList(index);
  },

  // 点击播放按钮
  onPlayTap(e) {
    const index = e.currentTarget.dataset.index;
    this.playFavoriteList(index);
  },

  // 播放收藏列表
  playFavoriteList(startIndex) {
    const favoriteChapters = this.data.favoriteChapters;
    if (favoriteChapters.length === 0) return;

    // 构建播放列表数据
    const playlistData = favoriteChapters.map(ch => ({
      _id: ch._id,
      title: ch.title,
      duration: ch.duration,
      audioUrl: ch.audioUrl,
      seq: ch.seq,
      course: ch.course,
      courseTitle: ch.courseTitle,
      courseCover: ch.courseCover,
      author: ch.author,
      // 用户进度信息（formatChapter 已放到顶层）
      lastPlayTime: ch.lastPlayTime || 0,
      finished: ch.finished || false
    }));

    // 保存到全局
    app.globalData.playlistChaptersData = playlistData;
    app.globalData.playingIndex = startIndex;
    app.globalData.playingChapter = playlistData[startIndex];

    // 获取第一个章节对应的课程信息作为播放课程
    const firstChapter = playlistData[startIndex];
    app.globalData.playingCourse = {
      _id: firstChapter.course,
      title: firstChapter.courseTitle,
      cover: firstChapter.courseCover,
      author: firstChapter.author,
      chapterCount: playlistData.length
    };

    // 激活迷你播放器
    app.globalData.miniPlayerActive = true;
    app.globalData.miniPlayerIndexFadedIn = false;

    // 通知迷你播放器开始播放
    app.notifyCallbacks('onPlayFromList', {
      index: startIndex,
      chapters: playlistData
    });
  },

  // 删除收藏（取消收藏）
  async onRemoveTap(e) {
    const chapterId = e.currentTarget.dataset.id;
    const index = e.currentTarget.dataset.index;

    try {
      const res = await wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'toggleFavorite',
          chapterId: chapterId,
          userId: app.globalData.userId
        }
      });

      if (res.result.success) {
        // 从本地列表中移除
        const favoriteChapters = this.data.favoriteChapters;
        favoriteChapters.splice(index, 1);
        this.setData({ favoriteChapters });

        wx.showToast({ title: '已取消收藏', icon: 'success' });
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' });
      }
    } catch (err) {
      console.error('取消收藏失败:', err);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  onTabChange(e) {
    const { index } = e.currentTarget.dataset;
    if (index == 1) return;
    // 点击首页或个人，正常跳转
    wx.redirectTo({ url: `/pages/${['index', '', 'mine'][index]}/index` });
  }
});