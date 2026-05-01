// mini-player/index.js
const app = getApp();

Component({
  properties: {
    initialChapters: { type: Array, value: [] },
    initialCourse: { type: Object, value: {} }
  },

  data: {
    visible: false,
    fadeInClass: '',
    playerBottom: 15,
    currentChapter: {},
    currentIndex: 0,
    courseCover: '',
    courseName: '',
    course: {},
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    playbackRate: 2,
    chapters: [],
    playlistSortOrder: 'asc',
    isFavoriteList: false
  },

  lifetimes: {
    created() {
      this.bgAudioManager = app.bgAudioManager;
      this.speedOptions = [0.75, 1, 1.25, 1.5, 2];
      this.audioCallback = {
        onChapterChange: ({ chapterId, chapter, index }) => {
          // 当外部（player页面）改变播放章节时，同步更新mini-player的currentChapter
          if (chapterId) {
            // 优先使用传入的chapter和index，否则在本地chapters中查找
            const foundChapter = chapter || this.data.chapters.find(ch => ch._id === chapterId);
            const foundIndex = index >= 0 ? index : this.data.chapters.findIndex(ch => ch._id === chapterId);
            if (foundChapter && foundIndex >= 0) {
              this.setData({ currentChapter: foundChapter, currentIndex: foundIndex });
            }
          }
        },
        onPlay: () => {
          // 清除章节同步标志，允许 onTimeUpdate 更新进度
          this._syncingChapter = false;
          this.setData({ isPlaying: true });
          // 通知播放状态变化，更新 chapter 页面的按钮样式
          const { currentChapter, currentIndex } = this.data;
          if (currentChapter._id) {
            app.notifyCallbacks('onPlayPause', { chapterId: currentChapter._id, isPlaying: true });
          }
        },
        onPause: () => {
          // 暂停时保存当前播放进度
          if (this.data.currentChapter._id) {
            this.saveProgress();
          }
          // 只有音频真正暂停时才更新状态和通知
          if (this.bgAudioManager.paused) {
            this.setData({ isPlaying: false });
            const { currentChapter } = this.data;
            if (currentChapter._id) {
              app.notifyCallbacks('onPlayPause', { chapterId: currentChapter._id, isPlaying: false });
            }
          }
        },
        onPlayPause: ({ isPlaying }) => {
          // 外部（如play-btn）触发的播放/暂停同步
          console.log('[mini-player] onPlayPause, isPlaying:', isPlaying);
          this.setData({ isPlaying });
        },
        onEnded: () => {}, // app.js统一处理
        onLastChapterEnded: () => {
          this.setData({ isPlaying: false, currentTime: 0, duration: 0, progressPercent: 0 });
        },
        onError: () => {
          this.setData({ isPlaying: false });
        },
        onStop: () => {
          this.setData({ isPlaying: false });
        },
        onReset: () => {
          // 退出登录时重置播放状态，关闭 mini-player（保留淡出效果）
          this.setData({ fadeInClass: 'fade-out' });
          setTimeout(() => {
            this.setData({
              visible: false,
              fadeInClass: '',
              chapters: [],
              currentChapter: {},
              currentIndex: 0,
              course: {},
              isPlaying: false,
              currentTime: 0,
              duration: 0,
              progressPercent: 0
            });
          }, 300);
        },
        onPlayFromList: (data) => this.playFromList(data),
        onClose: () => {
          // 关闭通知已由 methods.onClose() 处理，这里只记录状态变化
        },
        onCoverRefresh: (data) => {
          if (data.coverLoadTime) {
            // 无论播放器是否显示，都记录新时间戳，下次显示时会同步
            const newCover = this.rebuildImageUrl(this.data.courseCover, data.coverLoadTime);
            this.setData({
              courseCover: newCover,
              coverLoadTime: data.coverLoadTime,
              course: { ...this.data.course, cover: newCover }
            });
            // 如果播放器正在显示，立即更新
            if (this.data.visible) {
              this.setData({ courseCover: newCover });
            }
          }
        }
      };
      // onCanplay 回调
      this._onCanplay = () => {
        // 设置默认2倍速，只更新 duration，不更新 currentTime（此时 currentTime 可能是0）
        // 等待 onPlay 时 currentTime 才会正确
        this.bgAudioManager.playbackRate = 2;
        const duration = this.bgAudioManager.duration || 0;
        this.setData({ duration, playbackRate: 2 });
      };
    },
    attached() {
      // 添加实例ID用于调试
      this._instanceId = Date.now() + '_' + Math.random();
      // 保留其他事件的回调
      app.registerMiniPlayer(this.audioCallback);
      // 注册直接监听器
      this._setupAudioListeners();
    },
    detached() {
      // 注销直接监听
      if (this._onTimeUpdate && this.bgAudioManager.offTimeUpdate) {
        this.bgAudioManager.offTimeUpdate(this._onTimeUpdate);
      }
      if (this._onCanplay && this.bgAudioManager.offCanplay) {
        this.bgAudioManager.offCanplay(this._onCanplay);
      }
      app.unregisterMiniPlayer(this.audioCallback);
    }
  },

  pageLifetimes: {
    show() {
      const pages = getCurrentPages();
      this.currentPageRoute = pages[pages.length - 1]?.route || '';
      const isTabBarPage = ['pages/index/index', 'pages/favorite/index', 'pages/mine/index'].includes(this.currentPageRoute);

      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '' });
        return;
      }

      this.showMiniPlayer(isTabBarPage);
      this._setupAudioListeners();
    },
  },

  methods: {
    _setupAudioListeners() {
      // onTimeUpdate 回调
      if (!this._onTimeUpdate) {
        this._onTimeUpdate = () => {
          // 如果正在同步章节，保持当前设置的进度，不受 bgAudioManager.currentTime 变化影响
          if (this._syncingChapter) return;
          const currentTime = this.bgAudioManager.currentTime || 0;
          const duration = this.bgAudioManager.duration || 0;
          const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
          this.setData({ currentTime, duration, progressPercent });
        };
      }
      if (this.bgAudioManager.offTimeUpdate) {
        this.bgAudioManager.offTimeUpdate(this._onTimeUpdate);
      }
      this.bgAudioManager.onTimeUpdate(this._onTimeUpdate);

      // onCanplay 回调
      if (this._onCanplay) {
        if (this.bgAudioManager.offCanplay) {
          this.bgAudioManager.offCanplay(this._onCanplay);
        }
        this.bgAudioManager.onCanplay(this._onCanplay);
      }
    },

    showMiniPlayer(isTabBarPage) {
      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '' });
        return;
      }

      const { playingCourse, playingChapter, playingSeq, playlistChaptersData, playlistSortOrder, isFavoriteList } = app.globalData;
      let playbackRate = this.bgAudioManager.playbackRate || 2;
      if (!this.speedOptions.includes(playbackRate)) {
        playbackRate = 2;
      }

      // 重新计算课程封面，确保使用最新的 coverLoadTime
      let courseCover = this.data.courseCover;
      if (playingCourse?.cover) {
        if (!app.globalData.coverLoadTime) {
          app.globalData.coverLoadTime = Date.now();
        }
        courseCover = this.fixImageUrl(playingCourse.cover, app.globalData.coverLoadTime);
      } else if (app.globalData.defaultCoverUrl) {
        courseCover = app.globalData.defaultCoverUrl;
      }

      // 通过 playingSeq 找到 currentChapter 和 index
      const chapters = playlistChaptersData || [];
      const currentChapter = playingChapter || chapters.find(ch => ch.seq === playingSeq) || {};
      const currentIndex = chapters.findIndex(ch => ch._id === currentChapter._id);

      const currentTime = this.bgAudioManager.currentTime || 0;
      const duration = this.bgAudioManager.duration || 0;
      const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

      const data = {
        playerBottom: this.calcPosition(),
        isPlaying: !this.bgAudioManager.paused,
        currentChapter: currentChapter,
        currentIndex: currentIndex >= 0 ? currentIndex : 0,
        courseCover: courseCover,
        courseName: playingCourse?.title || '',
        chapters: playlistChaptersData || [],
        course: { ...playingCourse, cover: courseCover } || {},
        playlistSortOrder: playlistSortOrder || 'asc',
        isFavoriteList: isFavoriteList || false,
        currentTime: currentTime,
        duration: duration,
        progressPercent: progressPercent,
        playbackRate: playbackRate
      };

      if (isTabBarPage && !app.globalData.miniPlayerIndexFadedIn) {
        this.setData({ visible: true, fadeInClass: 'fade-in', ...data });
        app.globalData.miniPlayerIndexFadedIn = true;
      } else {
        this.setData({ visible: true, fadeInClass: '', ...data });
      }
    },

    calcPosition() {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route || '';
      const tabBarPages = ['pages/index/index', 'pages/favorite/index', 'pages/mine/index'];

      if (!tabBarPages.includes(route)) return 15;

      const windowInfo = wx.getWindowInfo();
      const tabBarHeight = 100 * (windowInfo.windowWidth / 750);
      const safeArea = windowInfo.screenHeight - (windowInfo.safeArea?.bottom || windowInfo.screenHeight);
      return 8 + tabBarHeight + safeArea;
    },

    savePlayStateCache(course, chapter, sortOrder, playMode) {
      wx.setStorageSync('playingCourse', JSON.stringify(course));
      wx.setStorageSync('playingChapter', JSON.stringify(chapter));
      wx.setStorageSync('playingSeq', chapter?.seq);
      wx.setStorageSync('playlistSortOrder', sortOrder);
      wx.setStorageSync('playMode', playMode);
    },

    clearPlayStateCache() {
      wx.removeStorageSync('playingCourse');
      wx.removeStorageSync('playingChapter');
      wx.removeStorageSync('playingSeq');
      wx.removeStorageSync('playlistSortOrder');
      wx.removeStorageSync('playMode');
    },

    updateChapterCache(chapter) {
      wx.setStorageSync('playingChapter', JSON.stringify(chapter));
      wx.setStorageSync('playingSeq', chapter?.seq);
    },

    playFromList(data) {
      const { index, chapters } = data;
      if (!chapters || chapters.length === 0 || index < 0) return;

      // 保存当前播放进度（使用 bgAudioManager 状态判断）
      if (this.data.currentChapter._id && this.bgAudioManager.currentTime > 0) {
        this.saveProgress();
      }

      const chapter = chapters[index];
      if (!chapter?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const coverLoadTime = app.globalData.coverLoadTime;

      const courseCover = this.fixImageUrl(chapter.courseCover || '', coverLoadTime);

      const course = {
        _id: chapter.course,
        title: chapter.courseTitle || '收藏列表',
        cover: courseCover,
        author: chapter.author || '',
        chapterCount: chapters.length
      };

      this.setData({
        chapters: chapters,
        course: course,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: chapter.courseTitle || '收藏列表',
        playlistSortOrder: 'asc',
        isFavoriteList: true,
        coverLoadTime: coverLoadTime
      });

      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingSeq = chapter.seq;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters;
      app.globalData.playlistSortOrder = 'asc';
      app.globalData.playMode = 'sequence';
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = true;

      this.savePlayStateCache(course, chapter, 'asc', 'sequence');

      // 使用app的playChapter
      app.playChapter(chapter._id, chapters);

      // 设置 mini-player 显示，isPlaying 保持现状由 onPlay/onPause 回调更新
      this.setData({
        visible: true,
        fadeInClass: 'fade-in',
        playerBottom: this.calcPosition()
      });
    },

    play(chapterId, playlistChapters, courseData, sortOrder) {
      // 使用 bgAudioManager 状态判断是否需要保存进度（比 this.data.isPlaying 更可靠）
      if (this.data.currentChapter._id && this.bgAudioManager.currentTime > 0) {
        this.saveProgress();
      }

      let chapters = playlistChapters || this.properties.initialChapters;
      let course = courseData || this.properties.initialCourse;

      const index = chapters.findIndex(ch => ch._id === chapterId);

      if (index === -1 || !chapters[index]?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      const chapter = chapters[index];

      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const coverLoadTime = app.globalData.coverLoadTime;

      const courseCover = this.fixImageUrl(course.cover || '', coverLoadTime);
      course.cover = courseCover;

      const currentCourseId = app.globalData.playingCourse && app.globalData.playingCourse._id;
      const isNewPlaylist = !app.globalData.miniPlayerActive || currentCourseId !== course._id;
      // 每次点击章节卡片开始播放时，都继承章节列表当前的排序
      // 排序改变后，只有再次点击章节卡片开始播放时才会继承新的排序
      const order = sortOrder || app.globalData.playlistSortOrder || 'asc';

      // filteredChapters 已经是章节列表排序后的数组，直接使用即可
      const globalChapters = chapters;

      this.setData({
        chapters: chapters,
        course: course,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: course.title || '',
        playlistSortOrder: order,
        isFavoriteList: false,
        coverLoadTime: coverLoadTime
      });

      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingSeq = chapter.seq;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = globalChapters;
      // 每次点击章节卡片都更新排序状态
      app.globalData.playlistSortOrder = order;
      if (isNewPlaylist) {
        app.globalData.playMode = 'sequence';
      }
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = false;

      this.savePlayStateCache(course, chapter, order, 'sequence');

      // 使用app的playChapter
      app.playChapter(chapter._id, chapters);

      // 设置 mini-player 显示，isPlaying 保持现状由 onPlay/onPause 回调更新
      this.setData({
        visible: true,
        fadeInClass: 'fade-in',
        playerBottom: this.calcPosition()
      });
    },

    onPlayPause() {
      // 防止快速点击导致状态混乱
      if (this._playPauseLock) return;
      this._playPauseLock = true;
      setTimeout(() => { this._playPauseLock = false; }, 300);

      // 基于当前状态乐观地设置，回调会最终确认
      const willPlay = this.bgAudioManager.paused;
      app.togglePlayPause();
      this.setData({ isPlaying: willPlay });
      // 通知所有组件（包括play-btn）播放状态变化
      app.notifyCallbacks('onPlayPause', { isPlaying: willPlay });
    },

    togglePlayPause() {
      this.onPlayPause();
    },

    onSpeedChange() {
      const { playbackRate } = this.data;
      // 只有1x和2x，切换逻辑：<2时直接切到2，=2时切到1
      const nextRate = playbackRate >= 2 ? 1 : 2;
      this.setData({ playbackRate: nextRate });
      this.bgAudioManager.playbackRate = nextRate;
    },

    onClose() {
      // 保存当前章节ID用于回调
      const lastChapterId = this.data.currentChapter?._id || app.globalData.playingChapter?._id;
      // 先触发淡出动画
      this.setData({ fadeInClass: 'fade-out' });
      // 等待动画完成后重置状态
      setTimeout(() => {
        // 先保存进度，等待完成后停止播放
        this.saveProgress().then(() => {
          app.stop();
          this.setData({
            visible: false,
            fadeInClass: '',
            chapters: [],
            currentChapter: {},
            currentIndex: 0,
            course: {},
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            progressPercent: 0
          });
          app.globalData.miniPlayerActive = false;
          app.globalData.miniPlayerIndexFadedIn = false;
          app.globalData.playingCourse = null;
          app.globalData.playingChapter = null;
          app.globalData.playingSeq = null;
          app.globalData.playingIndex = 0;
          app.globalData.playlistChaptersData = [];
          app.globalData.isFavoriteList = false;
          this.clearPlayStateCache();
          app.notifyCallbacks('onClose', { chapterId: lastChapterId });
        });
      }, 300);
    },

    saveProgress() {
      const chapterId = this.data.currentChapter._id;
      if (!chapterId || !this.bgAudioManager.currentTime) return Promise.resolve();
      const lastPlayTime = this.bgAudioManager.currentTime;
      const finished = lastPlayTime >= this.bgAudioManager.duration - 10;
      return wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'updateChapterProgress',
          chapterId: chapterId,
          courseId: this.data.currentChapter.course || this.data.course._id,
          lastPlayTime,
          finished,
          userId: app.globalData.userId
        }
      }).then(() => {
        // 通知其他组件（chapter页面）进度已更新
        app.notifyCallbacks('onProgressUpdate', { chapterId, lastPlayTime, finished });
      }).catch(err => console.error('保存进度失败:', err));
    },

    updateProgress(time, finished) {
      const chapterId = this.data.currentChapter._id;
      if (!chapterId || !app.globalData.userId) return;
      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'updateChapterProgress',
          chapterId: chapterId,
          courseId: this.data.currentChapter.course || this.data.course._id,
          lastPlayTime: time,
          finished: finished,
          userId: app.globalData.userId
        }
      }).then(() => {
        app.notifyCallbacks('onProgressUpdate', { chapterId, lastPlayTime: time, finished });
      }).catch(err => console.error('更新进度失败:', err));
    },

    fixImageUrl(url, coverLoadTime) {
      if (!url) return url;

      if (url.match(/picsum\.photos\/seed\/fixed_/)) return url;
      if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_cover_/)) return url;

      const loadTime = coverLoadTime || app.globalData.coverLoadTime || Date.now();

      if (url.includes('picsum.photos')) {
        const seedMatch = url.match(/picsum\.photos\/seed\/([^\/]+)\/(\d+(\/\d+)?)/);
        if (seedMatch) {
          const originalSeed = seedMatch[1];
          const size = seedMatch[2];
          const newSeed = `${loadTime}_cover_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }

        const sizeMatch = url.match(/picsum\.photos\/(\d+(\/\d+)?)/);
        const randomMatch = url.match(/random=(\d+)/);

        if (sizeMatch) {
          const size = sizeMatch[1];
          const originalRandom = randomMatch ? randomMatch[1] : '0';
          const seed = `${loadTime}_cover_${originalRandom}`;
          return `https://picsum.photos/seed/${seed}/${size}`;
        }
      }

      return url;
    },

    rebuildImageUrl(url, newLoadTime) {
      if (!url) return url;

      if (url.includes('picsum.photos/seed/') && url.match(/seed\/\d+_cover_/)) {
        const seedMatch = url.match(/picsum\.photos\/seed\/(\d+)_cover_([^\/]+)\/(\d+(\/\d+)?)/);
        if (seedMatch) {
          const originalSeed = seedMatch[2];
          const size = seedMatch[3];
          const newSeed = `${newLoadTime}_cover_${originalSeed}`;
          return `https://picsum.photos/seed/${newSeed}/${size}`;
        }
      }

      return this.fixImageUrl(url, newLoadTime);
    },

    preventMove() {},

    // 封面图片加载失败时使用默认封面
    onCoverError() {
      // 优先使用本地缓存的默认封面，其次使用云端配置的，最后使用耳机图标
      const localCover = app.globalData.defaultCoverLocalPath;
      const cloudCover = app.globalData.defaultCoverUrl;
      const defaultCover = localCover || cloudCover || '/icons/svg/headphones.svg';
      if (this.data.courseCover !== defaultCover) {
        this.setData({ courseCover: defaultCover });
      }
    },

    openPlayerPanel() {
      wx.navigateTo({
        url: '/pages/player/index'
      });
    },

    onPlaylistTap() {
      const playlistPanel = this.selectComponent('#playlistPanel');
      if (playlistPanel) playlistPanel.show();
    },

    onPlaylistCollapse() {},

    onPlaylistClear() {
      const lastChapterId = this.data.currentChapter?._id;
      // 保存当前播放进度
      if (this.data.currentChapter._id) {
        this.saveProgress();
      }
      app.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingSeq = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      app.globalData.isFavoriteList = false;
      this.clearPlayStateCache();
      this.setData({ visible: false, isPlaying: false, chapters: [], isFavoriteList: false });
      app.notifyCallbacks('onStop', { chapterId: lastChapterId });
    },

    onPlaylistSyncSort(e) {
      const sortedChapters = e.detail.chapters;
      const currentId = this.data.currentChapter._id;
      const newIndex = sortedChapters.findIndex(ch => ch._id === currentId);
      const currentChapter = sortedChapters[newIndex];
      this.setData({ chapters: sortedChapters, currentIndex: newIndex });
      app.globalData.playingIndex = newIndex;
      app.globalData.playingSeq = currentChapter?.seq;
      app.globalData.playlistChaptersData = sortedChapters;
    },

    onPlaylistPlay(e) {
      const { chapterId, index } = e.detail;

      if (chapterId === this.data.currentChapter._id) {
        // 点击当前章节，切换播放/暂停
        this.onPlayPause();
        return;
      }

      // 播放新章节
      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      // 使用app的playChapter，会自动更新globalData和通知回调
      app.playChapter(chapterId, this.data.chapters);

      // 手动同步状态（因为app.playChapter不会更新mini-player的本地状态）
      const chapter = this.data.chapters.find(ch => ch._id === chapterId);
      if (chapter) {
        const lastPlayTime = Number(chapter.lastPlayTime) || 0;
        const chapterDuration = Number(chapter.duration) || 0;
        const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

        this._syncingChapter = true;
        this.setData({
          currentChapter: chapter,
          currentIndex: index >= 0 ? index : this.data.currentIndex,
          isPlaying: false,
          currentTime: lastPlayTime,
          duration: chapterDuration,
          progressPercent: progressPercent
        });
      }
    },

    onPlaylistDelete(e) {
      const { chapterId } = e.detail;
      const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
      this.setData({ chapters });
      app.globalData.playlistChaptersData = chapters;

      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) {
          this.saveProgress();
        }

        const nextIndex = this.data.currentIndex;
        if (nextIndex < chapters.length && chapters[nextIndex]?.audioUrl) {
          const nextChapter = chapters[nextIndex];
          // 使用app的playChapter
          app.playChapter(nextChapter._id, chapters);

          // 手动同步状态
          const lastPlayTime = Number(nextChapter.lastPlayTime) || 0;
          const chapterDuration = Number(nextChapter.duration) || 0;
          const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;

          this._syncingChapter = true;
          this.setData({
            currentChapter: nextChapter,
            currentIndex: nextIndex,
            currentTime: lastPlayTime,
            duration: chapterDuration,
            progressPercent: progressPercent
          });
        } else {
          const lastChapterId = this.data.currentChapter?._id;
          app.stop();
          app.globalData.miniPlayerActive = false;
          app.globalData.playlistChaptersData = [];
          this.clearPlayStateCache();
          this.setData({ visible: false, isPlaying: false });
          app.notifyCallbacks('onStop', { chapterId: lastChapterId });
        }
      }
    }
  }
});
