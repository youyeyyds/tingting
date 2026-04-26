// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: "cloud1-2g5y53suf638dfb9",
        traceUser: true
      });
    }

    // 初始化背景音频管理器
    this.bgAudioManager = wx.getBackgroundAudioManager();
    this.miniPlayerCallbacks = [];
    this.setupAudioEvents();

    // 初始化图片加载时间戳（从缓存读取，保持稳定）
    const cachedBannerTime = wx.getStorageSync('bannerLoadTime');
    const cachedCoverTime = wx.getStorageSync('coverLoadTime');
    this.globalData.bannerLoadTime = cachedBannerTime || Date.now();
    this.globalData.coverLoadTime = cachedCoverTime || Date.now();
    if (!cachedBannerTime) wx.setStorageSync('bannerLoadTime', this.globalData.bannerLoadTime);
    if (!cachedCoverTime) wx.setStorageSync('coverLoadTime', this.globalData.coverLoadTime);

    // 尝试恢复登录状态
    this.restoreLoginState();

    // 尝试恢复播放状态
    this.restorePlayState();

    // 加载默认封面
    this.loadDefaultCover();
  },

  // 加载默认封面
  loadDefaultCover() {
    // 优先从本地缓存读取
    const cachedCover = wx.getStorageSync('defaultCoverLocalPath');
    if (cachedCover) {
      this.globalData.defaultCoverLocalPath = cachedCover;
    }

    wx.cloud.callFunction({
      name: 'courseFunctions',
      data: { type: 'getDefaultCover' }
    }).then(res => {
      if (res.result.success && res.result.data.coverUrl) {
        const coverUrl = res.result.data.coverUrl;
        this.globalData.defaultCoverUrl = coverUrl;
        // 下载到本地作为缓存
        this.downloadDefaultCover(coverUrl);
      }
    }).catch(err => {
      console.error('加载默认封面失败:', err);
    });
  },

  // 下载默认封面到本地
  downloadDefaultCover(url) {
    if (!url) return;
    wx.downloadFile({
      url: url,
      success: (res) => {
        if (res.statusCode === 200) {
          this.globalData.defaultCoverLocalPath = res.tempFilePath;
          wx.setStorageSync('defaultCoverLocalPath', res.tempFilePath);
        }
      },
      fail: (err) => {
        console.error('下载默认封面失败:', err);
      }
    });
  },

  restorePlayState() {
    // 从缓存恢复播放状态（只要有缓存数据就恢复）
    const playingCourseStr = wx.getStorageSync('playingCourse');
    const playingChapterStr = wx.getStorageSync('playingChapter');
    const playingIndex = wx.getStorageSync('playingIndex');
    const playlistSortOrder = wx.getStorageSync('playlistSortOrder');
    const playMode = wx.getStorageSync('playMode');

    if (playingCourseStr && playingChapterStr) {
      try {
        this.globalData.playingCourse = JSON.parse(playingCourseStr);
        this.globalData.playingChapter = JSON.parse(playingChapterStr);
        this.globalData.playingIndex = playingIndex || 0;
        this.globalData.playlistSortOrder = playlistSortOrder || 'asc';
        this.globalData.playMode = playMode || 'sequence';
        this.globalData.miniPlayerActive = true;
      } catch (e) {
        console.error('恢复播放状态失败:', e);
      }
    }
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    userId: null,
    playingCourse: null,
    playingChapter: null,
    playingIndex: 0,
    miniPlayerActive: false,
    miniPlayerIndexFadedIn: false,
    playMode: 'sequence', // 'sequence' | 'loop' | 'single'
    playlistChaptersData: [], // 完整的播放列表数据
    playlistSortOrder: 'asc', // 'asc' | 'desc'
    loginPageLoadTime: null, // 登录页图片加载时间戳，保持稳定
    homePageLoadTime: null, // 首页图片加载时间戳，保持稳定
    homePageMaskedAuthors: null, // 首页伪装课程映射（已废弃，保留字段兼容）
    homePageMaskedCourses: {}, // 首页伪装课程-武功映射
    bannerLoadTime: null, // 横幅加载时间戳，保持稳定
    coverLoadTime: null, // 封面加载时间戳，保持稳定
    defaultCoverUrl: null, // 默认封面URL
    indexHeadlines: [], // 首页横幅缓存
    loginHeadlines: [], // 登录页横幅缓存
    favoriteHeadlines: [], // 收藏页横幅缓存
    mineHeadlines: [], // 我的页横幅缓存
    favoriteChapters: [], // 收藏章节缓存
    cachedAvatarFileID: null, // 头像云文件ID缓存
    cachedAvatarTempUrl: null // 头像临时URL缓存
  },

  restoreLoginState() {
    const userId = wx.getStorageSync('userId');
    const userInfoStr = wx.getStorageSync('userInfo');
    if (userId && userInfoStr) {
      try {
        const userInfo = JSON.parse(userInfoStr);
        this.globalData.isLoggedIn = true;
        this.globalData.userId = userId;
        this.globalData.userInfo = userInfo;
      } catch (e) {
        console.error('恢复登录状态失败:', e);
      }
    }
  },

  // 设置背景音频事件
  setupAudioEvents() {
    const bgAudio = this.bgAudioManager;

    bgAudio.onCanplay(() => {
      bgAudio.playbackRate = 2;
      const duration = bgAudio.duration;
      this.notifyCallbacks('onCanplay', {
        duration: duration || 0
      });
    });

    bgAudio.onPlay(() => {
      this.notifyCallbacks('onPlay', {});
    });

    bgAudio.onPause(() => {
      this.notifyCallbacks('onPause', {});
    });

    bgAudio.onTimeUpdate(() => {
      const currentTime = bgAudio.currentTime;
      const duration = bgAudio.duration;
      const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
      this.notifyCallbacks('onTimeUpdate', {
        currentTime: currentTime,
        progressPercent: percent
      });
    });

    bgAudio.onEnded(() => {
      this.notifyCallbacks('onEnded', {});
    });

    bgAudio.onError((err) => {
      console.error('播放错误:', err);
      this.notifyCallbacks('onError', {});
    });

    bgAudio.onStop(() => {
      this.notifyCallbacks('onStop', {});
    });
  },

  // 通知所有 mini-player 回调
  notifyCallbacks(event, data) {
    this.miniPlayerCallbacks.forEach(cb => {
      if (cb[event]) cb[event](data);
    });
  },

  // 注册 mini-player 回调
  registerMiniPlayer(callback) {
    this.miniPlayerCallbacks.push(callback);
  },

  // 移除 mini-player 回调
  unregisterMiniPlayer(callback) {
    const index = this.miniPlayerCallbacks.indexOf(callback);
    if (index > -1) this.miniPlayerCallbacks.splice(index, 1);
  }
});