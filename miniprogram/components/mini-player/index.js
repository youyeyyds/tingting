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
        onCanplay: (data) => {
          // 更新duration后重新计算进度
          const duration = data.duration;
          const currentTime = this.bgAudioManager.currentTime || 0;
          const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
          console.log('[mini-player] onCanplay:', { duration, currentTime, progressPercent, data });
          this.setData({
            duration: duration,
            currentTime: currentTime,
            progressPercent: progressPercent
          });
        },
        onPlay: () => {
          console.log('[mini-player] onPlay, isPlaying set to true');
          this.setData({ isPlaying: true });
        },
        onPause: () => {
          console.log('[mini-player] onPause, isPlaying set to false');
          this.setData({ isPlaying: false });
        },
        onTimeUpdate: (data) => {
          const currentTime = data.currentTime;
          // 始终使用 bgAudioManager.duration 获取最新值，避免切换章节后 duration 未更新的问题
          const duration = this.bgAudioManager.duration;
          const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
          console.log('[mini-player] onTimeUpdate:', { currentTime, duration, progressPercent, thisDataDuration: this.data.duration });
          this.setData({
            currentTime: currentTime,
            progressPercent: progressPercent
          });
        },
        onEnded: () => this.onAudioEnded(),
        onError: () => {
          this.setData({ isPlaying: false });
        },
        onStop: () => {
          this.setData({ isPlaying: false });
        },
        onPlayFromList: (data) => this.playFromList(data),
        onClose: () => {
          const pages = getCurrentPages();
          const isForeground = this.currentPageRoute === pages[pages.length - 1]?.route;
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
    },
    attached() {
      app.registerMiniPlayer(this.audioCallback);
    },
    detached() {
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

      setTimeout(() => this.showMiniPlayer(isTabBarPage), 100);
    },
  },

  methods: {
    showMiniPlayer(isTabBarPage) {
      if (!app.globalData.miniPlayerActive) {
        this.setData({ visible: false, fadeInClass: '' });
        return;
      }

      if (!app.globalData.coverLoadTime) {
        app.globalData.coverLoadTime = Date.now();
      }
      const globalCoverTime = app.globalData.coverLoadTime;

      const { playingCourse, playingChapter, playingIndex, playlistChaptersData, playlistSortOrder, isFavoriteList } = app.globalData;
      let playbackRate = this.bgAudioManager.playbackRate || 2;
      if (!this.speedOptions.includes(playbackRate)) {
        playbackRate = 2;
      }

      let courseCover = this.data.courseCover;
      if (globalCoverTime !== this.data.coverLoadTime) {
        courseCover = this.rebuildImageUrl(playingCourse?.cover || '', globalCoverTime);
      }

      const currentTime = this.bgAudioManager.currentTime || 0;
      const duration = this.bgAudioManager.duration || 0;
      const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
      console.log('[mini-player] showMiniPlayer:', { currentTime, duration, progressPercent, isPlaying: !this.bgAudioManager.paused });

      const data = {
        playerBottom: this.calcPosition(),
        isPlaying: !this.bgAudioManager.paused,
        currentChapter: playingChapter || {},
        currentIndex: playingIndex || 0,
        courseCover: courseCover,
        courseName: playingCourse?.title || '',
        chapters: playlistChaptersData || [],
        course: { ...playingCourse, cover: courseCover } || {},
        playlistSortOrder: playlistSortOrder || 'asc',
        isFavoriteList: isFavoriteList || false,
        currentTime: currentTime,
        duration: duration,
        progressPercent: progressPercent,
        playbackRate: playbackRate,
        coverLoadTime: globalCoverTime
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

    savePlayStateCache(course, chapter, index, sortOrder, playMode) {
      wx.setStorageSync('playingCourse', JSON.stringify(course));
      wx.setStorageSync('playingChapter', JSON.stringify(chapter));
      wx.setStorageSync('playingIndex', index);
      wx.setStorageSync('playlistSortOrder', sortOrder);
      wx.setStorageSync('playMode', playMode);
    },

    clearPlayStateCache() {
      wx.removeStorageSync('playingCourse');
      wx.removeStorageSync('playingChapter');
      wx.removeStorageSync('playingIndex');
      wx.removeStorageSync('playlistSortOrder');
      wx.removeStorageSync('playMode');
    },

    updateChapterCache(chapter, index) {
      wx.setStorageSync('playingChapter', JSON.stringify(chapter));
      wx.setStorageSync('playingIndex', index);
    },

    playFromList(data) {
      const { index, chapters } = data;
      if (!chapters || chapters.length === 0 || index < 0) return;

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
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters;
      app.globalData.playlistSortOrder = 'asc';
      app.globalData.playMode = 'sequence';
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = true;

      this.savePlayStateCache(course, chapter, index, 'asc', 'sequence');

      this.setData({
        visible: true,
        fadeInClass: 'fade-in',
        playerBottom: this.calcPosition(),
        isPlaying: false
      });

      this.loadAudio(chapter);
    },

    async play(chapterId, playlistChapters, courseData, sortOrder) {
      if (this.data.currentChapter._id && this.data.isPlaying) {
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
      const order = isNewPlaylist ? (sortOrder || 'asc') : (app.globalData.playlistSortOrder || sortOrder || 'asc');

      this.setData({ chapters: chapters, course: course, playlistSortOrder: order, isFavoriteList: false, coverLoadTime: coverLoadTime });

      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters;
      if (isNewPlaylist) {
        app.globalData.playlistSortOrder = order;
        app.globalData.playMode = 'sequence';
      }
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.isFavoriteList = false;

      this.savePlayStateCache(course, chapter, index, order, 'sequence');

      this.setData({
        visible: true,
        fadeInClass: 'fade-in',
        playerBottom: this.calcPosition(),
        isPlaying: false,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: courseCover,
        courseName: course.title || '',
        isFavoriteList: false
      });

      this.loadAudio(chapter);
    },

    async loadAudio(chapter) {
      this._audioEndedProcessing = false;

      const bgAudio = this.bgAudioManager;
      const src = chapter?.audioUrl;

      if (!src) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        this.setData({ isPlaying: false });
        return;
      }

      if (src.startsWith('cloud://')) {
        try {
          wx.showLoading({ title: '加载中...', mask: true });
          const res = await wx.cloud.getTempFileURL({ fileList: [src] });
          wx.hideLoading();
          const tempUrl = res.fileList?.[0]?.tempFileURL;
          if (!tempUrl) throw new Error('获取链接失败');
          this.playWithUrl(chapter, tempUrl);
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '音频加载失败', icon: 'none' });
          this.setData({ isPlaying: false });
        }
      } else {
        this.playWithUrl(chapter, src);
      }
    },

    playWithUrl(chapter, src) {
      const bgAudio = this.bgAudioManager;
      const [baseUrl, query] = src.split('?');
      bgAudio.title = chapter.title || '音频课程';
      bgAudio.epname = this.data.course.title || '';
      bgAudio.coverImgUrl = this.data.course.cover || '';
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const duration = Number(chapter.duration) || 0;
      const startTime = (lastPlayTime >= duration && duration > 0) ? 0 : lastPlayTime;
      bgAudio.startTime = startTime;
      bgAudio.src = query ? `${encodeURI(baseUrl)}?${query}` : encodeURI(baseUrl);
    },

    onPlayPause() {
      // 防止快速点击导致状态混乱
      if (this._playPauseLock) return;
      this._playPauseLock = true;
      setTimeout(() => { this._playPauseLock = false; }, 300);

      const { currentChapter, isPlaying } = this.data;
      if (isPlaying) {
        this.bgAudioManager.pause();
        this.saveProgress();
        this.setData({ isPlaying: false });
        app.notifyCallbacks('onPlayPause', { chapterId: currentChapter._id, isPlaying: false });
      } else {
        this.bgAudioManager.play();
        this.setData({ isPlaying: true });
        app.notifyCallbacks('onPlayPause', { chapterId: currentChapter._id, isPlaying: true });
      }
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

    onAudioEnded() {
      if (this._audioEndedProcessing) return;
      this._audioEndedProcessing = true;

      this.updateProgress(0, true);
      const { chapters, currentIndex } = this.data;
      const playMode = app.globalData.playMode || 'sequence';

      if (playMode === 'single') {
        const currentChapter = chapters[currentIndex];
        if (currentChapter?.audioUrl) {
          currentChapter.lastPlayTime = 0;
          this.setData({ currentChapter });
          this.loadAudio(currentChapter);
        } else {
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      const nextIndex = currentIndex + 1;

      if (nextIndex >= chapters.length) {
        if (playMode === 'loop') {
          const firstChapter = chapters[0];
          if (firstChapter?.audioUrl) {
            app.globalData.playingChapter = firstChapter;
            app.globalData.playingIndex = 0;
            this.updateChapterCache(firstChapter, 0);
            this.setData({ currentChapter: firstChapter, currentIndex: 0 });
            this.loadAudio(firstChapter);
            app.notifyCallbacks('onChapterChange', { chapterId: firstChapter._id });
          }
        } else {
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      if (chapters[nextIndex]?.audioUrl) {
        const nextChapter = chapters[nextIndex];
        app.globalData.playingChapter = nextChapter;
        app.globalData.playingIndex = nextIndex;
        this.updateChapterCache(nextChapter, nextIndex);
        this.setData({ currentChapter: nextChapter, currentIndex: nextIndex });
        this.loadAudio(nextChapter);
        app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
      } else {
        this.setData({ isPlaying: false });
      }
      this._audioEndedProcessing = false;
    },

    onClose() {
      this.saveProgress();
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      app.globalData.isFavoriteList = false;
      this.clearPlayStateCache();
      app.notifyCallbacks('onClose', {});
    },

    saveProgress() {
      const currentTime = this.bgAudioManager.currentTime || this.data.currentTime;
      this.updateProgress(Math.floor(currentTime));
    },

    updateProgress(time, finished) {
      const chapterId = this.data.currentChapter._id;
      const courseId = this.data.currentChapter.course || this.data.course._id;
      const userId = app.globalData.userId;

      if (!userId || !chapterId || !courseId) return;

      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'updateChapterProgress',
          chapterId: chapterId,
          courseId: courseId,
          lastPlayTime: time,
          finished: finished,
          userId: userId
        }
      }).then(res => {
        if (res.result.success) {
          const chapters = this.data.chapters.map(ch => {
            if (ch._id === chapterId) {
              if (finished === true) {
                return { ...ch, lastPlayTime: time, finished: true, progress: 100, progressText: '已学完' };
              }
              if (ch.finished) {
                return { ...ch, lastPlayTime: time };
              }
              const chDuration = Number(ch.duration) || 0;
              const progress = chDuration > 0 ? Math.min(Math.round((time / chDuration) * 100), 100) : 0;
              let progressText = '未学习';
              if (progress === 100) progressText = '已学完';
              else if (progress > 0) progressText = '已学' + progress + '%';
              return { ...ch, lastPlayTime: time, progress, progressText };
            }
            return ch;
          });
          this.setData({ chapters });
          app.globalData.playlistChaptersData = chapters;
          app.notifyCallbacks('onProgressUpdate', {
            chapterId: chapterId,
            lastPlayTime: time,
            duration: this.data.duration,
            finished: finished
          });
        }
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
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      app.globalData.isFavoriteList = false;
      this.clearPlayStateCache();
      this.setData({ visible: false, isPlaying: false, chapters: [], isFavoriteList: false });
    },

    onPlaylistSyncSort(e) {
      const sortedChapters = e.detail.chapters;
      const currentId = this.data.currentChapter._id;
      const newIndex = sortedChapters.findIndex(ch => ch._id === currentId);
      this.setData({ chapters: sortedChapters, currentIndex: newIndex });
      app.globalData.playingIndex = newIndex;
    },

    onPlaylistPlay(e) {
      const { chapterId, index } = e.detail;
      const chapter = this.data.chapters.find(ch => ch._id === chapterId);

      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) {
          this.bgAudioManager.pause();
          this.saveProgress();
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: false });
        } else {
          this.bgAudioManager.play();
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: true });
        }
        return;
      }

      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      if (chapter?.audioUrl) {
        app.globalData.playingChapter = chapter;
        app.globalData.playingIndex = index;
        this.updateChapterCache(chapter, index);
        this.setData({
          currentChapter: chapter,
          currentIndex: index,
          isPlaying: false
        });
        this.loadAudio(chapter);
        app.notifyCallbacks('onChapterChange', { chapterId: chapter._id });
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
          app.globalData.playingChapter = nextChapter;
          app.globalData.playingIndex = nextIndex;
          this.updateChapterCache(nextChapter, nextIndex);
          this.setData({
            currentChapter: nextChapter,
            currentIndex: nextIndex
          });
          this.loadAudio(nextChapter);
          app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
        } else {
          this.bgAudioManager.stop();
          app.globalData.miniPlayerActive = false;
          app.globalData.playlistChaptersData = [];
          this.clearPlayStateCache();
          this.setData({ visible: false, isPlaying: false });
          app.notifyCallbacks('onStop', {});
        }
      }
    }
  }
});