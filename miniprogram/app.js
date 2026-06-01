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

  onShow() {
    // 切回前台时，不主动关闭音频，让音频继续播放
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
        // 下载失败时，使用内置兜底封面
        this.globalData.defaultCoverLocalPath = this.globalData.fallbackCover;
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
    wasInBackground: false, // 是否从后台切回（用于登录态恢复流程）
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
    homePageMaskedCourses: {}, // 首页伪装课程-武功映射
    bannerLoadTime: null, // 横幅加载时间戳，保持稳定
    coverLoadTime: null, // 封面加载时间戳，保持稳定
    defaultCoverUrl: null, // 默认封面URL
    defaultCoverLocalPath: null, // 默认封面本地路径（下载的）
    fallbackCover: '/images/default_cover.png', // 内置兜底封面
    favoriteHeadlines: [], // 收藏页横幅缓存
    mineHeadlines: [], // 我的页横幅缓存
    favoriteChapters: [], // 收藏章节缓存
    cachedAvatarFileID: null, // 头像云文件ID缓存
    cachedAvatarTempUrl: null, // 头像临时URL缓存
    cachedAvatarTime: 0 // 头像临时URL缓存时间戳
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

    // 系统播放面板上一曲/下一曲事件
    bgAudio.onNext(() => {
      this.playNext();
    });

    bgAudio.onPrev(() => {
      this.playPrev();
    });
  },

  // 音频播完处理
  onAudioEnded() {
    if (this._audioEndedProcessing) return;
    this._audioEndedProcessing = true;

    const chapters = this.globalData.playlistChaptersData;
    const playMode = this.globalData.playMode || 'sequence';
    const currentChapter = this.globalData.playingChapter;

    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      this._audioEndedProcessing = false;
      return;
    }

    const currentId = currentChapter?._id;
    if (!currentId || !chapters.length) {
      this.bgAudioManager.stop();
      this.notifyCallbacks('onLastChapterEnded', {});
      this._audioEndedProcessing = false;
      return;
    }

    const currentIndex = chapters.findIndex(ch => ch._id === currentId);
    if (currentIndex === -1) {
      this.bgAudioManager.stop();
      this.notifyCallbacks('onLastChapterEnded', {});
      this._audioEndedProcessing = false;
      return;
    }

    // 播放结束时，保存当前章节进度（强制完播）
    if (currentId) {
      this.saveProgress(currentId, currentChapter.course || this.globalData.playingCourse?._id, this.bgAudioManager.duration, true);
      // 更新playlistChaptersData中的章节状态（以便playPrev时能读到更新后的finished状态）
      const chapterIndex = chapters.findIndex(ch => ch._id === currentId);
      if (chapterIndex >= 0) {
        chapters[chapterIndex].finished = true;
        chapters[chapterIndex].lastPlayTime = 0;
      }
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < chapters.length) {
      this.playChapter(chapters[nextIndex]._id, chapters);
    } else if (playMode === 'loop') {
      this.playChapter(chapters[0]._id, chapters);
    } else {
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
    const currentChapter = this.globalData.playingChapter;

    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }

    const currentId = currentChapter?._id;
    if (!currentId) return;

    const currentIndex = chapters.findIndex(ch => ch._id === currentId);
    if (currentIndex === -1) return;

    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      this.playChapter(chapters[prevIndex]._id, chapters);
    } else if (playMode === 'loop') {
      this.playChapter(chapters[chapters.length - 1]._id, chapters);
    } else {
      wx.showToast({ title: '这是第一条', icon: 'none' });
    }
  },

  // 播放下一曲
  playNext() {
    const chapters = this.globalData.playlistChaptersData;
    const playMode = this.globalData.playMode || 'sequence';
    const currentChapter = this.globalData.playingChapter;

    if (playMode === 'single') {
      this.bgAudioManager.seek(0);
      this.bgAudioManager.play();
      return;
    }

    const currentId = currentChapter?._id;
    if (!currentId) return;

    const currentIndex = chapters.findIndex(ch => ch._id === currentId);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < chapters.length) {
      this.playChapter(chapters[nextIndex]._id, chapters);
    } else if (playMode === 'loop') {
      this.playChapter(chapters[0]._id, chapters);
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

    // 更新 playingCourse（收藏场景跨课程切换时需要）
    if (chapter.course) {
      this.globalData.playingCourse = {
        _id: chapter.course,
        title: chapter.courseTitle || '收藏列表',
        cover: chapter.courseCover || '',
        author: chapter.author || ''
      };
    }

    // 保存到缓存
    wx.setStorageSync('playingChapter', JSON.stringify(chapter));
    wx.setStorageSync('playingSeq', chapter.seq);
    wx.setStorageSync('playingIndex', index);
    wx.setStorageSync('playingCourse', JSON.stringify(this.globalData.playingCourse));

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
    // 只有lastPlayTime>=duration时才重置为0（避免异常情况）
    // 已完成章节：如果lastPlayTime>0说明是重播中暂停（可以续播），如果lastPlayTime=0才是从头播
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
    // 先更新播放状态，确保 onPlay 回调能读到正确的值
    this.globalData.playingStatus = true;

    bgAudio.title = chapter.title || '音频课程';
    bgAudio.epname = course.title || '';
    bgAudio.coverImgUrl = course.cover || '';
    bgAudio.startTime = startTime;
    // URL 需要编码，否则真机无法播放
    const [baseUrl, query] = src.split('?');
    bgAudio.src = query ? `${encodeURI(baseUrl)}?${query}` : encodeURI(src);
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
      this.globalData.playingStatus = true;
      bgAudio.play();
    } else {
      this.globalData.playingStatus = false;
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

// 退出登录（通用逻辑）
  logout() {
    this.resetPlayState();
    this.globalData.playlistSortOrder = 'asc';
    this.globalData.favoriteChapters = [];
    this.globalData.isLoggedIn = false;
    this.globalData.userInfo = null;
    this.globalData.userId = null;
    this.globalData.loginFlag = false;
    this.globalData.logoutFlag = true;
    this.globalData.needRestoreMaskedData = true;
    // 清空头像缓存
    this.globalData.cachedAvatarFileID = null;
    this.globalData.cachedAvatarTempUrl = null;
    this.globalData.cachedUserStats = null;
    wx.removeStorageSync('userId');
    wx.removeStorageSync('userInfo');
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
  },

  // ========== 公共工具方法 ==========

  // 处理图片URL（带时间戳的picsum稳定化）
  processImageUrl(url, type = 'cover', loadTime) {
    if (!url) return url;
    const t = loadTime || this.globalData.coverLoadTime || Date.now();

    // 固定图片不处理
    if (url.match(/picsum\.photos\/seed\/fixed_/) || url.includes('seed/fixed_')) {
      return url;
    }

    // 已带时间戳格式的seed，直接替换时间戳
    const timestampedMatch = url.match(/seed\/(\d+)_cover_([^\/]+)\/(\d+(\/\d+)?)/);
    if (timestampedMatch) {
      const oldTime = timestampedMatch[1];
      const seed = timestampedMatch[2];
      const size = timestampedMatch[3];
      if (oldTime != t) {
        return `https://picsum.photos/seed/${t}_cover_${seed}/${size}`;
      }
      return url;
    }

    // 标准picsum格式: seed/xxx/400/400
    const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
    if (seedMatch) {
      const seed = seedMatch[1];
      const size = seedMatch[2];
      return `https://picsum.photos/seed/${t}_cover_${seed}/${size}`;
    }

    // 旧格式: picsum.photos/400/400?random=1
    const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
    const randomMatch = url.match(/random=(\d+)/);
    if (sizeMatch) {
      const size = sizeMatch[1];
      const random = randomMatch ? randomMatch[1] : '0';
      return `https://picsum.photos/seed/${t}_cover_${random}/${size}`;
    }

    return url;
  },

  // 保存播放进度（云端）
  saveProgress(chapterId, courseId, lastPlayTime, finished, isFavoriteList = false) {
    if (!chapterId || !lastPlayTime || !this.globalData.userId) return Promise.resolve();

    // 同步更新playlistChaptersData中的章节状态
    const chapters = this.globalData.playlistChaptersData;
    const chapterIndex = chapters.findIndex(ch => ch._id === chapterId);
    if (chapterIndex >= 0) {
      chapters[chapterIndex].lastPlayTime = lastPlayTime;
      if (finished !== undefined) {
        chapters[chapterIndex].finished = finished === true;
      }
    }

    return wx.cloud.callFunction({
      name: 'courseFunctions',
      data: {
        type: 'updateChapterProgress',
        chapterId,
        courseId,
        lastPlayTime,
        finished,
        userId: this.globalData.userId
      }
    }).then((res) => {
      // 从收藏列表播放时更新该课程的总进度
      if (isFavoriteList && courseId) {
        this._updateCourseProgressCache(courseId);
      }
      this.notifyCallbacks('onProgressUpdate', { chapterId, lastPlayTime, finished });
    }).catch(err => console.error('保存进度失败:', err));
  },

  // 更新课程进度缓存（收藏列表播放后调用）
  _updateCourseProgressCache(courseId) {
    // 清除首页课程缓存，下次onShow会重新加载
    this.globalData.homePageCourses = [];
  }
});