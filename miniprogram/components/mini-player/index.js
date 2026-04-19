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
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    playbackRate: 2,
    speedOptions: [1, 2],
    chapters: [], // 播放列表
    course: {}, // 当前播放的课程
    playlistSortOrder: 'asc' // 播放列表排序
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
        onPlayFromList: (data) => this.playFromList(data),
        onClose: () => {
            const pages = getCurrentPages();
            const isForeground = this.currentPageRoute === pages[pages.length - 1]?.route;
            // 先播放淡出动画，动画结束后再清除数据
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

      const { playingCourse, playingChapter, playingIndex, playlistChaptersData, playlistSortOrder } = app.globalData;
      const data = {
        playerBottom: this.calcPosition(),
        isPlaying: !this.bgAudioManager.paused,
        currentChapter: playingChapter || {},
        currentIndex: playingIndex || 0,
        courseCover: playingCourse?.cover || '',
        courseName: playingCourse?.title || '',
        chapters: playlistChaptersData || [],
        course: playingCourse || {},
        playlistSortOrder: playlistSortOrder || 'asc'
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
      const tabBarHeight = 100 * (windowInfo.windowWidth / 750);
      const safeArea = windowInfo.screenHeight - (windowInfo.safeArea?.bottom || windowInfo.screenHeight);
      return 8 + tabBarHeight + safeArea;
    },

    fadeIn(data) {
      this.setData({ visible: true, fadeInClass: 'fade-in', ...data });
    },

    // 从收藏列表播放
    playFromList(data) {
      const { index, chapters } = data;
      if (!chapters || chapters.length === 0 || index < 0) return;

      const chapter = chapters[index];
      if (!chapter?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      // 构建课程信息
      const course = {
        _id: chapter.course,
        title: chapter.courseTitle || '收藏列表',
        cover: chapter.courseCover || '',
        author: chapter.author || '',
        chapterCount: chapters.length
      };

      // 更新数据
      this.setData({
        chapters: chapters,
        course: course,
        currentChapter: chapter,
        currentIndex: index,
        courseCover: chapter.courseCover || '',
        courseName: chapter.courseTitle || '收藏列表',
        playlistSortOrder: 'asc'
      });

      // 更新全局数据
      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters;
      app.globalData.playlistSortOrder = 'asc';
      app.globalData.playMode = 'sequence';
      app.globalData.miniPlayerActive = true;
      app.globalData.miniPlayerIndexFadedIn = false;

      // 淡入显示
      this.fadeIn({
        playerBottom: this.calcPosition(),
        currentChapter: chapter,
        currentIndex: index,
        courseCover: chapter.courseCover || '',
        courseName: chapter.courseTitle || '收藏列表',
        chapters: chapters,
        course: course,
        playlistSortOrder: 'asc'
      });

      // 播放音频（使用 loadAudio 处理云存储链接）
      this.loadAudio(chapter);
    },

    async play(chapterId, playlistChapters, courseData, sortOrder) {
      // 先保存当前播放进度（如果有正在播放的章节）
      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      // 使用传入的播放列表，如果没有传入则使用 properties 的初始数据
      let chapters = playlistChapters || this.properties.initialChapters;
      let course = courseData || this.properties.initialCourse;

      const index = chapters.findIndex(ch => ch._id === chapterId);

      if (index === -1 || !chapters[index]?.audioUrl) {
        wx.showToast({ title: '暂无音频', icon: 'none' });
        return;
      }

      const chapter = chapters[index];

      // 判断是否需要更新排序状态：第一次创建播放列表或切换了课程时使用传入的排序
      const currentCourseId = app.globalData.playingCourse && app.globalData.playingCourse._id;
      const isNewPlaylist = !app.globalData.miniPlayerActive || currentCourseId !== course._id;
      const order = isNewPlaylist ? (sortOrder || 'asc') : (app.globalData.playlistSortOrder || sortOrder || 'asc');

      // 更新播放列表数据
      this.setData({ chapters: chapters, course: course, playlistSortOrder: order });

      // 保存到全局数据，以便其他页面恢复
      app.globalData.playingCourse = course;
      app.globalData.playingChapter = chapter;
      app.globalData.playingIndex = index;
      app.globalData.playlistChaptersData = chapters; // 保存完整的播放列表数据
      if (isNewPlaylist) {
        app.globalData.playlistSortOrder = order; // 只在创建新播放列表时保存排序状态
        app.globalData.playMode = 'sequence'; // 新播放列表默认顺序播放
      }
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
      // 重置播放结束处理标志
      this._audioEndedProcessing = false;

      const bgAudio = this.bgAudioManager;
      const src = chapter?.audioUrl;

      // 安全检查：音频地址不存在
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
      // 从上次播放位置继续播放（完播时 lastPlayTime=0，自然从头开始）
      const lastPlayTime = Number(chapter.lastPlayTime) || 0;
      const duration = Number(chapter.duration) || 0;
      // 安全防护：lastPlayTime >= duration 时从头开始
      const startTime = (lastPlayTime >= duration && duration > 0) ? 0 : lastPlayTime;
      bgAudio.startTime = startTime;
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

    // 公开方法：切换播放/暂停状态
    togglePlayPause() {
      this.onPlayPause();
    },

    onSpeedChange() {
      const { speedOptions, playbackRate } = this.data;
      const nextRate = speedOptions[(speedOptions.indexOf(playbackRate) + 1) % speedOptions.length];
      this.setData({ playbackRate: nextRate });
      this.bgAudioManager.playbackRate = nextRate;
    },

    onAudioEnded() {
      // 防止重复触发
      if (this._audioEndedProcessing) return;
      this._audioEndedProcessing = true;

      // 自然播放结束，设为完播，lastPlayTime=0，下次从头开始
      this.updateProgress(0, true);
      const { chapters, currentIndex } = this.data;
      const playMode = app.globalData.playMode || 'sequence';

      console.log('onAudioEnded 触发:', { playMode, currentIndex, chaptersLength: chapters.length });

      // 单章循环：从头重新播放当前章节
      if (playMode === 'single') {
        const currentChapter = chapters[currentIndex];
        if (currentChapter?.audioUrl) {
          // lastPlayTime=0，下次从头开始
          currentChapter.lastPlayTime = 0;
          this.setData({ currentChapter });
          this.loadAudio(currentChapter);
        } else {
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      // 顺序播放或列表循环：播放下一章
      const nextIndex = currentIndex + 1;

      // 列表结束处理
      if (nextIndex >= chapters.length) {
        if (playMode === 'loop') {
          // 列表循环：从头开始
          const firstChapter = chapters[0];
          if (firstChapter?.audioUrl) {
            app.globalData.playingChapter = firstChapter;
            app.globalData.playingIndex = 0;
            this.setData({ currentChapter: firstChapter, currentIndex: 0 });
            this.loadAudio(firstChapter);
            // 通知章节页更新播放状态
            app.notifyCallbacks('onChapterChange', { chapterId: firstChapter._id });
          }
        } else {
          // 顺序播放：停止
          this.setData({ isPlaying: false });
        }
        this._audioEndedProcessing = false;
        return;
      }

      // 播放下一章
      if (chapters[nextIndex]?.audioUrl) {
        const nextChapter = chapters[nextIndex];
        app.globalData.playingChapter = nextChapter;
        app.globalData.playingIndex = nextIndex;
        this.setData({ currentChapter: nextChapter, currentIndex: nextIndex });
        this.loadAudio(nextChapter);
        // 通知章节页更新播放状态
        app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
      } else {
        this.setData({ isPlaying: false });
      }
      this._audioEndedProcessing = false;
    },

    onClose() {
      this.saveProgress(); // 关闭前保存进度
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = []; // 清空播放列表数据
      app.notifyCallbacks('onClose', {});
    },

    saveProgress() {
      // 直接从 bgAudioManager 获取当前播放时间，确保是最新的
      const currentTime = this.bgAudioManager.currentTime || this.data.currentTime;
      this.updateProgress(Math.floor(currentTime));
    },

    updateProgress(time, finished) {
      const chapterId = this.data.currentChapter._id;
      const courseId = this.data.course._id;
      const userId = app.globalData.userId;

      console.log('updateProgress 调用:', { chapterId, courseId, userId, time, finished });

      // 确保 userId、chapterId、courseId 都存在才调用云函数
      if (!userId || !chapterId || !courseId) {
        console.log('updateProgress: userId、chapterId 或 courseId 不存在，跳过更新');
        return;
      }

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
        console.log('updateProgress 结果:', res.result);
        if (res.result.success) {
          // 更新 chapters 数组中对应章节的进度
          const chapters = this.data.chapters.map(ch => {
            if (ch._id === chapterId) {
              // 如果本次设置为完播，更新为"已学完"并设置 lastPlayTime
              if (finished === true) {
                return { ...ch, lastPlayTime: time, finished: true, progress: 100, progressText: '已学完' };
              }
              // 如果之前已完播，保持"已学完"状态，只更新 lastPlayTime
              if (ch.finished) {
                return { ...ch, lastPlayTime: time };
              }
              // 未完播时，根据播放位置计算进度
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
          // 同步到全局数据
          app.globalData.playlistChaptersData = chapters;

          // 通知页面更新进度显示
          app.notifyCallbacks('onProgressUpdate', {
            chapterId: chapterId,
            lastPlayTime: time,
            duration: this.data.duration,
            finished: finished
          });
        }
      }).catch(err => {
        console.error('更新进度失败:', err);
      });
    },

    preventMove() {},

    // 打开播放控制页面
    openPlayerPage() {
      wx.navigateTo({ url: '/pages/player/index' });
    },

    // 播放列表相关方法
    onPlaylistTap() {
      const playlistPanel = this.selectComponent('#playlistPanel');
      if (playlistPanel) playlistPanel.show();
    },

    onPlaylistCollapse() {
      // 播放列表收起
    },

    onPlaylistClear() {
      // 清空播放列表：停止播放，清空数据
      this.bgAudioManager.stop();
      app.globalData.miniPlayerActive = false;
      app.globalData.miniPlayerIndexFadedIn = false;
      app.globalData.playingCourse = null;
      app.globalData.playingChapter = null;
      app.globalData.playingIndex = 0;
      app.globalData.playlistChaptersData = [];
      this.setData({ visible: false, isPlaying: false, chapters: [] });
    },

    onPlaylistSyncSort(e) {
      // 播放列表排序变化，同步更新 chapters，并重新计算当前播放索引
      const sortedChapters = e.detail.chapters;
      const currentId = this.data.currentChapter._id;
      const newIndex = sortedChapters.findIndex(ch => ch._id === currentId);
      this.setData({ chapters: sortedChapters, currentIndex: newIndex });
      app.globalData.playingIndex = newIndex;
    },

    onPlaylistPlay(e) {
      const { chapterId, index } = e.detail;
      const chapter = this.data.chapters.find(ch => ch._id === chapterId);

      // 如果点击的是当前正在播放的章节，切换播放/暂停状态
      if (chapterId === this.data.currentChapter._id) {
        if (this.data.isPlaying) {
          this.bgAudioManager.pause();
          this.saveProgress();
          // 通知章节页暂停状态
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: false });
        } else {
          this.bgAudioManager.play();
          // 通知章节页播放状态
          app.notifyCallbacks('onPlayPause', { chapterId, isPlaying: true });
        }
        return;
      }

      // 切换到新章节前，先保存当前播放进度
      if (this.data.currentChapter._id && this.data.isPlaying) {
        this.saveProgress();
      }

      // 播放新章节
      if (chapter?.audioUrl) {
        app.globalData.playingChapter = chapter;
        app.globalData.playingIndex = index;
        this.setData({
          currentChapter: chapter,
          currentIndex: index,
          isPlaying: false
        });
        this.loadAudio(chapter);
        // 通知章节页更新播放状态
        app.notifyCallbacks('onChapterChange', { chapterId: chapter._id });
      }
    },

    onPlaylistDelete(e) {
      const { chapterId } = e.detail;
      const chapters = this.data.chapters.filter(ch => ch._id !== chapterId);
      this.setData({ chapters });
      // 更新全局播放列表数据
      app.globalData.playlistChaptersData = chapters;

      // 如果删除的是当前播放的章节，自动播放下一条
      if (chapterId === this.data.currentChapter._id) {
        // 正在播放时删除，保存播放进度
        if (this.data.isPlaying) {
          this.saveProgress();
        }

        const nextIndex = this.data.currentIndex;
        if (nextIndex < chapters.length && chapters[nextIndex]?.audioUrl) {
          const nextChapter = chapters[nextIndex];
          app.globalData.playingChapter = nextChapter;
          app.globalData.playingIndex = nextIndex;
          this.setData({
            currentChapter: nextChapter,
            currentIndex: nextIndex
          });
          this.loadAudio(nextChapter);
          // 通知章节页更新播放状态
          app.notifyCallbacks('onChapterChange', { chapterId: nextChapter._id });
        } else {
          this.bgAudioManager.stop();
          app.globalData.miniPlayerActive = false;
          app.globalData.playlistChaptersData = [];
          this.setData({ visible: false, isPlaying: false });
          // 通知章节页清除播放状态
          app.notifyCallbacks('onStop', {});
        }
      }
    }
  }
});