// mini-player/index.js
const app = getApp();

Component({
  properties: {
    chapters: { type: Array, value: [] },
    course: { type: Object, value: {} }
  },

  data: {
    visible: false,
    fadeInClass: '',
    playerBottom: 15,
    currentChapter: {},
    currentIndex: 0,
    courseCover: '',
    courseName: '',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    playbackRate: 2,
    speedOptions: [1, 2]
  },

  lifetimes: {
    created() {
      this.bgAudioManager = app.bgAudioManager;
      this.audioCallback = {
        onCanplay: (data) => this.data.visible && this.setData({ duration: data.duration }),
        onPlay: () => this.data.visible && this.setData({ isPlaying: true }),
        onPause: () => this.data.visible && this.setData({ isPlaying: false }),
        onTimeUpdate: (data) => this.data.visible && this.setData({ currentTime: data.currentTime, progressPercent: data.progressPercent }),
        onEnded: () => this.onAudioEnded(),
        onError: () => this.data.visible && this.setData({ isPlaying: false }),
        onStop: () => this.data.visible && this.setData({ isPlaying: false }),
        onClose: () => {
          const pages = getCurrentPages();
          const isForeground = this.currentPageRoute === pages[pages.length - 1]?.route;
          if (isForeground) {
            // 前台：淡出后销毁
            this.setData({ fadeInClass: 'fade-out' });
            setTimeout(() => this.setData({ visible: false }), 300);
          } else {
            // 后台：直接销毁
            this.setData({ visible: false, fadeInClass: '' });
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

      const { playingCourse, playingChapter, playingIndex } = app.globalData;
      const data = {
        playerBottom: this.calcPosition(),
        isPlaying: !this.bgAudioManager.paused,
        currentChapter: playingChapter || {},
        currentIndex: playingIndex || 0,
        courseCover: playingCourse?.cover || '',
        courseName: playingCourse?.title || ''
      };

      // 首页/收藏页/我的页：如果还没淡入过，则淡入
      if (isTabBarPage && !app.globalData.miniPlayerIndexFadedIn) {
        this.fadeIn(data);
        app.globalData.miniPlayerIndexFadedIn = true;
      } else {
        // 其他情况直接显示（无动画）
        this.setData({ visible: true, fadeInClass: '', ...data });
      }
    }
  },

  methods: {
    calcPosition() {
      const pages = getCurrentPages();
      const route = pages[pages.length - 1]?.route || '';
      const tabBarPages = ['pages/index/index', 'pages/favorite/index', 'pages/mine/index'];

      if (!tabBarPages.includes(route)) return 15;

      const windowInfo = wx.getWindowInfo();
      const tabBarHeight = 80 * (windowInfo.windowWidth / 750);
      const safeArea = windowInfo.screenHeight - (windowInfo.safeArea?.bottom || windowInfo.screenHeight);
      return 8 + tabBarHeight + safeArea;
    },

    fadeIn(data) {
      this.setData({ visible: true, fadeInClass: 'fade-in', ...data });
    },

    async play(chapterId) {
      const { chapters, course } = this.properties;
      const index = chapters.findIndex(ch => ch._id === chapterId);

      if (index === -1 || !chapters[index]?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      const chapter = chapters[index];
      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;

      this.fadeIn({
        playerBottom: this.calcPosition(),
        isPlaying: false,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: course.cover || '',
        courseName: course.title || ''
      });

      this.loadAudio(chapter);
    },

    async loadAudio(chapter) {
      const bgAudio = this.bgAudioManager;
      let src = chapter.audioUrl;

      if (src.startsWith('cloud://')) {
        try {
          wx.showLoading({ title: '加载中...', mask: true });
          const res = await wx.cloud.getTempFileURL({ fileList: [src] });
          wx.hideLoading();
          src = res.fileList?.[0]?.tempFileURL;
          if (!src) throw new Error('获取链接失败');
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '音频加载失败', icon: 'none' });
          return;
        }
      }

      const [baseUrl, query] = src.split('?');
      bgAudio.title = chapter.title || '音频课程';
      bgAudio.epname = this.properties.course.title || '';
      bgAudio.coverImgUrl = this.properties.course.cover || '';
      bgAudio.startTime = Number(chapter.lastPlayTime) || 0;
      bgAudio.src = query ? `${encodeURI(baseUrl)}?${query}` : encodeURI(baseUrl);
    },

    onPlayPause() {
      if (this.data.isPlaying) {
        this.bgAudioManager.pause();
        this.saveProgress();
      } else {
        this.bgAudioManager.play();
      }
    },

    onSpeedChange() {
      const { speedOptions, playbackRate } = this.data;
      const nextRate = speedOptions[(speedOptions.indexOf(playbackRate) + 1) % speedOptions.length];
      this.setData({ playbackRate: nextRate });
      this.bgAudioManager.playbackRate = nextRate;
    },

    onAudioEnded() {
      this.updateProgress(this.data.duration, 1);
      const { chapters, currentIndex } = this.data;
      const nextIndex = currentIndex + 1;

      if (chapters?.length > nextIndex && chapters[nextIndex]?.audioUrl) {
        const nextChapter = chapters[nextIndex];
        app.globalData.playingChapter = nextChapter;
        app.globalData.playingIndex = nextIndex;
        this.setData({ currentChapter: nextChapter, currentIndex: nextIndex });
        this.loadAudio(nextChapter);
      } else {
        this.setData({ isPlaying: false });
      }
    },

    onClose() {
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.notifyCallbacks('onClose', {});
    },

    saveProgress() {
      this.updateProgress(Math.floor(this.data.currentTime), 0);
    },

    updateProgress(time, count) {
      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'updateChapterProgress',
          chapterId: this.data.currentChapter._id,
          lastPlayTime: time,
          playCount: count
        }
      }).catch(err => console.error('更新进度失败:', err));
    },

    preventMove() {}
  }
});