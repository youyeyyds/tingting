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
    const playingSeq = wx.getStorageSync('playingSeq');
    const playlistSortOrder = wx.getStorageSync('playlistSortOrder');
    const playMode = wx.getStorageSync('playMode');

    if (playingCourseStr && playingChapterStr) {
      try {
        this.globalData.playingCourse = JSON.parse(playingCourseStr);
        this.globalData.playingChapter = JSON.parse(playingChapterStr);
        this.globalData.playingSeq = playingSeq || null;
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
    playingSeq: null, // 当前播放章节的seq，用于跨页面同步
    playingStatus: false, // 统一播放状态：true=正在播放，false=暂停
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
      this.onAudioEnded();
    });

    bgAudio.onError((err) => {
      console.error('播放错误:', err);
      this.notifyCallbacks('onError', {});
    });

    bgAudio.onStop(() => {
      this.notifyCallbacks('onStop', {});
    });
  },

  // 音频播完处理
  onAudioEnded() {
    if (this._audioEndedProcessing) return;
    this._audioEndedProcessing = true;

    const chapters = this.globalData.playlistChaptersData;
    const playMode = this.globalData.playMode || 'sequence';
    const sortOrder = this.globalData.playlistSortOrder || 'asc';
    const currentChapter = this.globalData.playingChapter;

    if (playMode === 'single') {
      // 单曲循环模式：从头播放
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      this._audioEndedProcessing = false;
      return;
    }

    const currentSeq = currentChapter?.seq;
    if ((currentSeq === undefined || currentSeq === null) || !chapters.length) {
      this.bgAudioManager.stop();
      this.notifyCallbacks('onLastChapterEnded', {});
      this._audioEndedProcessing = false;
      return;
    }

    // 根据排序方向计算下一条的 seq
    const targetSeq = sortOrder === 'asc' ? currentSeq + 1 : currentSeq - 1;
    const nextChapter = chapters.find(ch => ch.seq === targetSeq);

    if (nextChapter) {
      this.playChapter(nextChapter._id, chapters);
    } else if (playMode === 'loop') {
      // 循环模式：回到第一/最后一条
      const firstOrLast = sortOrder === 'asc' ? chapters[0] : chapters[chapters.length - 1];
      this.playChapter(firstOrLast._id, chapters);
    } else {
      // 顺序播放到最后一条，停止播放并重置状态
      wx.showToast({ title: '已经是最后一条', icon: 'none' });
      this.bgAudioManager.stop();
      this.notifyCallbacks('onLastChapterEnded', {});
    }
    this._audioEndedProcessing = false;
  },

  // 播放上一曲
  playPrev() {
    const chapters = this.globalData.playlistChaptersData;
    const playMode = this.globalData.playMode || 'sequence';
    const sortOrder = this.globalData.playlistSortOrder || 'asc';
    const currentChapter = this.globalData.playingChapter;

    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }

    const currentSeq = currentChapter?.seq;
    if (currentSeq === undefined || currentSeq === null) return;

    // 根据排序方向计算上一条的 seq
    const targetSeq = sortOrder === 'asc' ? currentSeq - 1 : currentSeq + 1;
    const prevChapter = chapters.find(ch => ch.seq === targetSeq);

    if (prevChapter) {
      this.playChapter(prevChapter._id, chapters);
    } else if (playMode === 'loop') {
      // 循环模式：回到最后/第一条
      const lastOrFirst = sortOrder === 'asc' ? chapters[chapters.length - 1] : chapters[0];
      this.playChapter(lastOrFirst._id, chapters);
    } else {
      wx.showToast({ title: '这是第一条', icon: 'none' });
    }
  },

  // 播放下一曲
  playNext() {
    const chapters = this.globalData.playlistChaptersData;
    const playMode = this.globalData.playMode || 'sequence';
    const sortOrder = this.globalData.playlistSortOrder || 'asc';
    const currentChapter = this.globalData.playingChapter;

    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }

    const currentSeq = currentChapter?.seq;
    if (currentSeq === undefined || currentSeq === null) return;

    // 根据排序方向计算下一条的 seq
    const targetSeq = sortOrder === 'asc' ? currentSeq + 1 : currentSeq - 1;
    const nextChapter = chapters.find(ch => ch.seq === targetSeq);

    if (nextChapter) {
      this.playChapter(nextChapter._id, chapters);
    } else if (playMode === 'loop') {
      // 循环模式：回到第一/最后一条
      const firstOrLast = sortOrder === 'asc' ? chapters[0] : chapters[chapters.length - 1];
      this.playChapter(firstOrLast._id, chapters);
    } else {
      wx.showToast({ title: '已经是最后一条', icon: 'none' });
    }
  },

  // 播放指定章节
  playChapter(chapterId, chapters) {
    chapters = chapters || this.globalData.playlistChaptersData;
    const chapter = chapters.find(ch => ch._id === chapterId);
    if (!chapter || !chapter.audioUrl) {
      wx.showToast({ title: '暂无音频', icon: 'none' });
      return;
    }

    const index = chapters.findIndex(ch => ch._id === chapterId);
    this.globalData.playingChapter = chapter;
    this.globalData.playingSeq = chapter.seq;
    this.globalData.playingIndex = index;

    // 保存到缓存
    wx.setStorageSync('playingChapter', JSON.stringify(chapter));
    wx.setStorageSync('playingSeq', chapter.seq);
    wx.setStorageSync('playingIndex', index);

    // 通知所有组件章节变化
    this.notifyCallbacks('onChapterChange', {
      chapterId: chapter._id,
      chapter: chapter,
      index: index,
      isPlaying: true
    });

    // 加载并播放音频
    this.loadAudio(chapter);
  },

  // 加载音频
  loadAudio(chapter) {
    const bgAudio = this.bgAudioManager;
    const src = chapter?.audioUrl;
    if (!src) return;

    // 如果音频已结束或播放时间异常，重置为上次保存的播放位置
    const lastPlayTime = Number(chapter.lastPlayTime) || 0;
    const duration = Number(chapter.duration) || 0;
    let startTime = lastPlayTime;
    if (lastPlayTime >= duration && duration > 0) {
      startTime = 0;
    }

    if (src.startsWith('cloud://')) {
      wx.showLoading({ title: '加载中...', mask: true });
      wx.cloud.getTempFileURL({ fileList: [src] }).then(res => {
        wx.hideLoading();
        const tempUrl = res.fileList?.[0]?.tempFileURL;
        if (!tempUrl) throw new Error('获取链接失败');
        this.playAudio(chapter, tempUrl, startTime);
      }).catch(err => {
        wx.hideLoading();
        wx.showToast({ title: '音频加载失败', icon: 'none' });
      });
    } else {
      this.playAudio(chapter, src, startTime);
    }
  },

  // 实际播放音频
  playAudio(chapter, src, startTime) {
    const bgAudio = this.bgAudioManager;
    const course = this.globalData.playingCourse || {};

    bgAudio.title = chapter.title || '音频课程';
    bgAudio.epname = course.title || '';
    bgAudio.coverImgUrl = course.cover || '';
    bgAudio.startTime = startTime;
    // URL 需要编码，否则真机无法播放
    const [baseUrl, query] = src.split('?');
    bgAudio.src = query ? `${encodeURI(baseUrl)}?${query}` : encodeURI(src);
    // 立即更新播放状态
    this.globalData.playingStatus = true;
    this.notifyCallbacks('onPlay', {});
  },

  // 切换播放/暂停
  togglePlayPause() {
    const bgAudio = this.bgAudioManager;
    if (bgAudio.paused) {
      // 如果音频已结束（currentTime >= duration-1）或 duration 异常（0 或 NaN），重新加载当前章节
      const duration = bgAudio.duration || 0;
      if (bgAudio.currentTime >= duration - 1 || duration === 0) {
        const chapter = this.globalData.playingChapter;
        const chapters = this.globalData.playlistChaptersData;
        if (chapter && chapters.length) {
          this.playChapter(chapter._id, chapters);
          return;
        }
      }
      // 先更新状态再播放
      this.globalData.playingStatus = true;
      this.notifyCallbacks('onPlay', { isPlaying: true });
      bgAudio.play();
    } else {
      // 先更新状态再暂停
      this.globalData.playingStatus = false;
      this.notifyCallbacks('onPause', { isPlaying: false });
      bgAudio.pause();
    }
  },

  // 停止播放
  stop() {
    this.globalData.playingStatus = false;
    this.bgAudioManager.stop();
    this.notifyCallbacks('onStop', {});
  },

  // 切换播放模式
  togglePlayMode() {
    const modes = ['sequence', 'loop', 'single'];
    const currentMode = this.globalData.playMode || 'sequence';
    const currentIdx = modes.indexOf(currentMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    this.globalData.playMode = nextMode;
    this.notifyCallbacks('onPlayModeChange', { playMode: nextMode });
    return nextMode;
  },

  // 重置播放状态（退出登录时使用）
  resetPlayState() {
    this.bgAudioManager.stop();
    this.globalData.miniPlayerActive = false;
    this.globalData.miniPlayerIndexFadedIn = false;
    this.globalData.playingCourse = null;
    this.globalData.playingChapter = null;
    this.globalData.playingSeq = null;
    this.globalData.playingIndex = 0;
    this.globalData.playlistChaptersData = [];
    this.globalData.playMode = 'sequence';
    this.globalData.playingStatus = false;
    this.notifyCallbacks('onReset', {});
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