// play-btn/index.js
const app = getApp();

Component({
  // options: { addGlobalClass: true } // 移除避免样式冲突

  properties: {
    // 模式: 'togglePlay' | 'newPlaylist'
    mode: { type: String, value: 'togglePlay' },
    // 课程ID，用于判断是否当前课程
    courseId: { type: String, value: '' }
  },

  data: {
    isPlaying: false,
    isActive: false
  },

  lifetimes: {
    created() {
      this.bgAudioManager = app.bgAudioManager;
      this.audioCallback = {
        onPlay: () => this._updateState(true),
        onPause: () => this._updateState(false),
        onStop: () => this._updateState(false),
        onEnded: () => this._updateState(false),
        onClose: () => this._updateState(false),
        onChapterChange: (data) => this._updateState(data?.isPlaying),
        onPlayPause: (data) => this._updateState(data?.isPlaying),
        onReset: () => this._updateState(false)
      };
    },
    attached() {
      app.registerMiniPlayer(this.audioCallback);
      this._updateState();
    },
    detached() {
      app.unregisterMiniPlayer(this.audioCallback);
    }
  },

  pageLifetimes: {
    show() {
      this._updateState();
    }
  },

  methods: {
    _updateState(isPlaying) {
      const courseId = this.properties.courseId;
      const playingCourseId = app.globalData.playingCourse?._id;
      const isCurrentCourse = playingCourseId === courseId;
      const hasPlaylist = isCurrentCourse && app.globalData.playlistChaptersData && app.globalData.playlistChaptersData.length > 0;
      // 优先使用回调传来的 isPlaying
      const isPlayingFinal = isPlaying !== undefined
        ? isCurrentCourse && isPlaying
        : isCurrentCourse && !this.bgAudioManager.paused;

      const isActive = hasPlaylist;

      this.setData({
        isPlaying: isPlayingFinal,
        isActive
      });
    },

    onTap() {
      const courseId = this.properties.courseId;
      const playingCourseId = app.globalData.playingCourse?._id;
      const isCurrentCourse = playingCourseId === courseId;
      const hasPlaylist = isCurrentCourse && app.globalData.playlistChaptersData && app.globalData.playlistChaptersData.length > 0;

      if (hasPlaylist) {
        // 已有播放列表，切换播放/暂停
        const willPause = !this.bgAudioManager.paused;
        app.togglePlayPause();
        // 手动通知所有回调更新状态
        setTimeout(() => {
          // 通知 mini-player 更新，willPause=true 表示即将暂停，所以 isPlaying=false
          app.notifyCallbacks('onPlayPause', { isPlaying: !willPause });
        }, 100);
      } else {
        // 没有播放列表，创建播放列表并播放
        this._createPlaylistAndPlay();
      }
    },

    // 供外部调用刷新状态
    refresh() {
      this._updateState();
    },

    _createPlaylistAndPlay() {
      const { courseId } = this.properties;
      if (!courseId) return;

      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'getCourseDetail',
          courseId: courseId,
          userId: app.globalData.userId
        }
      }).then(res => {
        if (res.result.success) {
          const course = res.result.course;
          const chapters = res.result.chapters || [];

          if (chapters.length === 0) {
            wx.showToast({ title: '暂无章节', icon: 'none' });
            return;
          }

          // 找到第一个未完成的章节
          let chapterToPlay = chapters.find(ch => ch.progress < 100) || chapters[0];

          app.globalData.playingCourse = course;
          app.globalData.playingChapter = chapterToPlay;
          app.globalData.playingSeq = chapterToPlay.seq;
          app.globalData.playingIndex = chapters.findIndex(ch => ch._id === chapterToPlay._id);
          app.globalData.playlistChaptersData = chapters;
          app.globalData.playlistSortOrder = 'asc';
          app.globalData.playMode = 'sequence';
          app.globalData.miniPlayerActive = true;
          app.globalData.miniPlayerIndexFadedIn = false;
          app.globalData.isFavoriteList = false;

          app.playChapter(chapterToPlay._id, chapters);
        }
      }).catch(err => {
        console.error('获取课程详情失败', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
    }
  }
});