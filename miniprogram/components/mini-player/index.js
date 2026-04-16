// mini-player/index.js
const app = getApp();

Component({
  properties: {
    chapters: {
      type: Array,
      value: []
    },
    course: {
      type: Object,
      value: {}
    }
  },

  data: {
    show: false,
    currentChapter: {},
    currentIndex: 0,
    courseCover: '',
    courseName: '',
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    playbackRate: 2,
    speedOptions: [1, 1.5, 2, 3],
    tabBarHeight: 0
  },

  lifetimes: {
    created() {
      this.bgAudioManager = wx.getBackgroundAudioManager();
      this.setupBackgroundAudioEvents();
    },

    attached() {
      this.updateTabBarHeight();
      this.restorePlayingState();
    }
  },

  pageLifetimes: {
    show() {
      this.updateTabBarHeight();
      this.restorePlayingState();
    }
  },

  methods: {
    updateTabBarHeight() {
      const tabBarHeight = app.globalData.tabBarHeight || 0;
      this.setData({ tabBarHeight });
    },

    restorePlayingState() {
      // 恢复播放状态（从其他页面返回时）
      const bgAudio = this.bgAudioManager;
      const { playingCourse, playingChapter, playingIndex } = app.globalData;

      // 如果有全局播放数据
      if (playingCourse && playingChapter) {
        const isPlaying = bgAudio.src && !bgAudio.paused;
        const currentTime = bgAudio.currentTime || 0;
        const duration = bgAudio.duration || 0;
        const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

        // 如果正在播放或有播放记录，显示播放器
        if (isPlaying || currentTime > 0 || bgAudio.src) {
          this.setData({
            show: true,
            isPlaying: isPlaying,
            currentTime: currentTime,
            duration: duration,
            progressPercent: progressPercent,
            currentChapter: playingChapter,
            currentIndex: playingIndex,
            courseCover: playingCourse.cover || '',
            courseName: playingCourse.title || ''
          });
        }
      }
    },

    setupBackgroundAudioEvents() {
      const bgAudio = this.bgAudioManager;

      bgAudio.onCanplay(() => {
        bgAudio.playbackRate = this.data.playbackRate;
        this.setData({ duration: bgAudio.duration });
      });

      bgAudio.onPlay(() => {
        this.setData({ isPlaying: true });
      });

      bgAudio.onPause(() => {
        this.setData({ isPlaying: false });
      });

      bgAudio.onTimeUpdate(() => {
        const currentTime = bgAudio.currentTime;
        const duration = bgAudio.duration;
        const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
        this.setData({
          currentTime: currentTime,
          progressPercent: percent
        });
      });

      bgAudio.onEnded(() => {
        this.onPlayEnded();
      });

      bgAudio.onError((err) => {
        console.error('播放错误:', err);
        wx.showToast({ title: '播放失败', icon: 'none' });
        this.setData({ isPlaying: false });
      });

      bgAudio.onStop(() => {
        this.setData({ isPlaying: false });
      });
    },

    async play(chapterId) {
      const chapters = this.properties.chapters;
      const course = this.properties.course;
      const index = chapters.findIndex(ch => ch._id === chapterId);

      if (index === -1 || !chapters[index].audioUrl) {
        wx.showToast({ title: index === -1 ? '章节不存在' : '暂无音频', icon: 'none' });
        return;
      }

      const chapter = chapters[index];

      // 保存播放状态到全局数据
      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;

      this.setData({
        show: true,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: course.cover || '',
        courseName: course.title || ''
      });

      this.loadAndPlay(chapter);
    },

    async loadAndPlay(chapter) {
      const bgAudio = this.bgAudioManager;
      let audioSrc = chapter.audioUrl;

      if (audioSrc.startsWith('cloud://')) {
        try {
          wx.showLoading({ title: '加载中...', mask: true });
          const res = await wx.cloud.getTempFileURL({ fileList: [audioSrc] });
          wx.hideLoading();

          if (res.fileList?.[0]?.tempFileURL) {
            audioSrc = res.fileList[0].tempFileURL;
          } else {
            throw new Error('获取链接失败');
          }
        } catch (err) {
          wx.hideLoading();
          wx.showToast({ title: '音频加载失败', icon: 'none' });
          return;
        }
      }

      const [baseUrl, queryParam] = audioSrc.split('?');
      const encodedUrl = queryParam ? `${encodeURI(baseUrl)}?${queryParam}` : encodeURI(baseUrl);

      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const duration = Number(chapter.duration) || 0;

      bgAudio.title = chapter.title || '音频课程';
      bgAudio.epname = this.properties.course.title || '';
      bgAudio.coverImgUrl = this.properties.course.cover || '';

      if (lastPlayTime > 0 && lastPlayTime < duration) {
        bgAudio.startTime = lastPlayTime;
      }

      bgAudio.src = encodedUrl;
    },

    onPlayPause() {
      if (this.data.isPlaying) {
        this.bgAudioManager.pause();
        this.saveCurrentProgress();
      } else {
        this.bgAudioManager.play();
      }
    },

    // 切换倍速
    onSpeedChange() {
      const options = this.data.speedOptions;
      const currentRate = this.data.playbackRate;
      const currentIndex = options.findIndex(r => r === currentRate);
      const nextIndex = (currentIndex + 1) % options.length;
      const nextRate = options[nextIndex];

      this.setData({ playbackRate: nextRate });
      this.bgAudioManager.playbackRate = nextRate;
    },

    onPlayEnded() {
      this.updateChapterProgress(this.data.duration, 1);

      const chapters = this.properties.chapters;

      // 只有在有章节数据时才自动播放下一章
      if (chapters && chapters.length > 0) {
        const nextIndex = this.data.currentIndex + 1;

        if (nextIndex < chapters.length && chapters[nextIndex].audioUrl) {
          const nextChapter = chapters[nextIndex];

          // 更新全局数据
          app.globalData.playingChapter = nextChapter;
          app.globalData.playingIndex = nextIndex;

          this.setData({
            currentChapter: nextChapter,
            currentIndex: nextIndex
          });
          this.loadAndPlay(nextChapter);
          return;
        }
      }

      // 没有下一章可播放，停止
      this.setData({ isPlaying: false });
    },

    updateChapterProgress(lastPlayTime, playCount) {
      wx.cloud.callFunction({
        name: 'courseFunctions',
        data: {
          type: 'updateChapterProgress',
          chapterId: this.data.currentChapter._id,
          lastPlayTime: lastPlayTime,
          playCount: playCount
        }
      }).catch(err => console.error('更新进度失败:', err));
    },

    saveCurrentProgress() {
      this.updateChapterProgress(this.data.currentTime, 0);
    },

    close() {
      if (this.data.isPlaying) {
        this.bgAudioManager.pause();
        this.saveCurrentProgress();
      }

      // 清除全局播放数据
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;

      // 先触发退出动画
      this.setData({ show: false });

      // 动画完成后重置状态
      setTimeout(() => {
        this.setData({
          isPlaying: false,
          currentChapter: {},
          currentIndex: 0,
          courseCover: '',
          courseName: ''
        });
      }, 300);
    },

    stopAudio() {
      if (this.bgAudioManager) {
        this.bgAudioManager.stop();
      }
    },

    preventMove() {}
  }
});