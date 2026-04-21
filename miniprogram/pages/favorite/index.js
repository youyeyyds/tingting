// favorite/index.js
const app = getApp();

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    headerHeight: 0,
    scrollHeight: 0, // scroll-view 高度
    activeTab: 1,
    isLoggedIn: false,
    favoriteChapters: [],
    headlines: [],
    refresherTriggered: false,
    loadTime: 0, // 横幅时间戳
    coverLoadTime: 0, // 封面时间戳（只在首页刷新才更新）
    bannerSpeed: 5000,
    loading: true
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButton.top - windowInfo.statusBarHeight) * 2 + menuButton.height;
    const headerHeight = windowInfo.statusBarHeight + navBarHeight;
    // scroll-view 高度 = 屏幕高度 - header - tabBar(100rpx转px)
    const rpxToPx = windowInfo.windowWidth / 750;
    const tabBarHeight = 100 * rpxToPx;
    const scrollHeight = windowInfo.windowHeight - headerHeight - tabBarHeight;
    // 使用全局时间戳和数据缓存，保持图片稳定
    if (!app.globalData.bannerLoadTime) {
      app.globalData.bannerLoadTime = Date.now();
    }
    if (!app.globalData.coverLoadTime) {
      app.globalData.coverLoadTime = Date.now();
    }
    const loadTime = app.globalData.bannerLoadTime;
    const coverLoadTime = app.globalData.coverLoadTime;
    // 检查是否有缓存的横幅数据
    const cachedHeadlines = app.globalData.favoriteHeadlines || [];
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight,
      navBarHeight: navBarHeight,
      headerHeight: headerHeight,
      scrollHeight: scrollHeight,
      loadTime: loadTime,
      coverLoadTime: coverLoadTime,
      headlines: cachedHeadlines
    });
    this.checkLoginStatus();
    // 只在首次加载（无缓存）时获取横幅数据
    if (cachedHeadlines.length === 0) {
      this.loadHeadlines();
    }
    if (this.data.isLoggedIn && this.data.favoriteChapters.length === 0) {
      this.loadFavorites();
    }

    // 注册播放器回调
    this.audioCallback = {
      onChapterChange: (data) => {
        const { chapterId } = data;
        this.setData({
          favoriteChapters: this.data.favoriteChapters.map(ch => ({
            ...ch,
            isPlaying: ch._id === chapterId
          }))
        });
      },
      onProgressUpdate: (data) => {
        const { chapterId, lastPlayTime, finished } = data;
        const favoriteChapters = this.data.favoriteChapters.map(ch => {
          if (ch._id === chapterId) {
            // 如果之前已学完，且本次 finished 不是 true，保持已学完状态
            if (ch.finished && finished !== true) {
              return { ...ch, lastPlayTime };
            }
            const duration = Number(ch.duration) || 0;
            let progress = 0;
            if (finished === true) {
              progress = 100;
            } else if (lastPlayTime > 0 && duration > 0) {
              progress = Math.min(Math.round((lastPlayTime / duration) * 100), 100);
            }
            let progressText = '未学习';
            if (progress === 100) progressText = '已学完';
            else if (progress > 0) progressText = `已学${progress}%`;
            return { ...ch, lastPlayTime, finished: finished === true, progress, progressText };
          }
          return ch;
        });
        this.setData({ favoriteChapters });
      },
      onClose: () => {
        this.setData({
          favoriteChapters: this.data.favoriteChapters.map(ch => ({ ...ch, isPlaying: false }))
        });
      },
      onStop: () => {
        this.setData({
          favoriteChapters: this.data.favoriteChapters.map(ch => ({ ...ch, isPlaying: false }))
        });
      }
    };
    app.registerMiniPlayer(this.audioCallback);
  },

  onUnload() {
    // 页面卸载时移除回调
    app.unregisterMiniPlayer(this.audioCallback);
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
    // 更新全局横幅时间戳和清除所有横幅缓存，刷新图片（封面不变）
    const newLoadTime = Date.now();
    app.globalData.bannerLoadTime = newLoadTime;
    app.globalData.indexHeadlines = [];
    app.globalData.loginHeadlines = [];
    app.globalData.favoriteHeadlines = [];
    app.globalData.mineHeadlines = [];
    this.setData({ refresherTriggered: true, loadTime: newLoadTime, headlines: [] });
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
          image: this.fixImageUrl(h.image, 'banner')
        }));
        // 缓存到全局变量
        app.globalData.favoriteHeadlines = headlines;
        this.setData({
          headlines: headlines,
          bannerSpeed: (res.result.speed || 5) * 1000
        });
      }
    })
    .catch(err => console.error('获取头条失败', err));
  },

  // 固定图片URL，使用picsum的seed格式保证稳定但刷新时变化
  // type: 'banner' 横幅图片, 'cover' 封面图片
  fixImageUrl(url, type = 'banner') {
    if (!url) return url;
    // 横幅用 bannerLoadTime，封面用 coverLoadTime
    const loadTime = type === 'banner' ? this.data.loadTime : this.data.coverLoadTime;

    // 检查URL是否已经包含时间戳格式的seed（如 123456_banner_xxx 或 123456_cover_xxx），说明已处理过
    if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_(banner|cover)_/)) {
      // 已处理过，但时间戳可能变化，需要替换新的时间戳
      const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_(banner|cover)_([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const oldTime = seedMatch[1];
        const urlType = seedMatch[2];
        const originalSeed = seedMatch[3];
        const size = seedMatch[4];
        // 只有类型匹配且时间戳变化时才替换
        if (urlType === type && oldTime != loadTime) {
          const newSeed = `${loadTime}_${type}_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }
        return url;
      }
    }

    // 处理 picsum.photos URL
    if (url.includes('picsum.photos')) {
      // 如果已经是seed格式（非时间戳格式），替换seed为时间戳+类型+原seed组合
      // 格式: https://picsum.photos/seed/course1/400/400
      const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
      if (seedMatch) {
        const originalSeed = seedMatch[1]; // 如 "course1"
        const size = seedMatch[2]; // 如 "400/400" 或 "400"
        const newSeed = `${loadTime}_${type}_${originalSeed}`;
        return `https://picsum.photos/seed/${newSeed}/${size}`;
      }

      // 提取尺寸信息，支持两种格式：
      // 格式1: https://picsum.photos/800/300?random=1
      // 格式2: https://picsum.photos/400?random=1
      const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
      const randomMatch = url.match(/random=(\d+)/);

      if (sizeMatch) {
        const size = sizeMatch[1]; // 如 "800/300" 或 "400"
        const originalRandom = randomMatch ? randomMatch[1] : '0';
        // 组合时间戳+类型+原始random作为种子
        const seed = `${loadTime}_${type}_${originalRandom}`;
        return `https://picsum.photos/seed/${seed}/${size}`;
      }
    }

    // 其他URL添加时间戳防缓存
    return this.addTimestamp(url, type);
  },

  // 添加时间戳到URL
  addTimestamp(url, type = 'banner') {
    if (!url) return url;
    const loadTime = type === 'banner' ? this.data.loadTime : this.data.coverLoadTime;
    return url.includes('?') ? `${url}&t=${loadTime}` : `${url}?t=${loadTime}`;
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
      courseCover: this.fixImageUrl(chapter.courseCover, 'cover'),
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
    const chapter = this.data.favoriteChapters[index];

    // 如果点击的是正在播放的章节，切换播放/暂停
    if (chapter.isPlaying) {
      const miniPlayer = this.selectComponent('#miniPlayer');
      if (miniPlayer) miniPlayer.togglePlayPause();
    } else {
      this.playFavoriteList(index);
    }
  },

  // 点击播放按钮
  onPlayTap(e) {
    const index = e.currentTarget.dataset.index;
    const chapter = this.data.favoriteChapters[index];

    // 如果点击的是正在播放的章节，切换播放/暂停
    if (chapter.isPlaying) {
      const miniPlayer = this.selectComponent('#miniPlayer');
      if (miniPlayer) miniPlayer.togglePlayPause();
    } else {
      this.playFavoriteList(index);
    }
  },

  // 播放收藏列表
  playFavoriteList(startIndex) {
    const favoriteChapters = this.data.favoriteChapters;
    if (favoriteChapters.length === 0) return;

    // 先保存当前播放进度（如果有正在播放的章节）
    const miniPlayer = this.selectComponent('#miniPlayer');
    if (miniPlayer && this.data.favoriteChapters.some(ch => ch.isPlaying)) {
      miniPlayer.saveProgress();
    }

    // 构建播放列表数据
    const playlistData = favoriteChapters.map(ch => ({
      _id: ch._id,
      title: ch.title,
      duration: ch.duration,
      durationText: ch.durationText || this.formatDuration(ch.duration), // 添加时长文本
      audioUrl: ch.audioUrl,
      seq: ch.seq,
      course: ch.course,
      courseTitle: ch.courseTitle,
      courseCover: ch.courseCover,
      author: ch.author,
      // 用户进度信息（formatChapter 已放到顶层）
      lastPlayTime: ch.lastPlayTime || 0,
      finished: ch.finished || false,
      progress: ch.progress || 0,
      progressText: ch.progressText || '未学习'
    }));

    // 更新当前播放章节的 isPlaying 状态
    const startChapterId = favoriteChapters[startIndex]._id;
    this.setData({
      favoriteChapters: favoriteChapters.map(ch => ({
        ...ch,
        isPlaying: ch._id === startChapterId
      }))
    });

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