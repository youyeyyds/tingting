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
    statusBarHeight: 0,
    navContentHeight: 0,
    menuButtonHeight: 32,
    menuButtonWidth: 87,
    menuButtonLeftGap: 10,
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
    isFavoriteList: false,
    playMode: 'sequence',
    // Overlay state
    playerOverlayVisible: false,
    overlayFadeClass: '',
    overlayCoverRotationAngle: 0,
    overlaySpeedIndicatorPos: 70,
    overlayCurrentTimeText: '0:00',
    overlayRemainingTimeText: '-0:00',
    overlayShowTotalTime: false,
    overlayNextChapterSeq: '',
    overlayNextChapterTitle: '',
    overlayIsFavorite: false,
    overlayBgCoverLoaded: false,
    overlayBgCoverError: false,
    overlayCoverError: false,
    overlayUsingDefaultCover: false,
    overlayOriginalCover: ''
  },

  lifetimes: {
    created() {
      this.bgAudioManager = app.bgAudioManager;
      this.speedOptions = [0.75, 1, 1.25, 1.5, 2];
      this._overlayRotationTimer = null;
      this._initNavButtonData();
      this.audioCallback = {
        onChapterChange: ({ chapterId, chapter, index }) => {
          if (!chapterId) return;
          const foundChapter = chapter || this.data.chapters.find(ch => ch._id === chapterId);
          const foundIndex = index >= 0 ? index : this.data.chapters.findIndex(ch => ch._id === chapterId);
          if (foundChapter && foundIndex >= 0) {
            // 更新课程信息（收藏场景跨课程切换时）
            if (app.globalData.playingCourse) {
              this.setData({
                currentChapter: foundChapter,
                currentIndex: foundIndex,
                course: app.globalData.playingCourse,
                courseCover: app.globalData.playingCourse.cover || '',
                courseName: app.globalData.playingCourse.title || ''
              }, () => {
                this._updateOverlayNextChapterInfo();
                this.checkOverlayFavoriteStatus();
              });
            } else {
              this.setData({ currentChapter: foundChapter, currentIndex: foundIndex }, () => {
                this._updateOverlayNextChapterInfo();
                this.checkOverlayFavoriteStatus();
              });
            }
          }
        },
        onPlay: () => {
          this._syncingChapter = false;
          this.setData({ isPlaying: app.globalData.playingStatus });
          if (this.data.playerOverlayVisible) this._startOverlayRotation();
          else this._stopOverlayRotation();
        },
        onPause: () => {
          if (this.data.currentChapter._id && app.globalData.playingStatus === false) {
            this._doSaveProgress();
          }
          this.setData({ isPlaying: app.globalData.playingStatus });
          this._stopOverlayRotation();
        },
        onPlayPause: () => {
          this.setData({ isPlaying: app.globalData.playingStatus });
        },
        onEnded: () => {
          // 音频自然结束时，由 app.js 的 onAudioEnded 调用 playChapter 来保存进度
          // 这里不需要再次保存，避免 currentTime 已重置导致 lastPlayTime=0
        },
        onLastChapterEnded: () => {
          this.setData({ isPlaying: false, currentTime: 0, duration: 0, progressPercent: 0 });
        },
        onError: () => this.setData({ isPlaying: false }),
        onStop: () => this.setData({ isPlaying: false }),
        onReset: () => {
          this.setData({ fadeInClass: 'fade-out' });
          setTimeout(() => this._resetState(), 300);
        },
        onPlayFromList: (data) => this._playFromList(data),
        onCoverRefresh: ({ coverLoadTime }) => {
          if (!coverLoadTime) return;
          const newCover = app.processImageUrl(this.data.courseCover, 'cover', coverLoadTime);
          this.setData({ courseCover: newCover, coverLoadTime });
          if (this.data.visible) {
            this.setData({ courseCover: newCover });
          }
        }
      };
      this._onCanplay = () => {
        this.bgAudioManager.playbackRate = 2;
        this.setData({ duration: this.bgAudioManager.duration || 0, playbackRate: 2 });
      };
    },
    attached() {
      app.registerMiniPlayer(this.audioCallback);
      this._setupAudioListeners();
    },
    detached() {
      if (this._onTimeUpdate && this.bgAudioManager.offTimeUpdate) this.bgAudioManager.offTimeUpdate(this._onTimeUpdate);
      if (this._onCanplay && this.bgAudioManager.offCanplay) this.bgAudioManager.offCanplay(this._onCanplay);
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
    hide() {
      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '' });
      }
    },
  },

  methods: {
    _initNavButtonData() {
      try {
        const systemInfo = wx.getWindowInfo();
        const statusBarHeight = systemInfo.statusBarHeight || 20;
        const menuButton = wx.getMenuButtonBoundingClientRect();
        const menuButtonTop = menuButton.top;
        const menuButtonHeight = menuButton.height;
        const menuButtonWidth = menuButton.width;
        const menuButtonRight = menuButton.right;
        const menuButtonMarginTop = menuButtonTop - statusBarHeight;
        const navContentHeight = menuButtonHeight + menuButtonMarginTop * 2;
        const windowWidth = systemInfo.windowWidth || systemInfo.screenWidth;
        const menuButtonLeftGap = windowWidth - menuButtonRight;
        this.setData({
          statusBarHeight,
          navContentHeight,
          menuButtonHeight,
          menuButtonWidth,
          menuButtonLeftGap
        });
      } catch (e) {
        this.setData({
          statusBarHeight: 20,
          navContentHeight: 44,
          menuButtonHeight: 32,
          menuButtonWidth: 87,
          menuButtonLeftGap: 10
        });
      }
    },

    _setupAudioListeners() {
      if (!this._onTimeUpdate) {
        this._onTimeUpdate = () => {
          if (this._syncingChapter) return;
          const currentTime = this.bgAudioManager.currentTime || 0;
          const duration = this.bgAudioManager.duration || 0;
          const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
          this.setData({ currentTime, duration, progressPercent });
          if (this.data.playerOverlayVisible) {
            this._updateOverlayProgress();
          }
        };
      }
      if (this.bgAudioManager.offTimeUpdate) this.bgAudioManager.offTimeUpdate(this._onTimeUpdate);
      this.bgAudioManager.onTimeUpdate(this._onTimeUpdate);
      if (this.bgAudioManager.offCanplay) this.bgAudioManager.offCanplay(this._onCanplay);
      this.bgAudioManager.onCanplay(this._onCanplay);
    },

    showMiniPlayer(isTabBarPage) {
      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '' });
        return;
      }

      const { playingCourse, playingChapter, playlistChaptersData, playlistSortOrder, isFavoriteList } = app.globalData;
      let playbackRate = this.bgAudioManager.playbackRate || 2;
      if (!this.speedOptions.includes(playbackRate)) playbackRate = 2;

      let courseCover = this.data.courseCover;
      if (playingCourse?.cover) {
        if (!app.globalData.coverLoadTime) app.globalData.coverLoadTime = Date.now();
        courseCover = app.processImageUrl(playingCourse.cover, 'cover', app.globalData.coverLoadTime);
      } else if (app.globalData.defaultCoverUrl) {
        courseCover = app.globalData.defaultCoverUrl;
      }

      const chapters = playlistChaptersData || [];
      const currentChapter = playingChapter || {};
      const currentIndex = chapters.findIndex(ch => ch._id === currentChapter._id);
      const currentTime = this.bgAudioManager.currentTime || 0;
      const duration = this.bgAudioManager.duration || 0;
      const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

      const data = {
        playerBottom: this._calcPosition(),
        isPlaying: app.globalData.playingStatus,
        currentChapter,
        currentIndex: currentIndex >= 0 ? currentIndex : 0,
        courseCover,
        courseName: playingCourse?.title || '',
        chapters,
        course: { ...playingCourse, cover: courseCover } || {},
        playlistSortOrder: playlistSortOrder || 'asc',
        isFavoriteList: isFavoriteList || false,
        currentTime,
        duration,
        progressPercent,
        playbackRate
      };

      if (isTabBarPage && !app.globalData.miniPlayerIndexFadedIn) {
        this.setData({ visible: true, fadeInClass: 'fade-in', ...data });
        app.globalData.miniPlayerIndexFadedIn = true;
      } else {
        this.setData({ visible: true, fadeInClass: '', ...data });
      }
    },

    _calcPosition() {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route || '';
      const tabBarPages = ['pages/index/index', 'pages/favorite/index', 'pages/mine/index'];
      if (!tabBarPages.includes(route)) return 15;
      const windowInfo = wx.getWindowInfo();
      const tabBarHeight = 100 * (windowInfo.windowWidth / 750);
      const safeArea = windowInfo.screenHeight - (windowInfo.safeArea?.bottom || windowInfo.screenHeight);
      return 8 + tabBarHeight + safeArea;
    },

    _savePlayStateCache(course, chapter, sortOrder, playMode) {
      wx.setStorageSync('playingCourse', JSON.stringify(course));
      wx.setStorageSync('playingChapter', JSON.stringify(chapter));
      wx.setStorageSync('playingSeq', chapter?.seq);
      wx.setStorageSync('playlistSortOrder', sortOrder);
      wx.setStorageSync('playMode', playMode);
    },

    _clearPlayStateCache() {
      wx.removeStorageSync('playingCourse');
      wx.removeStorageSync('playingChapter');
      wx.removeStorageSync('playingSeq');
      wx.removeStorageSync('playlistSortOrder');
      wx.removeStorageSync('playMode');
    },

    _playFromList(data) {
      const { index, chapters } = data;
      if (!chapters || chapters.length === 0 || index < 0) return;

      if (this.data.currentChapter._id && this.bgAudioManager.currentTime > 0) {
        this._doSaveProgress();
      }

      const chapter = chapters[index];
      if (!chapter?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      if (!app.globalData.coverLoadTime) app.globalData.coverLoadTime = Date.now();
      const coverLoadTime = app.globalData.coverLoadTime;
      const courseCover = app.processImageUrl(chapter.courseCover || '', 'cover', coverLoadTime);

      const course = {
        _id: chapter.course,
        title: chapter.courseTitle || '收藏列表',
        cover: courseCover,
        author: chapter.author || '',
        chapterCount: chapters.length
      };

      this.setData({
        chapters, course, currentChapter: chapter, currentIndex: index,
        courseCover, courseName: chapter.courseTitle || '收藏列表',
        playlistSortOrder: 'asc', isFavoriteList: true, coverLoadTime
      });

      Object.assign(app.globalData, {
        playingCourse: course,
        playingChapter: chapter,
        playingSeq: chapter.seq,
        playingIndex: index,
        playlistChaptersData: chapters,
        playlistSortOrder: 'asc',
        playMode: 'sequence',
        miniPlayerActive: true,
        miniPlayerIndexFadedIn: false,
        isFavoriteList: true
      });

      this._savePlayStateCache(course, chapter, 'asc', 'sequence');
      app.playChapter(chapter._id, chapters);
      this.setData({ visible: true, fadeInClass: 'fade-in', playerBottom: this._calcPosition() });
    },

    // 播放章节（外部调用入口）
    play(chapterId, playlistChapters, courseData, sortOrder) {
      if (this.data.currentChapter._id && this.bgAudioManager.currentTime > 0) {
        this._doSaveProgress();
      }

      const chapters = playlistChapters || this.properties.initialChapters;
      const index = chapters.findIndex(ch => ch._id === chapterId);

      if (index === -1 || !chapters[index]?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      const chapter = chapters[index];
      if (!app.globalData.coverLoadTime) app.globalData.coverLoadTime = Date.now();
      const coverLoadTime = app.globalData.coverLoadTime;

      // 构建 course 对象：收藏场景 courseData 为 null，从 chapter 提取课程信息
      let course = courseData || this.properties.initialCourse;
      if (!course || (!course._id && !course.title)) {
        course = {
          _id: chapter.course || '',
          title: chapter.courseTitle || '收藏列表',
          cover: chapter.courseCover || '',
          author: chapter.author || ''
        };
      }
      const courseCover = app.processImageUrl(course.cover || '', 'cover', coverLoadTime);
      course.cover = courseCover;

      const order = sortOrder || app.globalData.playlistSortOrder || 'asc';
      const currentCourseId = app.globalData.playingCourse?._id;
      const isNewPlaylist = !app.globalData.miniPlayerActive || currentCourseId !== course._id;

      this.setData({
        chapters, course, currentChapter: chapter, currentIndex: index,
        courseCover, courseName: course.title || '',
        playlistSortOrder: order, isFavoriteList: false, coverLoadTime
      });

      Object.assign(app.globalData, {
        playingCourse: course,
        playingChapter: chapter,
        playingSeq: chapter.seq,
        playingIndex: index,
        playlistChaptersData: chapters,
        playlistSortOrder: order,
        playMode: isNewPlaylist ? 'sequence' : app.globalData.playMode,
        miniPlayerActive: true,
        miniPlayerIndexFadedIn: false,
        isFavoriteList: false
      });

      this._savePlayStateCache(course, chapter, order, app.globalData.playMode);
      app.playChapter(chapter._id, chapters);
      this.setData({ visible: true, fadeInClass: 'fade-in', playerBottom: this._calcPosition() });
    },

    _resetState() {
      this.setData({
        visible: false, fadeInClass: '', chapters: [], currentChapter: {},
        currentIndex: 0, course: {}, isPlaying: false,
        currentTime: 0, duration: 0, progressPercent: 0,
        playerOverlayVisible: false, playMode: 'sequence'
      });
    },

    onPlayPause() {
      if (this._playPauseLock) return;
      this._playPauseLock = true;
      setTimeout(() => { this._playPauseLock = false; }, 300);
      app.togglePlayPause();
      this.setData({ isPlaying: this.bgAudioManager.paused ? false : true });
    },

    togglePlayPause() { this.onPlayPause(); },

    onSpeedChange() {
      const nextRate = this.data.playbackRate >= 2 ? 1 : 2;
      this.setData({ playbackRate: nextRate });
      this.bgAudioManager.playbackRate = nextRate;
    },

    onClose() {
      const lastChapterId = this.data.currentChapter?._id || app.globalData.playingChapter?._id;
      this.setData({ fadeInClass: 'fade-out' });
      setTimeout(() => {
        this._doSaveProgress().then(() => {
          app.stop();
          this._resetState();
          Object.assign(app.globalData, {
            miniPlayerActive: false, miniPlayerIndexFadedIn: false,
            playingCourse: null, playingChapter: null, playingSeq: null,
            playingIndex: 0, playlistChaptersData: [], isFavoriteList: false
          });
          this._clearPlayStateCache();
          app.notifyCallbacks('onClose', { chapterId: lastChapterId });
        });
      }, 300);
    },

    _doSaveProgress(isFinished = false) {
      const chapterId = this.data.currentChapter._id;
      console.log('[_doSaveProgress] currentChapter:', this.data.currentChapter);
      console.log('[_doSaveProgress] course:', this.data.course);
      if (!chapterId || !this.bgAudioManager.currentTime) return Promise.resolve();
      const lastPlayTime = this.bgAudioManager.currentTime;
      const duration = this.bgAudioManager.duration || 0;

      // 已完成的章节不允许被标记为未完成
      // 只有自然结束(isFinished=true)或真正播完(lastPlayTime>=duration-10)才更新为true
      let finished;
      if (this.data.currentChapter.finished === true) {
        // 章节之前已完成，重播时不允许覆盖finished=true
        // 但要更新lastPlayTime（通过传入undefined，让云端只更新lastPlayTime不修改finished）
        finished = (isFinished || lastPlayTime >= duration - 10) ? true : undefined;
      } else {
        // 章节之前未完成，按正常逻辑
        finished = isFinished ? true : (lastPlayTime >= duration - 10);
      }

      return app.saveProgress(chapterId, this.data.currentChapter.course || this.data.course?._id, lastPlayTime, finished, true);
    },

    preventMove() {
      return true;
    },

    onCoverError() {
      const localCover = app.globalData.defaultCoverLocalPath;
      const cloudCover = app.globalData.defaultCoverUrl;
      const defaultCover = localCover || cloudCover || '/icons/svg/headphones.svg';
      if (this.data.courseCover !== defaultCover) {
        this.setData({ courseCover: defaultCover });
      }
    },

    openPlayerPanel() {
      this._syncOverlayState();
      this.setData({ playerOverlayVisible: true, overlayFadeClass: 'fade-in' });
      if (this.data.isPlaying) this._startOverlayRotation();
      this.checkOverlayFavoriteStatus();
    },

    closePlayerOverlay() {
      this._stopOverlayRotation();
      this.setData({ overlayFadeClass: 'fade-out' });
      setTimeout(() => {
        this.setData({ playerOverlayVisible: false, overlayFadeClass: '' });
      }, 300);
    },

    goHome() {
      wx.navigateTo({ url: '/pages/index/index' });
    },

    checkOverlayFavoriteStatus() {
      const chapterId = this.data.currentChapter._id;
      if (!chapterId || !app.globalData.userId) return;
      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'checkFavorite', chapterId, userId: app.globalData.userId }
      }).then(res => { if (res.result.success) this.setData({ overlayIsFavorite: res.result.data.isFavorite }); })
        .catch(err => console.error('检查收藏状态失败:', err));
    },

    _syncOverlayState() {
      const { currentTime, duration, playbackRate } = this.data;
      const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
      const currentTimeText = this._formatTime(currentTime);
      const showTotalTime = this.data.overlayShowTotalTime || false;
      const remainingTimeText = showTotalTime ? this._formatTime(duration) : '-' + this._formatTime(duration - currentTime);
      const speedIndex = this.speedOptions.findIndex(s => Math.abs(s - playbackRate) < 0.01);
      const speedIndicatorPos = speedIndex >= 0 ? 10 + speedIndex * 20 : 50;
      this._updateOverlayNextChapterInfo();
      const setData = {
        overlayCurrentTimeText: currentTimeText,
        overlayRemainingTimeText: remainingTimeText,
        overlaySpeedIndicatorPos: speedIndicatorPos
      };
      // 只有在还没有切换到默认封面时，才更新原始封面
      if (!this.data.overlayUsingDefaultCover) {
        setData.overlayOriginalCover = this.data.courseCover;
      }
      this.setData(setData);
      if (!this.speedOptions.includes(playbackRate)) {
        this.setData({ playbackRate: 2 });
        this.bgAudioManager.playbackRate = 2;
      }
    },

    _startOverlayRotation() {
      if (this._overlayRotationTimer) return;
      this._overlayRotationTimer = setInterval(() => {
        const { overlayCoverRotationAngle, playlistSortOrder } = this.data;
        const newAngle = playlistSortOrder === 'asc' ? overlayCoverRotationAngle + 1.5 : overlayCoverRotationAngle - 1.5;
        this.setData({ overlayCoverRotationAngle: newAngle });
      }, 50);
    },

    _stopOverlayRotation() {
      if (this._overlayRotationTimer) {
        clearInterval(this._overlayRotationTimer);
        this._overlayRotationTimer = null;
      }
    },

    _formatTime(seconds) {
      if (!seconds || seconds < 0) return '0:00';
      return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
    },

    _updateOverlayNextChapterInfo() {
      const { chapters, playlistSortOrder, currentChapter } = this.data;
      const playMode = app.globalData.playMode || 'sequence';
      if (!chapters || chapters.length === 0) {
        this.setData({ overlayNextChapterSeq: '', overlayNextChapterTitle: '' });
        return;
      }
      if (playMode === 'single') {
        this.setData({ overlayNextChapterSeq: currentChapter.seq, overlayNextChapterTitle: currentChapter.title });
        return;
      }
      const currentIdx = chapters.findIndex(ch => ch._id === currentChapter?._id);
      const nextIndex = currentIdx + 1;
      if (nextIndex < chapters.length) {
        const nextCh = chapters[nextIndex];
        this.setData({ overlayNextChapterSeq: nextCh.seq, overlayNextChapterTitle: nextCh.title });
      } else if (playMode === 'loop') {
        this.setData({ overlayNextChapterSeq: chapters[0].seq, overlayNextChapterTitle: chapters[0].title });
      } else {
        this.setData({ overlayNextChapterSeq: '', overlayNextChapterTitle: '已经是最后一条' });
      }
    },

    _updateOverlayProgress() {
      const { currentTime, duration, overlayShowTotalTime } = this.data;
      this.setData({
        overlayCurrentTimeText: this._formatTime(currentTime),
        overlayRemainingTimeText: overlayShowTotalTime ? this._formatTime(duration) : '-' + this._formatTime(duration - currentTime)
      });
    },

    toggleOverlayTimeDisplay() {
      const newShowTotal = !this.data.overlayShowTotalTime;
      this.setData({ overlayShowTotalTime: newShowTotal });
      this._updateOverlayProgress();
    },

    onOverlaySliderChanging(e) {
      this._sliderDragging = true;
      const duration = this.bgAudioManager.duration || 0;
      this.setData({ currentTime: (e.detail.value / 100) * duration });
      this._updateOverlayProgress();
    },

    onOverlaySliderChange(e) {
      const duration = this.bgAudioManager.duration || 0;
      this.bgAudioManager.seek((e.detail.value / 100) * duration);
      this._sliderDragging = false;
    },

    overlayPlayPrev() {
      if (this.data.currentChapter._id) this._doSaveProgress();
      app.playPrev();
    },

    overlayPlayNext() {
      if (this.data.currentChapter._id) this._doSaveProgress();
      app.playNext();
    },

    overlayRewind15() {
      this.bgAudioManager.seek(Math.max(0, this.bgAudioManager.currentTime - 15));
    },

    overlayForward30() {
      this.bgAudioManager.seek(Math.min(this.bgAudioManager.duration, this.bgAudioManager.currentTime + 30));
    },

    _updateOverlaySpeedIndicator() {
      const { playbackRate } = this.data;
      const index = this.speedOptions.findIndex(s => Math.abs(s - playbackRate) < 0.01);
      let pos = index >= 0 ? 10 + index * 20 : 50;
      // 最后一个位置（2x）需要限制，避免超出容器
      pos = Math.min(pos, 85);
      this.setData({ overlaySpeedIndicatorPos: pos });
    },

    onOverlaySpeedTrackTap(e) {
      if (this.speedMoved) { this.speedMoved = false; return; }
      const touch = e.detail.x ? e : e.touches?.[0] || e;
      const clientX = touch.clientX || touch.detail?.x || 0;
      const query = this.createSelectorQuery();
      query.select('.overlay-speed-track-wrap').boundingClientRect((rect) => {
        if (!rect) return;
        const x = clientX - rect.left;
        const pos = Math.max(10, Math.min(90, (x / rect.width) * 100));
        const index = Math.round((pos - 10) / 20);
        const rate = this.speedOptions[Math.max(0, Math.min(this.speedOptions.length - 1, index))];
        this.setData({ playbackRate: rate });
        this.bgAudioManager.playbackRate = rate;
        this._updateOverlaySpeedIndicator();
      }).exec();
    },

    onOverlaySpeedTouchStart(e) {
      this.speedTouching = true;
      this.speedTouchStartX = e.touches[0].clientX;
      this.speedMoved = false;
    },

    onOverlaySpeedTouchMove(e) {
      if (!this.speedTouching) return;
      if (Math.abs(e.touches[0].clientX - this.speedTouchStartX) > 10) this.speedMoved = true;
      const query = this.createSelectorQuery();
      query.select('.overlay-speed-track-wrap').boundingClientRect((rect) => {
        if (!rect) return;
        const x = e.touches[0].clientX - rect.left;
        const pos = Math.max(10, Math.min(90, (x / rect.width) * 100));
        const index = Math.round((pos - 10) / 20);
        const rate = this.speedOptions[Math.max(0, Math.min(this.speedOptions.length - 1, index))];
        this.setData({ playbackRate: rate });
        this.bgAudioManager.playbackRate = rate;
        this._updateOverlaySpeedIndicator();
      }).exec();
    },

    onOverlaySpeedTouchEnd() {
      this.speedTouching = false;
    },

    toggleOverlayFavorite() {
      const chapterId = this.data.currentChapter._id;
      if (!chapterId || !app.globalData.userId) return;
      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: { type: 'toggleFavorite', chapterId, userId: app.globalData.userId }
      }).then(res => {
        if (res.result.success) {
          this.setData({ overlayIsFavorite: res.result.data.isFavorite });
          wx.showToast({ title: res.result.data.isFavorite ? '已收藏' : '已取消收藏', icon: 'none' });
        }
      }).catch(() => wx.showToast({ title: '操作失败', icon: 'none' }));
    },

    toggleOverlaySort() {
      const { playlistSortOrder, chapters, currentChapter } = this.data;
      const newOrder = playlistSortOrder === 'asc' ? 'desc' : 'asc';
      const reversed = [...chapters].reverse();
      const currentId = currentChapter?._id;
      const newIndex = reversed.findIndex(ch => ch._id === currentId);
      const newCurrentChapter = reversed[newIndex];
      Object.assign(app.globalData, { playlistSortOrder: newOrder, playlistChaptersData: reversed, playingIndex: newIndex >= 0 ? newIndex : 0 });
      this.setData({
        playlistSortOrder: newOrder,
        chapters: reversed,
        currentIndex: newIndex >= 0 ? newIndex : 0,
        currentChapter: newCurrentChapter || currentChapter
      }, () => this._updateOverlayNextChapterInfo());
      wx.showToast({ title: newOrder === 'asc' ? '正序' : '倒序', icon: 'none' });
    },

    showOverlayPlaylist() {
      const playlistPanel = this.selectComponent('#overlayPlaylistPanel');
      if (playlistPanel) playlistPanel.show();
    },

    onPlaylistModeChange(e) {
      this.setData({ playMode: e.detail.playMode });
      app.globalData.playMode = e.detail.playMode;
    },

    onOverlayPlaylistPlay(e) {
      const { chapterId, index } = e.detail;
      if (chapterId === this.data.currentChapter._id) { app.togglePlayPause(); return; }
      if (this.data.currentChapter._id && this.data.isPlaying) this._doSaveProgress();
      app.playChapter(chapterId, this.data.chapters);
      const chapter = this.data.chapters.find(ch => ch._id === chapterId);
      if (chapter) {
        const lastPlayTime = Number(chapter.lastPlayTime) || 0;
        const chapterDuration = Number(chapter.duration) || 0;
        this._syncingChapter = true;
        this.setData({
          currentChapter: chapter,
          currentIndex: index >= 0 ? index : this.data.currentIndex,
          isPlaying: false, currentTime: lastPlayTime, duration: chapterDuration, progressPercent: chapterDuration > 0 ? (lastPlayTime / chapterDuration) * 100 : 0
        });
      }
    },

    onOverlayPlaylistDelete(e) {
      const { chapterId } = e.detail;
      const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
      this.setData({ chapters });
      app.globalData.playlistChaptersData = chapters;
      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) this._doSaveProgress();
        const nextIndex = this.data.currentIndex;
        if (nextIndex < chapters.length && chapters[nextIndex]?.audioUrl) {
          app.playChapter(chapters[nextIndex]._id, chapters);
        } else {
          app.stop();
          this.setData({ visible: false, isPlaying: false });
        }
      }
      this._updateOverlayNextChapterInfo();
    },

    onOverlayPlaylistCollapse() {},

    onOverlayPlaylistClear() {
      this._doSaveProgress();
      app.stop();
      this.setData({ isPlaying: false, chapters: [], currentChapter: {}, currentIndex: 0 });
      this.closePlayerOverlay();
    },

    onOverlayPlaylistSyncSort(e) {
      const { chapters, sortOrder } = e.detail;
      const currentId = this.data.currentChapter._id;
      const newIndex = chapters.findIndex(ch => ch._id === currentId);
      this.setData({ chapters, currentIndex: newIndex, playlistSortOrder: sortOrder }, () => this._updateOverlayNextChapterInfo());
      app.globalData.playingIndex = newIndex;
      app.globalData.playlistChaptersData = chapters;
      app.globalData.playlistSortOrder = sortOrder;
    },

    toggleOverlayPlayMode() {
      const nextMode = app.togglePlayMode();
      this.setData({ playMode: nextMode });
      this._updateOverlayNextChapterInfo();
      wx.showToast({ title: nextMode === 'sequence' ? '顺序播放' : nextMode === 'loop' ? '列表循环' : '单曲循环', icon: 'none' });
    },

    onOverlayPlaylistModeChange(e) {
      this.setData({ playMode: e.detail.playMode });
      app.globalData.playMode = e.detail.playMode;
    },

    onOverlayCoverError() {
      const localCover = app.globalData.defaultCoverLocalPath || app.globalData.fallbackCover;
      if (this.data.courseCover === localCover && localCover) {
        this.setData({ overlayCoverError: true, courseCover: '' });
        return;
      }
      this.setData({ overlayCoverError: true, courseCover: localCover || this.data.courseCover });
    },

    onOverlayCoverTap() {
      const { overlayUsingDefaultCover, overlayOriginalCover } = this.data;
      const defaultCover = app.globalData.defaultCoverLocalPath || app.globalData.fallbackCover || '';
      if (!defaultCover || !overlayOriginalCover) return;
      if (overlayUsingDefaultCover) {
        const coverLoadTime = app.globalData.coverLoadTime || Date.now();
        this.setData({
          overlayUsingDefaultCover: false,
          courseCover: app.processImageUrl(overlayOriginalCover, 'cover', coverLoadTime),
          overlayCoverError: false,
          overlayBgCoverError: false
        });
      } else {
        this.setData({ overlayUsingDefaultCover: true, courseCover: defaultCover, overlayCoverError: false, overlayBgCoverError: false });
      }
    },

    onOverlayBgCoverLoad() {
      this.setData({ overlayBgCoverLoaded: true });
    },

    onOverlayBgCoverError() {
      const localCover = app.globalData.defaultCoverLocalPath || app.globalData.fallbackCover;
      this.setData({ overlayBgCoverError: true, courseCover: localCover || this.data.courseCover });
    },

    onPlaylistTap() {
      const playlistPanel = this.selectComponent('#playlistPanel');
      if (playlistPanel) playlistPanel.show();
    },

    onPlaylistCollapse() {},

    onPlaylistClear() {
      const lastChapterId = this.data.currentChapter?._id;
      if (this.data.currentChapter._id) this._doSaveProgress();
      app.stop();
      Object.assign(app.globalData, {
        miniPlayerActive: false, miniPlayerIndexFadedIn: false,
        playingCourse: null, playingChapter: null, playingSeq: null,
        playingIndex: 0, playlistChaptersData: [], isFavoriteList: false
      });
      this._clearPlayStateCache();
      this.setData({ visible: false, isPlaying: false, chapters: [], isFavoriteList: false });
      app.notifyCallbacks('onStop', { chapterId: lastChapterId });
    },

    onPlaylistSyncSort(e) {
      const { chapters, sortOrder } = e.detail;
      const currentId = this.data.currentChapter._id;
      const newIndex = chapters.findIndex(ch => ch._id === currentId);
      const currentChapter = chapters[newIndex];
      this.setData({ chapters, currentIndex: newIndex, playlistSortOrder: sortOrder });
      app.globalData.playingIndex = newIndex;
      app.globalData.playingSeq = currentChapter?.seq;
      app.globalData.playlistChaptersData = chapters;
      app.globalData.playlistSortOrder = sortOrder;
    },

    onPlaylistPlay(e) {
      const { chapterId, index } = e.detail;
      if (chapterId === this.data.currentChapter._id) {
        this.onPlayPause();
        return;
      }
      if (this.data.currentChapter._id && this.data.isPlaying) this._doSaveProgress();
      app.playChapter(chapterId, this.data.chapters);
      const chapter = this.data.chapters.find(ch => ch._id === chapterId);
      if (chapter) {
        const lastPlayTime = Number(chapter.lastPlayTime) || 0;
        const chapterDuration = Number(chapter.duration) || 0;
        const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;
        this._syncingChapter = true;
        this.setData({
          currentChapter: chapter,
          currentIndex: index >= 0 ? index : this.data.currentIndex,
          isPlaying: false, currentTime: lastPlayTime, duration: chapterDuration, progressPercent
        });
      }
    },

    onPlaylistDelete(e) {
      const { chapterId } = e.detail;
      const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
      this.setData({ chapters });
      app.globalData.playlistChaptersData = chapters;

      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) this._doSaveProgress();
        const nextIndex = this.data.currentIndex;
        if (nextIndex < chapters.length && chapters[nextIndex]?.audioUrl) {
          const nextChapter = chapters[nextIndex];
          app.playChapter(nextChapter._id, chapters);
          const lastPlayTime = Number(nextChapter.lastPlayTime) || 0;
          const chapterDuration = Number(nextChapter.duration) || 0;
          const progressPercent = chapterDuration > 0 ? Math.min((lastPlayTime / chapterDuration) * 100, 100) : 0;
          this._syncingChapter = true;
          this.setData({
            currentChapter: nextChapter, currentIndex: nextIndex,
            currentTime: lastPlayTime, duration: chapterDuration, progressPercent
          });
        } else {
          const lastChapterId = this.data.currentChapter?._id;
          app.stop();
          app.globalData.miniPlayerActive = false;
          app.globalData.playlistChaptersData = [];
          this._clearPlayStateCache();
          this.setData({ visible: false, isPlaying: false });
          app.notifyCallbacks('onStop', { chapterId: lastChapterId });
        }
      }
    }
  }
});
